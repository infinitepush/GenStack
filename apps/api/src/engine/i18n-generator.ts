import type { AppConfig, ComponentConfig } from "@genstack/config-types";

type Messages = Record<string, string>;

const staticTranslations: Record<string, Messages> = {
  en: {
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
  },
  hi: {
    nav_dashboard: "डैशबोर्ड",
    nav_ai: "एआई स्टूडियो",
    nav_import: "आयात करें",
    nav_export: "निर्यात करें",
    nav_config: "कॉन्फ़िग संपादक",
    btn_save: "सहेजें",
    btn_cancel: "रद्द करें",
    empty_state: "कोई रिकॉर्ड नहीं मिला",
    loading: "लोड हो रहा है..."
  },
  fr: {
    nav_dashboard: "Tableau de bord",
    nav_ai: "Générateur IA",
    nav_import: "Importer CSV",
    nav_export: "Exporter GitHub",
    nav_config: "Éditeur Config",
    btn_save: "Enregistrer",
    btn_cancel: "Annuler",
    empty_state: "Aucun enregistrement trouvé",
    loading: "Chargement..."
  },
  de: {
    nav_dashboard: "Dashboard",
    nav_ai: "KI Studio",
    nav_import: "CSV Importieren",
    nav_export: "GitHub Exportieren",
    nav_config: "Konfig Editor",
    btn_save: "Speichern",
    btn_cancel: "Abbrechen",
    empty_state: "Keine Datensätze gefunden",
    loading: "Laden..."
  },
  es: {
    nav_dashboard: "Tablero",
    nav_ai: "Generador IA",
    nav_import: "Importar CSV",
    nav_export: "Exportar GitHub",
    nav_config: "Editor Config",
    btn_save: "Guardar",
    btn_cancel: "Cancelar",
    empty_state: "No se encontraron registros",
    loading: "Cargando..."
  },
  ja: {
    nav_dashboard: "ダッシュボード",
    nav_ai: "AIスタジオ",
    nav_import: "CSVインポート",
    nav_export: "GitHubエクスポート",
    nav_config: "設定エディタ",
    btn_save: "保存",
    btn_cancel: "キャンセル",
    empty_state: "レコードが見つかりません",
    loading: "読み込み中..."
  },
  zh: {
    nav_dashboard: "仪表板",
    nav_ai: "AI生成器",
    nav_import: "导入CSV",
    nav_export: "导出至GitHub",
    nav_config: "配置编辑器",
    btn_save: "保存",
    btn_cancel: "取消",
    empty_state: "未找到记录",
    loading: "加载中..."
  },
  ar: {
    nav_dashboard: "لوحة القيادة",
    nav_ai: "استوديو الذكاء الاصطناعي",
    nav_import: "استيراد CSV",
    nav_export: "تصدير إلى GitHub",
    nav_config: "محرر التكوين",
    btn_save: "حفظ",
    btn_cancel: "إلغاء",
    empty_state: "لم يتم العثور على سجلات",
    loading: "جاري التحميل..."
  }
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
  const supportedLocales = ["en", "hi", "fr", "de", "es", "ja", "zh", "ar"];
  const configLocales = config.app.locales.length > 0 ? config.app.locales : ["en"];
  const locales = Array.from(new Set([...configLocales, ...supportedLocales]));

  const english: Messages = {
    ...staticTranslations.en,
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
      const customTranslations = config.translations?.[locale] || {};
      if (locale === "en") {
        return [locale, { ...english, ...customTranslations }];
      }

      const staticSet = staticTranslations[locale] || {};
      const localizedMessages = Object.fromEntries(
        Object.entries(english).map(([key, englishValue]) => {
          if (staticSet[key]) {
            return [key, staticSet[key]];
          }
          return [key, `[${locale.toUpperCase()}] ${englishValue}`];
        })
      );

      return [locale, { ...localizedMessages, ...customTranslations }];
    })
  );
}
