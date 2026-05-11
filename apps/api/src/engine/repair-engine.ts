import {
  normalizeAppConfig,
  type ApiEndpointConfig,
  type AppConfig,
  type ComponentConfig,
  type DatabaseTableConfig,
  type FieldConfig
} from "@genstack/config-types";
import type { RepairChange, RepairResult, ValidationFinding } from "./types.js";

const componentDataKeys = ["dataSource", "source", "target"] as const;
const supportedComponents = new Set(["form", "table", "stat_card", "chart"]);
const fieldTypeAliases = new Map<string, FieldConfig["type"]>([
  ["varchar", "string"],
  ["email", "string"],
  ["url", "string"],
  ["phone", "string"],
  ["uuid", "string"],
  ["integer", "number"],
  ["int", "number"],
  ["float", "number"],
  ["decimal", "number"],
  ["currency", "number"],
  ["money", "number"],
  ["datetime", "date"],
  ["timestamp", "date"],
  ["select", "enum"],
  ["status", "enum"]
]);

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeRawConfig(value: unknown, changes: RepairChange[]): unknown {
  if (!isObject(value)) {
    return value;
  }

  const clone: Record<string, unknown> = { ...value };
  const database = clone.database;
  if (!isObject(database) || !Array.isArray(database.tables)) {
    return clone;
  }

  clone.database = {
    ...database,
    tables: database.tables.map((table, tableIndex) => {
      if (!isObject(table) || !Array.isArray(table.fields)) {
        return table;
      }

      return {
        ...table,
        fields: table.fields.map((field, fieldIndex) => {
          if (!isObject(field)) {
            return field;
          }
          const rawType = getString(field.type)?.toLowerCase();
          const mappedType = rawType ? fieldTypeAliases.get(rawType) : undefined;
          if (!mappedType) {
            return field;
          }
          changes.push({
            path: `database.tables.${tableIndex}.fields.${fieldIndex}.type`,
            action: "coerced",
            message: `Mapped unsupported field type "${rawType}" to "${mappedType}".`
          });
          return { ...field, type: mappedType };
        })
      };
    })
  };

  return clone;
}

function dedupeFields(table: DatabaseTableConfig, tableIndex: number): { table: DatabaseTableConfig; changes: RepairChange[] } {
  const seen = new Set<string>();
  const fields: FieldConfig[] = [];
  const changes: RepairChange[] = [];

  table.fields.forEach((field, fieldIndex) => {
    if (seen.has(field.name)) {
      changes.push({
        path: `database.tables.${tableIndex}.fields.${fieldIndex}`,
        action: "deduplicated",
        message: `Removed duplicate field "${field.name}" from table "${table.name}".`
      });
      return;
    }
    seen.add(field.name);
    fields.push(field);
  });

  return { table: { ...table, fields }, changes };
}

function endpointKey(endpoint: ApiEndpointConfig): string {
  return `${endpoint.method} ${endpoint.path}`;
}

function endpointFor(table: string, method: ApiEndpointConfig["method"]): ApiEndpointConfig {
  return {
    method,
    path: method === "GET" || method === "POST" ? `/${table}` : `/${table}/:id`,
    table
  };
}

function inferTableName(config: AppConfig): string {
  const endpointTable = config.api.endpoints.find((endpoint) => endpoint.table.trim() !== "")?.table;
  if (endpointTable) {
    return endpointTable;
  }

  for (const page of config.ui.pages) {
    for (const component of page.components) {
      const source = componentDataKeys.map((key) => getString(component[key])).find(Boolean);
      if (source) {
        return source;
      }
    }
  }

  return "records";
}

function inferFieldsForTable(config: AppConfig, tableName: string): FieldConfig[] {
  const fieldNames = new Set<string>();

  config.ui.pages.forEach((page) => {
    page.components.forEach((component) => {
      const source = componentDataKeys.map((key) => getString(component[key])).find(Boolean);
      if (source && source !== tableName) {
        return;
      }
      getStringArray(component.fields).forEach((field) => fieldNames.add(field));
      getStringArray(component.columns).forEach((field) => fieldNames.add(field));
      const groupBy = getString(component.groupBy);
      const field = getString(component.field);
      if (groupBy) fieldNames.add(groupBy);
      if (field) fieldNames.add(field);
    });
  });

  if (fieldNames.size === 0) {
    ["title", "status", "value"].forEach((field) => fieldNames.add(field));
  }

  return Array.from(fieldNames).slice(0, 8).map((name, index): FieldConfig => {
    const lower = name.toLowerCase();
    if (["amount", "price", "value", "total", "cost", "quantity", "count"].some((token) => lower.includes(token))) {
      return { name, type: "number", required: index === 0 };
    }
    if (["date", "due", "deadline"].some((token) => lower.includes(token))) {
      return { name, type: "date", required: false };
    }
    if (["status", "stage", "priority", "category"].some((token) => lower.includes(token))) {
      return { name, type: "enum", required: index === 0, options: ["new", "active", "done"] };
    }
    return { name, type: "string", required: index === 0 };
  });
}

function ensureDataModel(config: AppConfig): { tables: DatabaseTableConfig[]; changes: RepairChange[] } {
  const changes: RepairChange[] = [];
  if (config.database.tables.length > 0) {
    return {
      tables: config.database.tables.map((table) => {
        if (table.fields.length > 0) {
          return table;
        }
        changes.push({
          path: `database.tables.${table.name}.fields`,
          action: "added",
          message: `Added safe default fields to table "${table.name}" because it had no fields.`
        });
        return {
          ...table,
          fields: [
            { name: "title", type: "string", required: true },
            { name: "status", type: "enum", required: false, options: ["new", "active", "done"] },
            { name: "value", type: "number", required: false }
          ]
        };
      }),
      changes
    };
  }

  const tableName = inferTableName(config);
  const table = {
    name: tableName,
    fields: inferFieldsForTable(config, tableName)
  };
  changes.push({
    path: "database.tables",
    action: "added",
    message: `Added inferred table "${tableName}" because the AI response did not include a data model.`
  });

  return { tables: [table], changes };
}

function repairEndpoints(config: AppConfig, findings: ValidationFinding[]): { endpoints: ApiEndpointConfig[]; changes: RepairChange[] } {
  const tableNames = new Set(config.database.tables.map((table) => table.name));
  const changes: RepairChange[] = [];
  const byKey = new Map<string, ApiEndpointConfig>();

  config.api.endpoints.forEach((endpoint, index) => {
    if (!tableNames.has(endpoint.table)) {
      findings.push({
        severity: "error",
        path: `api.endpoints.${index}.table`,
        message: `Endpoint references unknown table "${endpoint.table}".`
      });
      changes.push({
        path: `api.endpoints.${index}`,
        action: "removed",
        message: `Removed endpoint for unknown table "${endpoint.table}".`
      });
      return;
    }

    byKey.set(endpointKey(endpoint), endpoint);
  });

  config.database.tables.forEach((table) => {
    (["GET", "POST", "PUT", "DELETE"] as const).forEach((method) => {
      const candidate = endpointFor(table.name, method);
      if (!byKey.has(endpointKey(candidate))) {
        byKey.set(endpointKey(candidate), candidate);
        changes.push({
          path: "api.endpoints",
          action: "added",
          message: `Added ${method} endpoint for table "${table.name}".`
        });
      }
    });
  });

  return { endpoints: Array.from(byKey.values()), changes };
}

function normalizeComponent(component: ComponentConfig): { component: ComponentConfig | null; change?: RepairChange } {
  const next: Record<string, unknown> = { ...component };
  const originalType = component.type;

  const aliases: Record<string, string> = {
    data_table: "table",
    datatable: "table",
    list: "table",
    grid: "table",
    input_form: "form",
    create_form: "form",
    metric: "stat_card",
    card: "stat_card",
    bar_chart: "chart",
    line_chart: "chart"
  };

  const normalizedType = aliases[originalType] ?? originalType;
  if (!supportedComponents.has(normalizedType)) {
    return {
      component: null,
      change: {
        path: "ui.pages.components.type",
        action: "removed",
        message: `Removed unsupported component type "${originalType}".`
      }
    };
  }

  next.type = normalizedType;
  if (normalizedType !== originalType) {
    return {
      component: next as ComponentConfig,
      change: {
        path: "ui.pages.components.type",
        action: "coerced",
        message: `Mapped component type "${originalType}" to "${normalizedType}".`
      }
    };
  }

  return { component };
}

function defaultComponentsFor(table: DatabaseTableConfig): ComponentConfig[] {
  const fields = table.fields.map((field) => field.name);
  const numericField = table.fields.find((field) => field.type === "number")?.name;
  const groupField = table.fields.find((field) => field.type === "enum")?.name ?? fields[0] ?? "title";

  return [
    { type: "stat_card", label: "Total Records", aggregation: "count", source: table.name },
    { type: "table", dataSource: table.name, columns: fields.slice(0, 4) },
    { type: "form", target: table.name, fields },
    ...(numericField ? [{ type: "chart", chartType: "bar", source: table.name, groupBy: groupField, field: numericField, aggregation: "sum" }] : [])
  ];
}

function repairComponents(config: AppConfig, findings: ValidationFinding[]): { pages: AppConfig["ui"]["pages"]; changes: RepairChange[] } {
  const tableByName = new Map(config.database.tables.map((table) => [table.name, table]));
  const changes: RepairChange[] = [];
  const fallbackTable = config.database.tables[0];

  const repairTableReference = (
    next: Record<string, unknown>,
    key: "dataSource" | "source" | "target",
    pageIndex: number,
    componentIndex: number
  ): DatabaseTableConfig | undefined => {
    const tableName = getString(next[key]);
    if (tableName && tableByName.has(tableName)) {
      return tableByName.get(tableName);
    }
    if (!fallbackTable) {
      return undefined;
    }
    if (tableName) {
      findings.push({
        severity: "warning",
        path: `ui.pages.${pageIndex}.components.${componentIndex}.${key}`,
        message: `Component referenced unknown table "${tableName}"; using "${fallbackTable.name}" instead.`
      });
    }
    next[key] = fallbackTable.name;
    changes.push({
      path: `ui.pages.${pageIndex}.components.${componentIndex}.${key}`,
      action: tableName ? "coerced" : "defaulted",
      message: `${tableName ? "Replaced" : "Added"} ${key} with table "${fallbackTable.name}".`
    });
    return fallbackTable;
  };

  const knownFieldsFor = (table: DatabaseTableConfig | undefined): Set<string> =>
    new Set(table?.fields.map((field) => field.name) ?? []);

  const defaultColumnsFor = (table: DatabaseTableConfig | undefined): string[] =>
    table?.fields.map((field) => field.name).slice(0, 4) ?? [];

  const numericFieldFor = (table: DatabaseTableConfig | undefined): string | undefined =>
    table?.fields.find((field) => field.type === "number")?.name;

  const groupFieldFor = (table: DatabaseTableConfig | undefined): string | undefined =>
    table?.fields.find((field) => field.type === "enum")?.name ?? table?.fields[0]?.name;

  let pages = config.ui.pages.map((page, pageIndex) => ({
    ...page,
    components: page.components.flatMap((component, componentIndex): ComponentConfig[] => {
      const normalized = normalizeComponent(component);
      if (normalized.change) {
        changes.push({
          ...normalized.change,
          path: `ui.pages.${pageIndex}.components.${componentIndex}.type`
        });
      }
      if (!normalized.component) {
        return [];
      }
      component = normalized.component;
      const next: Record<string, unknown> = { ...component };

      if (component.type === "form") {
        const table = repairTableReference(next, "target", pageIndex, componentIndex);
        const knownFields = knownFieldsFor(table);
        const fields = getStringArray(next.fields);
        const filtered = fields.filter((field) => knownFields.has(field));
        const repairedFields = filtered.length > 0 ? filtered : table?.fields.map((field) => field.name) ?? [];
        if (fields.length !== repairedFields.length || fields.some((field, fieldIndex) => field !== repairedFields[fieldIndex])) {
          next.fields = repairedFields;
          changes.push({
            path: `ui.pages.${pageIndex}.components.${componentIndex}.fields`,
            action: filtered.length > 0 ? "removed" : "defaulted",
            message: `Repaired form fields for table "${table?.name ?? "unknown"}".`
          });
        }
      }

      if (component.type === "table") {
        const table = repairTableReference(next, "dataSource", pageIndex, componentIndex);
        const knownFields = knownFieldsFor(table);
        const columns = getStringArray(next.columns);
        const filtered = columns.filter((field) => knownFields.has(field));
        const repairedColumns = filtered.length > 0 ? filtered : defaultColumnsFor(table);
        if (columns.length !== repairedColumns.length || columns.some((column, columnIndex) => column !== repairedColumns[columnIndex])) {
          next.columns = repairedColumns;
          changes.push({
            path: `ui.pages.${pageIndex}.components.${componentIndex}.columns`,
            action: filtered.length > 0 ? "removed" : "defaulted",
            message: `Repaired table columns for table "${table?.name ?? "unknown"}".`
          });
        }
      }

      if (component.type === "stat_card") {
        const table = repairTableReference(next, "source", pageIndex, componentIndex);
        const aggregation = getString(next.aggregation) ?? "count";
        const numericField = numericFieldFor(table);
        if (!["count", "sum", "avg"].includes(aggregation)) {
          next.aggregation = "count";
          changes.push({
            path: `ui.pages.${pageIndex}.components.${componentIndex}.aggregation`,
            action: "coerced",
            message: "Changed unsupported stat aggregation to count."
          });
        }
        if ((next.aggregation === "sum" || next.aggregation === "avg") && !numericField) {
          next.aggregation = "count";
          delete next.field;
          changes.push({
            path: `ui.pages.${pageIndex}.components.${componentIndex}.aggregation`,
            action: "coerced",
            message: "Changed stat card to count because the table has no numeric field."
          });
        }
      }

      if (component.type === "chart") {
        const table = repairTableReference(next, "source", pageIndex, componentIndex);
        const numericField = numericFieldFor(table);
        const groupField = groupFieldFor(table);
        const aggregation = getString(next.aggregation) ?? (numericField ? "sum" : "count");
        const knownFields = knownFieldsFor(table);

        if (!getString(next.groupBy) || !knownFields.has(getString(next.groupBy) ?? "")) {
          next.groupBy = groupField;
          changes.push({
            path: `ui.pages.${pageIndex}.components.${componentIndex}.groupBy`,
            action: "defaulted",
            message: `Set chart groupBy to "${groupField ?? "unknown"}".`
          });
        }

        if ((aggregation === "sum" || aggregation === "avg") && numericField) {
          next.aggregation = aggregation;
          if (!getString(next.field) || !knownFields.has(getString(next.field) ?? "")) {
            next.field = numericField;
          }
        } else {
          next.aggregation = "count";
          next.field = numericField ?? groupField;
          changes.push({
            path: `ui.pages.${pageIndex}.components.${componentIndex}.aggregation`,
            action: "coerced",
            message: "Changed chart aggregation to count for runtime-safe analytics."
          });
        }
      }

      return [next as ComponentConfig];
    })
  }));

  if (pages.length === 0 && config.database.tables[0]) {
    pages = [
      {
        name: "Dashboard",
        route: "/dashboard",
        components: defaultComponentsFor(config.database.tables[0])
      }
    ];
    changes.push({
      path: "ui.pages",
      action: "added",
      message: "Added a Dashboard page because the AI response did not include renderable pages."
    });
  }

  pages = pages.map((page, pageIndex) => {
    if (page.components.length > 0 || !config.database.tables[0]) {
      return page;
    }
    changes.push({
      path: `ui.pages.${pageIndex}.components`,
      action: "added",
      message: `Added default dashboard components for table "${config.database.tables[0].name}".`
    });
    return { ...page, components: defaultComponentsFor(config.database.tables[0]) };
  });

  return { pages, changes };
}

export function repairAndValidateConfig(rawConfig: unknown): RepairResult {
  const changes: RepairChange[] = [];
  const normalized = normalizeAppConfig(sanitizeRawConfig(rawConfig, changes));
  const findings: ValidationFinding[] = [
    ...normalized.errors.map((issue) => ({ severity: "error" as const, path: issue.path, message: issue.message })),
    ...normalized.warnings.map((issue) => ({ severity: "warning" as const, path: issue.path, message: issue.message }))
  ];

  const dataModelRepair = ensureDataModel(normalized.config);
  changes.push(...dataModelRepair.changes);

  const dedupedTables = dataModelRepair.tables.map((table, tableIndex) => {
    const result = dedupeFields(table, tableIndex);
    changes.push(...result.changes);
    return result.table;
  });

  let repaired: AppConfig = {
    ...normalized.config,
    auth:
      normalized.config.auth.enabled && normalized.config.auth.methods.length === 0
        ? { enabled: true, methods: ["email"] }
        : normalized.config.auth,
    database: { tables: dedupedTables }
  };

  if (normalized.config.auth.enabled && normalized.config.auth.methods.length === 0) {
    changes.push({
      path: "auth.methods",
      action: "defaulted",
      message: "Enabled email auth because auth was enabled without methods."
    });
  }

  const endpointRepair = repairEndpoints(repaired, findings);
  repaired = { ...repaired, api: { endpoints: endpointRepair.endpoints } };
  changes.push(...endpointRepair.changes);

  const componentRepair = repairComponents(repaired, findings);
  repaired = { ...repaired, ui: { pages: componentRepair.pages } };
  changes.push(...componentRepair.changes);

  if (repaired.ui.pages.length === 0) {
    findings.push({
      severity: "info",
      path: "ui.pages",
      message: "No pages are configured; the frontend will render the default empty dashboard."
    });
  }

  return {
    config: repaired,
    findings,
    changes,
    configErrors: normalized.errors,
    configWarnings: normalized.warnings
  };
}
