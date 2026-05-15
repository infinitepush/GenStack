import type { AppConfig, ConfigEngineResult } from "@genstack/config-types";

export const appConfig: AppConfig = {
  app: {
    name: "Expense Tracker",
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
        name: "expenses",
        fields: [
          { name: "title", type: "string", required: true },
          { name: "amount", type: "number", required: true },
          { name: "category", type: "enum", required: false, options: ["food", "travel", "other"] },
          { name: "date", type: "date", required: false }
        ]
      }
    ]
  },
  ui: {
    pages: [
      {
        name: "Dashboard",
        route: "/dashboard",
        components: [
          { type: "stat_card", label: "Total Spent", aggregation: "sum", field: "amount", source: "expenses" },
          { type: "table", dataSource: "expenses", columns: ["title", "amount", "date"] },
          { type: "form", target: "expenses", fields: ["title", "amount", "category"] }
        ]
      },
      {
        name: "Analytics",
        route: "/analytics",
        components: [
          { type: "chart", chartType: "bar", source: "expenses", groupBy: "category", field: "amount", aggregation: "sum" }
        ]
      }
    ]
  },
  api: {
    endpoints: [
      { method: "GET", path: "/expenses", table: "expenses" },
      { method: "POST", path: "/expenses", table: "expenses" },
      { method: "PUT", path: "/expenses/:id", table: "expenses" },
      { method: "DELETE", path: "/expenses/:id", table: "expenses" }
    ]
  }
};

export const appConfigResult: ConfigEngineResult = {
  config: appConfig,
  errors: [],
  warnings: []
};
