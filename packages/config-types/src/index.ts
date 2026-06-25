import { z } from "zod";

export const fieldTypeSchema = z.enum(["string", "text", "number", "boolean", "date", "enum"]);
export const authMethodSchema = z.enum(["email", "github"]);
export const httpMethodSchema = z.enum(["GET", "POST", "PUT", "DELETE"]);
export const aggregationSchema = z.enum(["sum", "count", "avg"]);

export const fieldSchema = z.object({
  name: z.string().min(1),
  type: fieldTypeSchema.default("string"),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional()
});

export const databaseTableSchema = z.object({
  name: z.string().min(1),
  fields: z.array(fieldSchema).default([])
});

export const componentConfigSchema = z.object({
  type: z.string().min(1)
}).catchall(z.unknown());

export const pageConfigSchema = z.object({
  name: z.string().min(1),
  route: z.string().min(1),
  components: z.array(componentConfigSchema).default([])
});

export const apiEndpointSchema = z.object({
  method: httpMethodSchema,
  path: z.string().min(1),
  table: z.string().min(1)
});

export const appConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1).default("Untitled App"),
    theme: z.enum(["dark", "light", "system"]).default("dark"),
    locale: z.string().min(2).default("en"),
    locales: z.array(z.string().min(2)).default(["en"])
  }),
  auth: z.object({
    enabled: z.boolean().default(false),
    methods: z.array(authMethodSchema).default([])
  }),
  database: z.object({
    tables: z.array(databaseTableSchema).default([])
  }),
  ui: z.object({
    pages: z.array(pageConfigSchema).default([])
  }),
  api: z.object({
    endpoints: z.array(apiEndpointSchema).default([])
  })
});

export type FieldType = z.infer<typeof fieldTypeSchema>;
export type AuthMethod = z.infer<typeof authMethodSchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type Aggregation = z.infer<typeof aggregationSchema>;
export type FieldConfig = z.infer<typeof fieldSchema>;
export type DatabaseTableConfig = z.infer<typeof databaseTableSchema>;
export type ComponentConfig = z.infer<typeof componentConfigSchema>;
export type PageConfig = z.infer<typeof pageConfigSchema>;
export type ApiEndpointConfig = z.infer<typeof apiEndpointSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export type ConfigIssueLevel = "error" | "warning";

export interface ConfigIssue {
  level: ConfigIssueLevel;
  path: string;
  message: string;
}

export interface ConfigEngineResult {
  config: AppConfig;
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
}

type JsonObject = Record<string, unknown>;

const componentTypes = new Set(["form", "table", "stat_card", "chart", "kanban"]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(value: unknown, path: string, issues: ConfigIssue[]): JsonObject {
  if (value === undefined) {
    return {};
  }

  if (!isObject(value)) {
    issues.push({ level: "error", path, message: "Expected an object; using defaults." });
    return {};
  }

  return value;
}

function readArray(value: unknown, path: string, issues: ConfigIssue[]): unknown[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push({ level: "error", path, message: "Expected an array; using an empty list." });
    return [];
  }

  return value;
}

function issueFromZod(pathPrefix: string, error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({
    level: "error",
    path: [pathPrefix, ...issue.path.map(String)].filter(Boolean).join("."),
    message: issue.message
  }));
}

function parseWithDefault<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T,
  path: string,
  issues: ConfigIssue[]
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  issues.push(...issueFromZod(path, parsed.error));
  return fallback;
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (trimmed === "") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeField(field: FieldConfig, path: string, warnings: ConfigIssue[]): FieldConfig {
  if (field.type === "enum" && (!field.options || field.options.length === 0)) {
    warnings.push({
      level: "warning",
      path,
      message: "Enum field has no options; treating it as a free-text string."
    });
    return { ...field, type: "string", options: undefined };
  }

  return field;
}

function normalizePages(pages: PageConfig[], warnings: ConfigIssue[]): PageConfig[] {
  const byRoute = new Map<string, PageConfig>();

  pages.forEach((page, index) => {
    const route = normalizeRoute(page.route);
    const normalizedPage = { ...page, route };
    if (byRoute.has(route)) {
      warnings.push({
        level: "warning",
        path: `ui.pages.${index}.route`,
        message: `Duplicate route "${route}" found; keeping the last page.`
      });
    }
    byRoute.set(route, normalizedPage);

    page.components.forEach((component, componentIndex) => {
      if (!componentTypes.has(component.type)) {
        warnings.push({
          level: "warning",
          path: `ui.pages.${index}.components.${componentIndex}.type`,
          message: `Unknown component type "${component.type}" will render with a fallback tile.`
        });
      }
    });
  });

  return Array.from(byRoute.values());
}

export class ConfigEngine {
  normalize(raw: unknown): ConfigEngineResult {
    const errors: ConfigIssue[] = [];
    const warnings: ConfigIssue[] = [];
    const root = readObject(raw, "config", errors);

    const appInput = readObject(root.app, "app", errors);
    const locale = parseWithDefault(z.string().min(2), appInput.locale, "en", "app.locale", errors);
    const localesInput = appInput.locales === undefined ? [locale] : appInput.locales;
    const app = parseWithDefault(
      appConfigSchema.shape.app,
      { ...appInput, locale, locales: localesInput },
      { name: "Untitled App", theme: "dark", locale: "en", locales: ["en"] },
      "app",
      errors
    );

    if (app.theme !== "dark") {
      warnings.push({
        level: "warning",
        path: "app.theme",
        message: `Theme is set to "${app.theme}". Non-dark themes are coming soon; current runtime uses Editorial Dark.`
      });
    }

    if (!appInput.name || String(appInput.name).trim() === "") {
      errors.push({
        level: "error",
        path: "app.name",
        message: "Application name is required and cannot be empty."
      });
    }

    const auth = parseWithDefault(
      appConfigSchema.shape.auth,
      root.auth ?? {},
      { enabled: false, methods: [] },
      "auth",
      errors
    );

    const databaseInput = readObject(root.database, "database", errors);
    const rawTables = readArray(databaseInput.tables, "database.tables", errors);
    const tableNames = new Set<string>();
    const tables = rawTables
      .map((table, index) => parseWithDefault(databaseTableSchema, table, undefined, `database.tables.${index}`, errors))
      .filter((table): table is DatabaseTableConfig => table !== undefined)
      .map((table, tableIndex) => {
        if (tableNames.has(table.name)) {
          errors.push({
            level: "error",
            path: `database.tables.${tableIndex}.name`,
            message: `Duplicate database table name "${table.name}" found.`
          });
        }
        tableNames.add(table.name);

        const fieldNames = new Set<string>();
        const mappedFields = table.fields.map((field, fieldIndex) => {
          if (fieldNames.has(field.name)) {
            errors.push({
              level: "error",
              path: `database.tables.${tableIndex}.fields.${fieldIndex}.name`,
              message: `Duplicate field name "${field.name}" found in table "${table.name}".`
            });
          }
          fieldNames.add(field.name);

          const allowedTypes = ["string", "text", "number", "boolean", "date", "enum"];
          if (!allowedTypes.includes(field.type)) {
            errors.push({
              level: "error",
              path: `database.tables.${tableIndex}.fields.${fieldIndex}.type`,
              message: `Unknown field type "${field.type}" found in table "${table.name}".`
            });
          }

          return normalizeField(field, `database.tables.${tableIndex}.fields.${fieldIndex}`, warnings);
        });

        return { ...table, fields: mappedFields };
      });

    const uiInput = readObject(root.ui, "ui", errors);
    if (root.ui === undefined) {
      warnings.push({
        level: "warning",
        path: "ui",
        message: "No UI key found; rendering the default empty dashboard."
      });
    }
    const rawPages = readArray(uiInput.pages, "ui.pages", errors);
    const parsedPages = rawPages
      .map((page, index) => parseWithDefault(pageConfigSchema, page, undefined, `ui.pages.${index}`, errors))
      .filter((page): page is PageConfig => page !== undefined);

    const apiInput = readObject(root.api, "api", errors);
    const rawEndpoints = readArray(apiInput.endpoints, "api.endpoints", errors);
    const endpoints = rawEndpoints
      .map((endpoint, index) => parseWithDefault(apiEndpointSchema, endpoint, undefined, `api.endpoints.${index}`, errors))
      .filter((endpoint): endpoint is ApiEndpointConfig => endpoint !== undefined);

    const appLocale = app.locale ?? "en";
    const normalizedLocales = app.locales && app.locales.length > 0 ? app.locales : [appLocale];
    const normalizedLocale = normalizedLocales.includes(appLocale) ? appLocale : normalizedLocales[0] ?? "en";
    const authEnabled = auth.enabled ?? false;
    const authMethods = auth.methods ?? [];
    const normalizedConfig: AppConfig = {
      app: {
        ...app,
        name: app.name ?? "Untitled App",
        theme: app.theme ?? "dark",
        locale: normalizedLocale,
        locales: normalizedLocales
      },
      auth: authEnabled ? { enabled: true, methods: authMethods } : { enabled: false, methods: [] },
      database: { tables },
      ui: { pages: normalizePages(parsedPages, warnings) },
      api: { endpoints }
    };

    const finalParse = appConfigSchema.safeParse(normalizedConfig);
    if (!finalParse.success) {
      errors.push(...issueFromZod("config", finalParse.error));
      return {
        config: appConfigSchema.parse({
          app: { name: "Untitled App", theme: "dark", locale: "en", locales: ["en"] },
          auth: { enabled: false, methods: [] },
          database: { tables: [] },
          ui: { pages: [] },
          api: { endpoints: [] }
        }),
        errors,
        warnings
      };
    }

    return {
      config: finalParse.data,
      errors,
      warnings
    };
  }
}

export function normalizeAppConfig(raw: unknown): ConfigEngineResult {
  return new ConfigEngine().normalize(raw);
}
