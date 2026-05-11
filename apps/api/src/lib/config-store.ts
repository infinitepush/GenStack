import demoConfig from "../../../../configs/example-app.json" with { type: "json" };
import { normalizeAppConfig, type AppConfig, type ConfigEngineResult } from "@genstack/config-types";

let currentResult: ConfigEngineResult = normalizeAppConfig(demoConfig);

export function getCurrentConfig(): AppConfig {
  return currentResult.config;
}

export function getCurrentConfigResult(): ConfigEngineResult {
  return currentResult;
}

export function applyConfig(rawConfig: unknown): ConfigEngineResult {
  currentResult = normalizeAppConfig(rawConfig);
  return currentResult;
}

export function resetConfig(): ConfigEngineResult {
  currentResult = normalizeAppConfig(demoConfig);
  return currentResult;
}
