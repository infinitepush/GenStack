import type { AppConfig } from "@genstack/config-types";
import type { AiDraft, AiProvider } from "./types.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readChatCompletionContent(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;
  const response = value as ChatCompletionResponse;
  return response.choices?.[0]?.message?.content ?? undefined;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function inferDomain(prompt: string): {
  appName: string;
  tableName: string;
  fields: Array<{ name: string; type: "string" | "number" | "date" | "enum"; required?: boolean; options?: string[] }>;
} {
  const lower = prompt.toLowerCase();

  if (lower.includes("task") || lower.includes("todo") || lower.includes("project")) {
    return {
      appName: "Task Tracker",
      tableName: "tasks",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "status", type: "enum", options: ["todo", "doing", "done"], required: true },
        { name: "priority", type: "enum", options: ["low", "medium", "high"] },
        { name: "dueDate", type: "date" }
      ]
    };
  }

  if (lower.includes("crm") || lower.includes("lead") || lower.includes("customer")) {
    return {
      appName: "Customer CRM",
      tableName: "leads",
      fields: [
        { name: "name", type: "string", required: true },
        { name: "company", type: "string" },
        { name: "value", type: "number" },
        { name: "stage", type: "enum", options: ["new", "qualified", "won", "lost"] }
      ]
    };
  }

  return {
    appName: lower.includes("expense") ? "Expense Tracker" : `${titleCase(prompt) || "Generated"} App`,
    tableName: "expenses",
    fields: [
      { name: "title", type: "string", required: true },
      { name: "amount", type: "number", required: true },
      { name: "category", type: "enum", options: ["food", "travel", "software", "other"] },
      { name: "date", type: "date" }
    ]
  };
}

function buildConfigFromPrompt(prompt: string): AppConfig {
  const domain = inferDomain(prompt);
  const basePath = `/${domain.tableName}`;

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
            { type: "table", dataSource: domain.tableName, columns: domain.fields.slice(0, 3).map((field) => field.name) },
            { type: "form", target: domain.tableName, fields: domain.fields.map((field) => field.name) }
          ]
        },
        {
          name: "Analytics",
          route: "/analytics",
          components: [
            { type: "chart", chartType: "bar", source: domain.tableName, groupBy: domain.fields[2]?.name ?? domain.fields[0]?.name, field: domain.fields[1]?.name ?? domain.fields[0]?.name, aggregation: "sum" }
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
    "Return ONLY a single JSON object. Do not wrap it in markdown.",
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
    "Use short lowercase plural table names like expenses, leads, tasks, products.",
    "Example shape:",
    JSON.stringify(buildConfigFromPrompt("Build a CRM dashboard for leads"), null, 2)
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

  async generateConfigDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft> {
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
          {
            role: "system",
            content: runtimeContractPrompt()
          },
          {
            role: "user",
            content: [
              `User app request: ${input.prompt}`,
              `Optional seed config: ${JSON.stringify(input.seedConfig ?? null)}`,
              "Generate a complete runtime-valid AppConfig. If unsure, prefer a simple dashboard/form/table app."
            ].join("\n")
          }
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

    return { provider: this.name, model: this.model, text: content };
  }
}

export function createAiProvider(): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (apiKey && process.env.AI_PROVIDER === "openai") {
    return new OpenAiCompatibleProvider(apiKey, process.env.AI_MODEL, process.env.AI_BASE_URL);
  }

  return new LocalHeuristicProvider();
}
