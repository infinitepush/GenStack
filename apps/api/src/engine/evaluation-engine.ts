import type { AppConfig } from "@genstack/config-types";
import type { EvaluationMetric, EvaluationResult, ValidationFinding } from "./types.js";

function metric(key: string, label: string, score: number, maxScore: number, notes: string[]): EvaluationMetric {
  return { key, label, score: Math.max(0, Math.min(score, maxScore)), maxScore, notes };
}

function collectBlockers(config: AppConfig): ValidationFinding[] {
  const tableNames = new Set(config.database.tables.map((table) => table.name));
  const blockers: ValidationFinding[] = [];

  config.api.endpoints.forEach((endpoint, index) => {
    if (!tableNames.has(endpoint.table)) {
      blockers.push({
        severity: "error",
        path: `api.endpoints.${index}.table`,
        message: `Endpoint references unknown table "${endpoint.table}".`
      });
    }
  });

  return blockers;
}

function gradeFor(score: number): EvaluationResult["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function evaluateConfig(config: AppConfig): EvaluationResult {
  const blockers = collectBlockers(config);
  const hasTables = config.database.tables.length > 0;
  const hasFields = config.database.tables.every((table) => table.fields.length > 0);
  const hasPages = config.ui.pages.length > 0;
  const hasComponents = config.ui.pages.some((page) => page.components.length > 0);
  const endpointTables = new Set(config.api.endpoints.map((endpoint) => endpoint.table));
  const allTablesHaveEndpoints = config.database.tables.every((table) => endpointTables.has(table.name));

  const metrics: EvaluationMetric[] = [
    metric("validity", "Config validity", blockers.length === 0 ? 20 : 8, 20, blockers.map((blocker) => blocker.message)),
    metric("data_model", "Data model", hasTables && hasFields ? 20 : hasTables ? 12 : 0, 20, [
      hasTables ? `${config.database.tables.length} table(s) configured.` : "No database tables configured.",
      hasFields ? "All tables have fields." : "One or more tables have no fields."
    ]),
    metric("api_coverage", "API coverage", allTablesHaveEndpoints ? 15 : 7, 15, [
      allTablesHaveEndpoints ? "Every table has at least one endpoint." : "Some tables have no endpoint coverage."
    ]),
    metric("ui_runtime", "UI runtime", hasPages && hasComponents ? 20 : hasPages ? 12 : 4, 20, [
      hasPages ? `${config.ui.pages.length} page(s) configured.` : "No UI pages configured.",
      hasComponents ? "At least one page has components." : "No components configured."
    ]),
    metric("auth", "Auth readiness", config.auth.enabled ? 10 : 7, 10, [
      config.auth.enabled ? `Auth enabled via ${config.auth.methods.join(", ") || "no methods"}.` : "App is public."
    ]),
    metric("localization", "Localization", config.app.locales.length > 1 ? 10 : 6, 10, [
      `${config.app.locales.length} locale(s) configured.`
    ]),
    metric("safety", "Runtime safety", 5, 5, ["Unknown component types and malformed config are handled without crashing."])
  ];

  const score = metrics.reduce((total, item) => total + item.score, 0);
  const maxScore = metrics.reduce((total, item) => total + item.maxScore, 0);
  const recommendations = metrics
    .filter((item) => item.score < item.maxScore)
    .map((item) => `Improve ${item.label.toLowerCase()}: ${item.notes.join(" ")}`);

  return {
    score,
    maxScore,
    grade: gradeFor((score / maxScore) * 100),
    metrics,
    blockers,
    recommendations
  };
}
