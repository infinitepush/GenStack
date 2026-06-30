import demoConfig from "../../../../configs/example-app.json" with { type: "json" };
import { normalizeAppConfig, type AppConfig, type ConfigEngineResult } from "@genstack/config-types";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

const CONFIG_DB_KEY = "active_config";
const userConfigs = new Map<string, ConfigEngineResult>();

export function getCurrentConfig(userId?: string): AppConfig {
  return getCurrentConfigResult(userId).config;
}

export function getCurrentConfigResult(userId?: string): ConfigEngineResult {
  const resolvedId = userId || "default-user";
  const result = userConfigs.get(resolvedId);
  return result || normalizeAppConfig(demoConfig);
}

export async function loadUserConfig(userId: string): Promise<ConfigEngineResult> {
  const key = `user:${userId}:active_config`;
  let result = userConfigs.get(userId);
  if (result) {
    return result;
  }

  try {
    const record = await prisma.appState.findUnique({
      where: { key }
    });

    if (record && record.value) {
      result = normalizeAppConfig(record.value);
      logger.info({ userId }, "Loaded user config from database");
    } else {
      // Seed default config in database for the user
      result = normalizeAppConfig(demoConfig);
      await prisma.appState.upsert({
        where: { key },
        update: { value: result.config as any },
        create: { key, value: result.config as any }
      });
      logger.info({ userId }, "Seeded default config in database for user");

      // Seed history for the user
      const historyKey = `user:${userId}:config_history`;
      await prisma.appState.upsert({
        where: { key: historyKey },
        update: {},
        create: {
          key: historyKey,
          value: [{
            version: 1,
            config: result.config,
            timestamp: new Date().toISOString(),
            message: "Initial setup",
            changes: ["✓ Initial configuration loaded"]
          }] as any
        }
      });

      // Seed runtime activities for the user
      const activityKey = `user:${userId}:runtime_activities`;
      await prisma.appState.upsert({
        where: { key: activityKey },
        update: {},
        create: {
          key: activityKey,
          value: [{
            type: "RUNTIME_STARTED",
            message: "Runtime environment initialized successfully",
            timestamp: new Date().toISOString()
          }] as any
        }
      });
    }

    userConfigs.set(userId, result);
    return result;
  } catch (error: unknown) {
    logger.error({ error, userId }, "Failed to load config for user from database");
    const fallback = normalizeAppConfig(demoConfig);
    userConfigs.set(userId, fallback);
    return fallback;
  }
}

export function applyConfig(rawConfig: unknown, userId?: string): ConfigEngineResult {
  const result = normalizeAppConfig(rawConfig);
  const resolvedId = userId || "default-user";
  userConfigs.set(resolvedId, result);

  const key = resolvedId === "default-user" ? CONFIG_DB_KEY : `user:${resolvedId}:active_config`;

  prisma.appState
    .upsert({
      where: { key },
      update: { value: result.config as any },
      create: { key, value: result.config as any }
    })
    .catch((error: unknown) => {
      logger.error({ error, userId: resolvedId }, "Failed to persist config to database");
    });

  return result;
}

export function resetConfig(userId?: string): ConfigEngineResult {
  const result = normalizeAppConfig(demoConfig);
  const resolvedId = userId || "default-user";
  userConfigs.set(resolvedId, result);

  const key = resolvedId === "default-user" ? CONFIG_DB_KEY : `user:${resolvedId}:active_config`;

  prisma.appState
    .upsert({
      where: { key },
      update: { value: result.config as any },
      create: { key, value: result.config as any }
    })
    .catch((error: unknown) => {
      logger.error({ error, userId: resolvedId }, "Failed to reset config in database");
    });

  return result;
}

export async function getConfigHistory(userId?: string): Promise<any[]> {
  const resolvedId = userId || "default-user";
  const key = resolvedId === "default-user" ? "config_history" : `user:${resolvedId}:config_history`;
  try {
    const record = await prisma.appState.findUnique({ where: { key } });
    if (record && Array.isArray(record.value)) {
      return record.value;
    }
  } catch (error: unknown) {
    logger.error({ error, userId: resolvedId }, "Failed to fetch config history");
  }
  return [];
}

export async function addConfigHistoryEntry(
  config: AppConfig,
  message: string,
  changes: string[],
  userId?: string
): Promise<number> {
  const resolvedId = userId || "default-user";
  const key = resolvedId === "default-user" ? "config_history" : `user:${resolvedId}:config_history`;
  const current = await getConfigHistory(userId);
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
    where: { key },
    update: { value: next as any },
    create: { key, value: next as any }
  });
  return nextVersion;
}

export async function restoreConfigVersion(version: number, userId?: string): Promise<ConfigEngineResult> {
  const history = await getConfigHistory(userId);
  const entry = history.find((e) => e.version === version);
  if (!entry) {
    throw new Error(`Version ${version} not found in history.`);
  }
  const result = applyConfig(entry.config, userId);
  return result;
}

export async function getRuntimeActivities(userId?: string): Promise<any[]> {
  const resolvedId = userId || "default-user";
  const key = resolvedId === "default-user" ? "runtime_activities" : `user:${resolvedId}:runtime_activities`;
  try {
    const record = await prisma.appState.findUnique({ where: { key } });
    if (record && Array.isArray(record.value)) {
      return record.value;
    }
  } catch (error: unknown) {
    logger.error({ error, userId: resolvedId }, "Failed to fetch runtime activities");
  }
  return [];
}

export async function addRuntimeActivity(type: string, message: string, userId?: string): Promise<void> {
  const resolvedId = userId || "default-user";
  const key = resolvedId === "default-user" ? "runtime_activities" : `user:${resolvedId}:runtime_activities`;
  try {
    const current = await getRuntimeActivities(userId);
    const next = [...current, { type, message, timestamp: new Date().toISOString() }];
    await prisma.appState.upsert({
      where: { key },
      update: { value: next as any },
      create: { key, value: next as any }
    });
  } catch (error: unknown) {
    logger.error({ error, userId: resolvedId }, "Failed to record runtime activity");
  }
}

export async function initializeConfigStore(): Promise<void> {
  try {
    const record = await prisma.appState.findUnique({
      where: { key: CONFIG_DB_KEY }
    });

    let defaultResult: ConfigEngineResult;
    if (record && record.value) {
      defaultResult = normalizeAppConfig(record.value);
      logger.info("Loaded active config from database");
    } else {
      defaultResult = normalizeAppConfig(demoConfig);
      await prisma.appState.upsert({
        where: { key: CONFIG_DB_KEY },
        update: { value: defaultResult.config as any },
        create: { key: CONFIG_DB_KEY, value: defaultResult.config as any }
      });
      logger.info("Seeded default config in database");
    }
    userConfigs.set("default-user", defaultResult);

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
            config: defaultResult.config,
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

export async function getUserData(userId: string, keySuffix: string): Promise<any> {
  const key = `user:${userId}:${keySuffix}`;
  try {
    const record = await prisma.appState.findUnique({ where: { key } });
    return record?.value ?? null;
  } catch (error: unknown) {
    logger.error({ error, userId, keySuffix }, "Failed to load user data");
    return null;
  }
}

export async function saveUserData(userId: string, keySuffix: string, value: any): Promise<void> {
  const key = `user:${userId}:${keySuffix}`;
  try {
    await prisma.appState.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any }
    });
  } catch (error: unknown) {
    logger.error({ error, userId, keySuffix }, "Failed to save user data");
  }
}

