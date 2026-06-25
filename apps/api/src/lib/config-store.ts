import demoConfig from "../../../../configs/example-app.json" with { type: "json" };
import { normalizeAppConfig, type AppConfig, type ConfigEngineResult } from "@genstack/config-types";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

const CONFIG_DB_KEY = "active_config";
let currentResult: ConfigEngineResult = normalizeAppConfig(demoConfig);

export function getCurrentConfig(): AppConfig {
  return currentResult.config;
}

export function getCurrentConfigResult(): ConfigEngineResult {
  return currentResult;
}

export function applyConfig(rawConfig: unknown): ConfigEngineResult {
  currentResult = normalizeAppConfig(rawConfig);
  
  prisma.appState
    .upsert({
      where: { key: CONFIG_DB_KEY },
      update: { value: currentResult.config as any },
      create: { key: CONFIG_DB_KEY, value: currentResult.config as any }
    })
    .catch((error: unknown) => {
      logger.error({ error }, "Failed to persist config to database");
    });

  return currentResult;
}

export function resetConfig(): ConfigEngineResult {
  currentResult = normalizeAppConfig(demoConfig);

  prisma.appState
    .upsert({
      where: { key: CONFIG_DB_KEY },
      update: { value: currentResult.config as any },
      create: { key: CONFIG_DB_KEY, value: currentResult.config as any }
    })
    .catch((error: unknown) => {
      logger.error({ error }, "Failed to reset config in database");
    });

  return currentResult;
}

export async function getConfigHistory(): Promise<any[]> {
  try {
    const record = await prisma.appState.findUnique({ where: { key: "config_history" } });
    if (record && Array.isArray(record.value)) {
      return record.value;
    }
  } catch (error: unknown) {
    logger.error({ error }, "Failed to fetch config history");
  }
  return [];
}

export async function addConfigHistoryEntry(config: AppConfig, message: string, changes: string[]): Promise<number> {
  const current = await getConfigHistory();
  const nextVersion = current.length + 1;
  const entry = {
    version: nextVersion,
    config,
    timestamp: new Date().toISOString(),
    message,
    changes
  };
  const next = [...current, entry];
  await prisma.appState.upsert({
    where: { key: "config_history" },
    update: { value: next as any },
    create: { key: "config_history", value: next as any }
  });
  return nextVersion;
}

export async function restoreConfigVersion(version: number): Promise<ConfigEngineResult> {
  const history = await getConfigHistory();
  const entry = history.find((e) => e.version === version);
  if (!entry) {
    throw new Error(`Version ${version} not found in history.`);
  }
  const result = applyConfig(entry.config);
  return result;
}

export async function getRuntimeActivities(): Promise<any[]> {
  try {
    const record = await prisma.appState.findUnique({ where: { key: "runtime_activities" } });
    if (record && Array.isArray(record.value)) {
      return record.value;
    }
  } catch (error: unknown) {
    logger.error({ error }, "Failed to fetch runtime activities");
  }
  return [];
}

export async function addRuntimeActivity(type: string, message: string): Promise<void> {
  try {
    const current = await getRuntimeActivities();
    const next = [...current, { type, message, timestamp: new Date().toISOString() }];
    await prisma.appState.upsert({
      where: { key: "runtime_activities" },
      update: { value: next as any },
      create: { key: "runtime_activities", value: next as any }
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to record runtime activity");
  }
}

export async function initializeConfigStore(): Promise<void> {
  try {
    const record = await prisma.appState.findUnique({
      where: { key: CONFIG_DB_KEY }
    });

    if (record && record.value) {
      currentResult = normalizeAppConfig(record.value);
      logger.info("Loaded active config from database");
    } else {
      await prisma.appState.upsert({
        where: { key: CONFIG_DB_KEY },
        update: { value: currentResult.config as any },
        create: { key: CONFIG_DB_KEY, value: currentResult.config as any }
      });
      logger.info("Seeded default config in database");
    }

    // Seed Config History if empty
    const historyRecord = await prisma.appState.findUnique({ where: { key: "config_history" } });
    if (!historyRecord) {
      await prisma.appState.upsert({
        where: { key: "config_history" },
        update: {},
        create: {
          key: "config_history",
          value: [{
            version: 1,
            config: currentResult.config,
            timestamp: new Date().toISOString(),
            message: "Initial setup",
            changes: ["✓ Initial configuration loaded"]
          }] as any
        }
      });
      logger.info("Seeded initial config version in history");
    }

    // Seed Runtime Activities if empty
    const activityRecord = await prisma.appState.findUnique({ where: { key: "runtime_activities" } });
    if (!activityRecord) {
      await prisma.appState.upsert({
        where: { key: "runtime_activities" },
        update: {},
        create: {
          key: "runtime_activities",
          value: [{
            type: "RUNTIME_STARTED",
            message: "Runtime environment initialized successfully",
            timestamp: new Date().toISOString()
          }] as any
        }
      });
      logger.info("Seeded initial runtime activity");
    }
  } catch (error: unknown) {
    logger.error({ error }, "Failed to initialize config from database; using demo fallback");
  }
}
