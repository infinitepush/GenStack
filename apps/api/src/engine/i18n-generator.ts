import type { AppConfig, ComponentConfig } from "@genstack/config-types";

type Messages = Record<string, string>;

const staticMessages: Messages = {
  nav_dashboard: "Dashboard",
  nav_ai: "AI Generator",
  nav_import: "Import CSV",
  nav_export: "Export to GitHub",
  nav_config: "Config Editor",
  nav_pages: "Pages",
  nav_system: "System",
  btn_save: "Save",
  btn_cancel: "Cancel",
  btn_import: "Import",
  btn_export: "Export",
  btn_apply_config: "Apply Config",
  btn_reset_demo: "Reset to Demo",
  empty_state: "No records found",
  loading: "Loading...",
  error: "Error",
  upload_csv: "Upload CSV",
  map_columns: "Map Columns",
  result: "Result",
  export_github: "Export to GitHub",
  config_editor: "Config Editor"
};

const hindiDemoMessages: Messages = {
  app_name: "खर्च ट्रैकर",
  nav_dashboard: "डैशबोर्ड",
  nav_import: "आयात करें",
  nav_export: "निर्यात करें",
  btn_save: "सहेजें",
  btn_cancel: "रद्द करें",
  field_title: "शीर्षक",
  field_amount: "राशि",
  field_category: "श्रेणी",
  field_date: "तारीख",
  empty_state: "कोई रिकॉर्ड नहीं मिला",
  loading: "लोड हो रहा है..."
};

function keyFor(prefix: string, value: string): string {
  return `${prefix}_${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item"}`;
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function collectComponentMessages(component: ComponentConfig, messages: Messages): void {
  const label = getString(component.label) ?? getString(component.title);
  if (label) {
    messages[keyFor("component", label)] = label;
  }
}

export function generateI18nMessages(config: AppConfig): Record<string, Messages> {
  const locales = config.app.locales.length > 0 ? config.app.locales : ["en"];
  const english: Messages = {
    ...staticMessages,
    app_name: config.app.name
  };

  config.ui.pages.forEach((page) => {
    english[keyFor("page", page.name)] = page.name;
    page.components.forEach((component) => collectComponentMessages(component, english));
  });

  config.database.tables.forEach((table) => {
    english[keyFor("table", table.name)] = humanize(table.name);
    table.fields.forEach((field) => {
      english[keyFor("field", field.name)] = humanize(field.name);
      field.options?.forEach((option) => {
        english[keyFor("enum", option)] = humanize(option);
      });
    });
  });

  return Object.fromEntries(
    locales.map((locale) => {
      if (locale === "en") {
        return [locale, english];
      }

      return [
        locale,
        Object.fromEntries(
          Object.entries(english).map(([key, value]) => [key, hindiDemoMessages[key] ?? `${value} [UNTRANSLATED]`])
        )
      ];
    })
  );
}
