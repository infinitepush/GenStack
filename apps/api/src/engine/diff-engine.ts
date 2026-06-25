import type { AppConfig } from "@genstack/config-types";

function keyFor(prefix: string, value: string): string {
  return `${prefix}_${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item"}`;
}

export function diffConfigs(oldConfig: AppConfig | null, newConfig: AppConfig): string[] {
  const changes: string[] = [];
  if (!oldConfig) {
    changes.push("✓ Initial configuration applied");
    return changes;
  }

  // App Meta
  if (oldConfig.app.name !== newConfig.app.name) {
    changes.push(`✓ Application name updated to "${newConfig.app.name}"`);
  }
  if (oldConfig.app.theme !== newConfig.app.theme) {
    changes.push(`✓ Theme updated to ${newConfig.app.theme}`);
  }
  if (oldConfig.app.locale !== newConfig.app.locale) {
    changes.push(`✓ Default locale updated to ${newConfig.app.locale}`);
  }

  // Pages
  const oldPages = oldConfig.ui.pages || [];
  const newPages = newConfig.ui.pages || [];
  const oldPageRoutes = oldPages.map(p => p.route);
  const newPageRoutes = newPages.map(p => p.route);

  newPages.forEach(p => {
    if (!oldPageRoutes.includes(p.route)) {
      changes.push(`✓ Added page: ${p.name}`);
    }
  });
  oldPages.forEach(p => {
    if (!newPageRoutes.includes(p.route)) {
      changes.push(`✓ Removed page: ${p.name}`);
    }
  });

  // Tables
  const oldTables = oldConfig.database.tables || [];
  const newTables = newConfig.database.tables || [];
  const oldTableNames = oldTables.map(t => t.name);
  const newTableNames = newTables.map(t => t.name);

  newTables.forEach(t => {
    if (!oldTableNames.includes(t.name)) {
      changes.push(`✓ Added table: ${t.name}`);
    } else {
      const oldTable = oldTables.find(ot => ot.name === t.name)!;
      const oldFieldNames = oldTable.fields.map(f => f.name);
      const newFieldNames = t.fields.map(f => f.name);

      const addedFields = t.fields.filter(f => !oldFieldNames.includes(f.name));
      const removedFields = oldTable.fields.filter(f => !newFieldNames.includes(f.name));

      if (addedFields.length > 0 || removedFields.length > 0) {
        const parts: string[] = [];
        if (addedFields.length > 0) parts.push(`${addedFields.length} field(s) added`);
        if (removedFields.length > 0) parts.push(`${removedFields.length} field(s) removed`);
        changes.push(`✓ Modified schema: ${t.name} (${parts.join(", ")})`);
      }
    }
  });

  oldTables.forEach(t => {
    if (!newTableNames.includes(t.name)) {
      changes.push(`✓ Removed table: ${t.name}`);
    }
  });

  // Endpoints
  const oldEndpoints = oldConfig.api.endpoints || [];
  const newEndpoints = newConfig.api.endpoints || [];
  const oldEndpointKeys = oldEndpoints.map(e => `${e.method} ${e.path}`);
  const newEndpointKeys = newEndpoints.map(e => `${e.method} ${e.path}`);

  newEndpoints.forEach(e => {
    const key = `${e.method} ${e.path}`;
    if (!oldEndpointKeys.includes(key)) {
      changes.push(`✓ Added endpoint: ${key}`);
    }
  });

  oldEndpoints.forEach(e => {
    const key = `${e.method} ${e.path}`;
    if (!newEndpointKeys.includes(key)) {
      changes.push(`✓ Removed endpoint: ${key}`);
    }
  });

  return changes;
}
