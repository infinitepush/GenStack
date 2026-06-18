import type { AppConfig, ComponentConfig, FieldConfig } from "@genstack/config-types";

export type PromptAnalyticsIntent = "low_stock" | "restocked_today";

export interface PromptIntent {
  domain: "inventory" | "parking" | "delivery" | "crm" | "expense" | "task" | "generic";
  analytics: PromptAnalyticsIntent[];
  expectedFields: string[];
  expectedTokens: string[];
}

function hasAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function extractPromptIntent(prompt: string): PromptIntent {
  const lower = prompt.toLowerCase();
  const analytics: PromptAnalyticsIntent[] = [];
  const expectedFields: string[] = [];
  const expectedTokens: string[] = [];

  const domain: PromptIntent["domain"] = hasAny(lower, ["inventory", "stock", "warehouse", "reorder", "product"])
    ? "inventory"
    : hasAny(lower, ["parking", "vehicle"]) || /\bcar\b/i.test(prompt)
      ? "parking"
      : hasAny(lower, ["pizza", "delivery", "restaurant", "food order"])
        ? "delivery"
        : hasAny(lower, ["crm", "lead", "customer"])
          ? "crm"
          : hasAny(lower, ["expense", "spending", "budget"])
            ? "expense"
            : hasAny(lower, ["task", "todo", "project"])
              ? "task"
              : "generic";

  if (domain === "inventory") {
    expectedFields.push("product_name", "quantity", "reorder_level");
    expectedTokens.push("inventory", "stock", "product", "quantity", "reorder");
  }

  if (hasAny(lower, ["reorder level", "low stock", "below reorder", "inventory alert", "reorder alert"])) {
    analytics.push("low_stock");
    expectedFields.push("quantity", "reorder_level");
    expectedTokens.push("low", "stock", "reorder");
  }

  if (hasAny(lower, ["restocked today", "today", "restocked", "last restocked"])) {
    analytics.push("restocked_today");
    expectedFields.push("last_restocked_date");
    expectedTokens.push("today", "restocked");
  }

  return {
    domain,
    analytics: unique(analytics),
    expectedFields: unique(expectedFields),
    expectedTokens: unique(expectedTokens)
  };
}

function componentSource(component: ComponentConfig): string | undefined {
  for (const key of ["source", "dataSource", "target"] as const) {
    const value = component[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
}

export function intentTableName(config: AppConfig, intent: PromptIntent): string | undefined {
  if (intent.domain === "inventory") {
    return config.database.tables.find((table) => /inventory|stock|product/i.test(table.name))?.name ?? config.database.tables[0]?.name;
  }
  return config.database.tables[0]?.name;
}

export function fieldNamesFor(config: AppConfig, tableName: string | undefined): string[] {
  return config.database.tables.find((table) => table.name === tableName)?.fields.map((field) => field.name) ?? [];
}

export function hasField(config: AppConfig, fieldName: string): boolean {
  return config.database.tables.some((table) => table.fields.some((field) => field.name === fieldName));
}

export function hasFilteredComponent(config: AppConfig, token: PromptAnalyticsIntent): boolean {
  const serialized = JSON.stringify(config.ui.pages).toLowerCase();
  if (token === "low_stock") {
    return serialized.includes("low stock") || serialized.includes("below reorder") || serialized.includes("reorder_level");
  }
  return serialized.includes("restocked today") || serialized.includes("last_restocked_date");
}

export function inventoryFields(): FieldConfig[] {
  return [
    { name: "product_name", type: "string", required: true },
    { name: "sku", type: "string", required: false },
    { name: "quantity", type: "number", required: true },
    { name: "reorder_level", type: "number", required: true },
    { name: "supplier", type: "string", required: false },
    { name: "last_restocked_date", type: "date", required: false },
    { name: "status", type: "enum", required: false, options: ["in_stock", "low_stock", "out_of_stock"] }
  ];
}

export function inventoryAnalyticsComponents(tableName: string): ComponentConfig[] {
  return [
    {
      type: "stat_card",
      label: "Items Below Reorder Level",
      aggregation: "count",
      source: tableName,
      filter: { field: "quantity", operator: "lte_field", valueField: "reorder_level" }
    },
    {
      type: "stat_card",
      label: "Restocked Today",
      aggregation: "count",
      source: tableName,
      filter: { field: "last_restocked_date", operator: "today" }
    },
    {
      type: "table",
      title: "Low Stock Items",
      dataSource: tableName,
      columns: ["product_name", "quantity", "reorder_level", "supplier"],
      filter: { field: "quantity", operator: "lte_field", valueField: "reorder_level" }
    }
  ];
}

export function componentReferencesTable(component: ComponentConfig, tableName: string): boolean {
  return componentSource(component) === tableName;
}
