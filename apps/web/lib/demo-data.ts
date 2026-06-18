import type { AppConfig } from "@genstack/config-types";
import { clearGenerationHistory, readGenerationHistory, saveGenerationHistory, type GenerationHistoryEntry, type PromptIntentSnapshot } from "@/lib/generation-history";
import { getActiveRuntime, saveRuntimeConfig } from "@/lib/runtime-history";

interface DemoSeed {
  prompt: string;
  generationMode: "structured" | "fallback";
  repairActions: number;
  validationScore: number;
  validationMaxScore: number;
  promptCoverage: number;
  grade: GenerationHistoryEntry["grade"];
  intent: PromptIntentSnapshot;
  config: AppConfig;
}

function cloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig;
}

function buildDemoConfig(
  name: string,
  tableName: string,
  fieldDefs: Array<{ name: string; type: "string" | "text" | "number" | "boolean" | "date" | "enum"; required?: boolean; options?: string[] }>,
  dashboardLabel: string,
  tableColumns: string[],
  formFields: string[],
  chartGroupBy: string
): AppConfig {
  return {
    app: {
      name,
      theme: "dark",
      locale: "en",
      locales: ["en", "hi"]
    },
    auth: {
      enabled: true,
      methods: ["email", "github"]
    },
    database: {
      tables: [
        {
          name: tableName,
          fields: fieldDefs.map((field) => ({
            name: field.name,
            type: field.type,
            required: field.required ?? false,
            ...(field.options ? { options: field.options } : {})
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
            {
              type: "stat_card",
              label: dashboardLabel,
              aggregation: "count",
              source: tableName,
              field: fieldDefs[0]?.name ?? "id"
            },
            {
              type: "table",
              dataSource: tableName,
              columns: tableColumns
            },
            {
              type: "form",
              target: tableName,
              fields: formFields
            }
          ]
        },
        {
          name: "Analytics",
          route: "/analytics",
          components: [
            {
              type: "chart",
              chartType: "bar",
              source: tableName,
              groupBy: chartGroupBy,
              field: fieldDefs.find((field) => field.type === "number")?.name ?? fieldDefs[0]?.name ?? "value",
              aggregation: "count"
            }
          ]
        }
      ]
    },
    api: {
      endpoints: [
        { method: "GET", path: `/${tableName}`, table: tableName },
        { method: "POST", path: `/${tableName}`, table: tableName },
        { method: "PUT", path: `/${tableName}/:id`, table: tableName },
        { method: "DELETE", path: `/${tableName}/:id`, table: tableName }
      ]
    }
  };
}

const demoSeeds: DemoSeed[] = [
  {
    prompt: "Build an inventory tracker with reorder alerts, low stock thresholds, and restocked today analytics.",
    generationMode: "structured",
    repairActions: 0,
    validationScore: 20,
    validationMaxScore: 20,
    promptCoverage: 100,
    grade: "A",
    intent: {
      domain: "inventory",
      analytics: ["low_stock", "restocked_today"],
      expectedFields: ["item_name", "quantity", "reorder_level", "last_restocked"],
      expectedTokens: ["inventory", "reorder", "stock"]
    },
    config: buildDemoConfig(
      "Inventory Tracker",
      "inventory_items",
      [
        { name: "item_name", type: "string", required: true },
        { name: "quantity", type: "number", required: true },
        { name: "reorder_level", type: "number", required: true },
        { name: "last_restocked", type: "date", required: false }
      ],
      "Low Stock Items",
      ["item_name", "quantity", "reorder_level", "last_restocked"],
      ["item_name", "quantity", "reorder_level"],
      "item_name"
    )
  },
  {
    prompt: "Create a sales CRM with leads, stages, company names, deal value, and pipeline analytics.",
    generationMode: "structured",
    repairActions: 1,
    validationScore: 19,
    validationMaxScore: 20,
    promptCoverage: 95,
    grade: "A",
    intent: {
      domain: "crm",
      analytics: ["pipeline"],
      expectedFields: ["lead_name", "company", "stage", "deal_value"],
      expectedTokens: ["crm", "leads", "pipeline"]
    },
    config: buildDemoConfig(
      "Sales CRM",
      "leads",
      [
        { name: "lead_name", type: "string", required: true },
        { name: "company", type: "string", required: true },
        { name: "stage", type: "enum", required: true, options: ["new", "qualified", "proposal", "won"] },
        { name: "deal_value", type: "number", required: true }
      ],
      "Qualified Leads",
      ["lead_name", "company", "stage", "deal_value"],
      ["lead_name", "company", "stage", "deal_value"],
      "stage"
    )
  },
  {
    prompt: "Build a car parking manager with slots, vehicle types, payment status, and occupancy analytics.",
    generationMode: "fallback",
    repairActions: 2,
    validationScore: 18,
    validationMaxScore: 20,
    promptCoverage: 100,
    grade: "A",
    intent: {
      domain: "parking",
      analytics: ["occupancy"],
      expectedFields: ["slot_number", "vehicle_type", "status", "entry_time"],
      expectedTokens: ["parking", "vehicle", "slot"]
    },
    config: buildDemoConfig(
      "Parking Manager",
      "parking_slots",
      [
        { name: "slot_number", type: "string", required: true },
        { name: "vehicle_type", type: "enum", required: true, options: ["car", "suv", "bike", "van"] },
        { name: "status", type: "enum", required: true, options: ["occupied", "vacant"] },
        { name: "entry_time", type: "date", required: false }
      ],
      "Occupied Slots",
      ["slot_number", "vehicle_type", "status", "entry_time"],
      ["slot_number", "vehicle_type", "status"],
      "status"
    )
  }
];

export function loadReviewerDemoData(): GenerationHistoryEntry[] {
  clearGenerationHistory();

  const now = Date.now();
  const firstDemoSeed = demoSeeds[0];
  demoSeeds
    .slice()
    .reverse()
    .forEach((seed, index) => {
      saveGenerationHistory({
        appName: seed.config.app.name,
        prompt: seed.prompt,
        generationMode: seed.generationMode,
        repairActions: seed.repairActions,
        validationScore: seed.validationScore,
        validationMaxScore: seed.validationMaxScore,
        promptCoverage: seed.promptCoverage,
        grade: seed.grade,
        intent: seed.intent,
        config: cloneConfig(seed.config),
        createdAt: new Date(now - (demoSeeds.length - index - 1) * 120000).toISOString()
      });
  });

  if (!getActiveRuntime()) {
    saveRuntimeConfig(cloneConfig(firstDemoSeed!.config), firstDemoSeed!.prompt);
  }

  return readGenerationHistory();
}

export function getReviewerDemoConfig(): AppConfig {
  return cloneConfig(demoSeeds[0]!.config);
}
