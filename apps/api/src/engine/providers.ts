import type { AppConfig, FieldConfig } from "@genstack/config-types";
import { extractPromptIntent, inventoryAnalyticsComponents, inventoryFields } from "./prompt-intent.js";
import type { AiDraft, AiProvider } from "./types.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

type JsonSchema = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readChatCompletionContent(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;
  const response = value as ChatCompletionResponse;
  return response.choices?.[0]?.message?.content ?? undefined;
}

function readToolCallArguments(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;
  const response = value as ChatCompletionResponse;
  return response.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? undefined;
}

function readGeminiContent(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;
  const response = value as GeminiGenerateContentResponse;
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("").trim();
  return text === "" ? undefined : text;
}

const appConfigJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["app", "auth", "database", "ui", "api"],
  properties: {
    app: {
      type: "object",
      additionalProperties: false,
      required: ["name", "theme", "locale", "locales"],
      properties: {
        name: { type: "string" },
        theme: { type: "string", enum: ["dark", "light", "system"] },
        locale: { type: "string" },
        locales: { type: "array", items: { type: "string" } }
      }
    },
    auth: {
      type: "object",
      additionalProperties: false,
      required: ["enabled", "methods"],
      properties: {
        enabled: { type: "boolean" },
        methods: { type: "array", items: { type: "string", enum: ["email", "github"] } }
      }
    },
    database: {
      type: "object",
      additionalProperties: false,
      required: ["tables"],
      properties: {
        tables: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "fields"],
            properties: {
              name: { type: "string" },
              fields: {
                type: "array",
                minItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "type", "required"],
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["string", "text", "number", "boolean", "date", "enum"] },
                    required: { type: "boolean" },
                    options: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    ui: {
      type: "object",
      additionalProperties: false,
      required: ["pages"],
      properties: {
        pages: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "route", "components"],
            properties: {
              name: { type: "string" },
              route: { type: "string" },
              components: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: true,
                  required: ["type"],
                  properties: {
                    type: { type: "string", enum: ["form", "table", "stat_card", "chart"] },
                    label: { type: "string" },
                    title: { type: "string" },
                    target: { type: "string" },
                    source: { type: "string" },
                    dataSource: { type: "string" },
                    fields: { type: "array", items: { type: "string" } },
                    columns: { type: "array", items: { type: "string" } },
                    aggregation: { type: "string", enum: ["sum", "count", "avg"] },
                    field: { type: "string" },
                    groupBy: { type: "string" },
                    chartType: { type: "string", enum: ["bar", "line"] },
                    filter: { type: "object", additionalProperties: true }
                  }
                }
              }
            }
          }
        }
      }
    },
    api: {
      type: "object",
      additionalProperties: false,
      required: ["endpoints"],
      properties: {
        endpoints: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["method", "path", "table"],
            properties: {
              method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
              path: { type: "string" },
              table: { type: "string" }
            }
          }
        }
      }
    }
  }
};

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function hasWord(value: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(value);
}

function inferDomain(prompt: string): {
  appName: string;
  tableName: string;
  fields: FieldConfig[];
} {
  const lower = prompt.toLowerCase();
  const intent = extractPromptIntent(prompt);

  if (lower.includes("task") || lower.includes("todo") || lower.includes("project")) {
    return {
      appName: "Task Tracker",
      tableName: "tasks",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "status", type: "enum", options: ["todo", "doing", "done"], required: true },
        { name: "priority", type: "enum", options: ["low", "medium", "high"], required: false },
        { name: "dueDate", type: "date", required: false }
      ]
    };
  }

  if (lower.includes("crm") || lower.includes("lead") || lower.includes("customer")) {
    return {
      appName: "Customer CRM",
      tableName: "leads",
      fields: [
        { name: "name", type: "string", required: true },
        { name: "company", type: "string", required: false },
        { name: "value", type: "number", required: false },
        { name: "stage", type: "enum", options: ["new", "qualified", "won", "lost"], required: false }
      ]
    };
  }

  if (intent.domain === "inventory") {
    return {
      appName: "Inventory Manager",
      tableName: "inventory_items",
      fields: inventoryFields()
    };
  }

  if (lower.includes("pizza") || lower.includes("delivery") || lower.includes("restaurant") || lower.includes("food order")) {
    return {
      appName: "Pizza Delivery Manager",
      tableName: "pizza_orders",
      fields: [
        { name: "customer_name", type: "string", required: true },
        { name: "pizza_type", type: "enum", options: ["margherita", "pepperoni", "veggie", "paneer"], required: true },
        { name: "delivery_address", type: "string", required: true },
        { name: "total_amount", type: "number", required: false },
        { name: "order_status", type: "enum", options: ["pending", "preparing", "out_for_delivery", "delivered"], required: false },
        { name: "order_date", type: "date", required: false }
      ]
    };
  }

  if (lower.includes("parking") || lower.includes("vehicle") || hasWord(lower, "car")) {
    return {
      appName: "Parking Manager",
      tableName: "parking_sessions",
      fields: [
        { name: "plate_number", type: "string", required: true },
        { name: "vehicle_type", type: "enum", options: ["car", "bike", "truck", "van"], required: true },
        { name: "slot_number", type: "string", required: true },
        { name: "fee_amount", type: "number", required: false },
        { name: "status", type: "enum", options: ["parked", "paid", "exited"], required: false },
        { name: "entry_date", type: "date", required: false }
      ]
    };
  }

  if (lower.includes("expense") || lower.includes("spending") || lower.includes("budget")) {
    return {
      appName: "Expense Tracker",
      tableName: "expenses",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "amount", type: "number", required: true },
        { name: "category", type: "enum", options: ["food", "travel", "software", "other"], required: false },
        { name: "date", type: "date", required: false }
      ]
    };
  }

  return {
    appName: `${titleCase(prompt) || "Generated"} App`,
    tableName: "records",
    fields: [
      { name: "title", type: "string", required: true },
      { name: "status", type: "enum", options: ["new", "active", "done"], required: false },
      { name: "value", type: "number", required: false },
      { name: "created_date", type: "date", required: false }
    ]
  };
}

export function buildConfigFromPrompt(prompt: string): AppConfig {
  const domain = inferDomain(prompt);
  const intent = extractPromptIntent(prompt);
  const basePath = `/${domain.tableName}`;
  const numericField = domain.fields.find((field) => field.type === "number")?.name;
  const groupField = domain.fields.find((field) => field.type === "enum")?.name ?? domain.fields[0]?.name ?? "title";
  const intentAnalytics = intent.domain === "inventory" ? inventoryAnalyticsComponents(domain.tableName) : [];

  return {
    app: {
      name: domain.appName,
      theme: "dark",
      locale: "en",
      locales: ["en"]
    },
    auth: {
      enabled: true,
      methods: ["email", "github"]
    },
    database: {
      tables: [
        {
          name: domain.tableName,
          fields: domain.fields.map((field) => ({
            name: field.name,
            type: field.type,
            required: field.required ?? false,
            options: field.options
          }))
        }
      ]
    },
    ui: {
      pages: [
        {
          name: "Dashboard",
          route: "/dashboard",
          components: [
            { type: "stat_card", label: "Total", aggregation: "count", source: domain.tableName },
            ...intentAnalytics.filter((component) => component.type === "stat_card"),
            { type: "table", dataSource: domain.tableName, columns: domain.fields.slice(0, 3).map((field) => field.name) },
            ...intentAnalytics.filter((component) => component.type === "table"),
            { type: "form", target: domain.tableName, fields: domain.fields.map((field) => field.name) }
          ]
        },
        {
          name: "Analytics",
          route: "/analytics",
          components: [
            {
              type: "chart",
              chartType: "bar",
              source: domain.tableName,
              groupBy: groupField,
              field: numericField ?? groupField,
              aggregation: numericField ? "sum" : "count"
            }
          ]
        }
      ]
    },
    api: {
      endpoints: [
        { method: "GET", path: basePath, table: domain.tableName },
        { method: "POST", path: basePath, table: domain.tableName },
        { method: "PUT", path: `${basePath}/:id`, table: domain.tableName },
        { method: "DELETE", path: `${basePath}/:id`, table: domain.tableName }
      ]
    }
  };
}

function runtimeContractPrompt(): string {
  return [
    "Generate a GenStack AppConfig for a config-driven runtime app.",
    "When tools or structured output are available, call the provided function with schema-valid JSON only.",
    "For legacy text fallback, return ONLY a single JSON object. Do not wrap it in markdown.",
    "The JSON must be a GenStack AppConfig with exactly these top-level keys: app, auth, database, ui, api.",
    "Allowed field types: string, text, number, boolean, date, enum. Do not use integer, float, currency, email, datetime, object, array, relation, uuid, or file.",
    "Allowed component types: form, table, stat_card, chart. Do not use header, text, button, card, navbar, sidebar, container, section, grid, input, modal, tabs, or list.",
    "Every table must include at least 3 fields. At least one field should be required.",
    "If a field type is enum, include a non-empty options array.",
    "Every page component that reads data must reference an existing table name using dataSource, source, or target.",
    "Every form fields array must contain only field names from its target table.",
    "Every table columns array must contain only field names from its dataSource table.",
    "Every database table must have these API endpoints: GET /table, POST /table, PUT /table/:id, DELETE /table/:id.",
    "Always include one Dashboard page at route /dashboard with stat_card, table, and form components.",
    "For charts, use source, groupBy, field, chartType, and aggregation. The chart field should be numeric when possible.",
    "For inventory prompts with reorder alerts, include quantity and reorder_level fields plus an Items Below Reorder Level stat card with filter {field:'quantity', operator:'lte_field', valueField:'reorder_level'}.",
    "For prompts mentioning restocked today or today, include last_restocked_date and a Restocked Today stat card with filter {field:'last_restocked_date', operator:'today'}.",
    "Use short lowercase plural table names that match the user's domain, like parking_sessions, invoices, members, bookings, leads, tasks, or products.",
    "Do not reuse example tables or fields unless they match the user's requested app domain.",
    "Example shape:",
    JSON.stringify(buildConfigFromPrompt("Build a CRM dashboard for leads"), null, 2)
  ].join("\n");
}

function userGenerationPrompt(input: { prompt: string; seedConfig?: unknown }): string {
  const intent = extractPromptIntent(input.prompt);
  return [
    `User app request: ${input.prompt}`,
    `Detected intent hints: ${JSON.stringify(intent)}`,
    `Optional seed config: ${JSON.stringify(input.seedConfig ?? null)}`,
    "Generate a complete runtime-valid AppConfig. If unsure, prefer a simple dashboard/form/table app.",
    "Make sure generated fields, tables, components, and API endpoints all reference each other consistently."
  ].join("\n");
}

export class LocalHeuristicProvider implements AiProvider {
  readonly name = "local-heuristic";
  readonly model = "deterministic-v1";

  async generateConfigDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft> {
    const config = buildConfigFromPrompt(input.prompt);
    return {
      provider: this.name,
      model: this.model,
      text: JSON.stringify(config, null, 2)
    };
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    model = "gpt-4o-mini",
    baseUrl = "https://api.openai.com/v1"
  ) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async generateStructuredDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: runtimeContractPrompt()
          },
          {
            role: "user",
            content: userGenerationPrompt(input)
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_app_config",
              description: "Emit exactly one complete GenStack AppConfig object.",
              parameters: appConfigJsonSchema
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "emit_app_config" } }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const details = body ? `: ${body.slice(0, 500)}` : "";
      throw new Error(`AI provider returned ${response.status}${details}`);
    }

    const content = readToolCallArguments(await response.json());
    if (!content) {
      throw new Error("AI provider response did not include structured AppConfig arguments.");
    }

    return { provider: `${this.name}:structured`, model: this.model, text: content, structured: JSON.parse(content) as unknown };
  }

  private async generateFreeformDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: runtimeContractPrompt() },
          { role: "user", content: userGenerationPrompt(input) }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const details = body ? `: ${body.slice(0, 500)}` : "";
      throw new Error(`AI provider returned ${response.status}${details}`);
    }

    const content = readChatCompletionContent(await response.json());
    if (!content) {
      throw new Error("AI provider response did not include content.");
    }

    return { provider: `${this.name}:freeform`, model: this.model, text: content };
  }

  async generateConfigDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft> {
    try {
      return await this.generateStructuredDraft(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Structured generation failed.";
      if (message.includes("AI provider returned 429")) {
        throw error;
      }
      return this.generateFreeformDraft(input);
    }
  }
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    model = "gemini-2.5-flash",
    baseUrl = "https://generativelanguage.googleapis.com/v1beta"
  ) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async generateContent(input: { prompt: string; seedConfig?: unknown }, withSchema: boolean): Promise<AiDraft> {
    const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: userGenerationPrompt(input)
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: runtimeContractPrompt()
            }
          ]
        },
        generationConfig: withSchema
          ? {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: appConfigJsonSchema
            }
          : {
              temperature: 0.2
            }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const details = body ? `: ${body.slice(0, 500)}` : "";
      throw new Error(`AI provider returned ${response.status}${details}`);
    }

    const payload = await response.json();
    const content = readGeminiContent(payload);
    if (!content) {
      throw new Error("AI provider response did not include content.");
    }

    if (withSchema) {
      try {
        return { provider: `${this.name}:structured`, model: this.model, text: content, structured: JSON.parse(content) as unknown };
      } catch {
        throw new Error("Gemini structured response was not valid JSON.");
      }
    }

    return { provider: `${this.name}:freeform`, model: this.model, text: content };
  }

  async generateConfigDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft> {
    try {
      return await this.generateContent(input, true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Structured generation failed.";
      if (message.includes("AI provider returned 429")) {
        throw error;
      }
      return this.generateContent(input, false);
    }
  }
}

export function createAiProvider(): AiProvider {
  const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;

  if (geminiApiKey && process.env.AI_PROVIDER !== "openai") {
    return new GeminiProvider(geminiApiKey, process.env.GEMINI_MODEL, process.env.GEMINI_BASE_URL);
  }

  if (openAiApiKey && process.env.AI_PROVIDER === "openai") {
    return new OpenAiCompatibleProvider(openAiApiKey, process.env.AI_MODEL, process.env.AI_BASE_URL);
  }

  return new LocalHeuristicProvider();
}
