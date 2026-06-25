import cors from "cors";
import "dotenv/config";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { createAiRouter } from "./routes/ai-router.js";
import {
  applyConfig,
  getCurrentConfig,
  getCurrentConfigResult,
  resetConfig,
  initializeConfigStore,
  getConfigHistory,
  addConfigHistoryEntry,
  restoreConfigVersion,
  getRuntimeActivities,
  addRuntimeActivity
} from "./lib/config-store.js";
import { diffConfigs } from "./engine/diff-engine.js";
import { prisma } from "./lib/prisma.js";
import { createI18nRouter } from "./routes/i18n-router.js";
import { createImportRouter } from "./routes/import-router.js";
import { createExportRouter } from "./routes/export-router.js";
import { createDynamicRouter } from "./routes/dynamic-router.js";
import { createIntegrationsRouter } from "./routes/integrations-router.js";
import { authMiddleware } from "./lib/auth-middleware.js";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

const app = express();
const port = Number.parseInt(process.env.PORT ?? process.env.API_PORT ?? "4000", 10);

const configuredOrigins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  if (configuredOrigins.includes(origin)) {
    return true;
  }
  return process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin);
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "6mb" }));
app.use(pinoHttp({ logger }));
app.use(authMiddleware);

app.get("/health", async (_request: Request, response: Response) => {
  try {
    // Dynamically check database connectivity with Prisma
    await prisma.appState.findFirst();
    response.json({
      success: true,
      data: {
        status: "ok",
        database: "healthy",
        ai: process.env.GEMINI_API_KEY ? "available" : "unavailable"
      },
      error: null
    });
  } catch (error: unknown) {
    logger.error({ error }, "Health check failed");
    response.status(500).json({
      success: false,
      data: {
        status: "degraded",
        database: "unhealthy",
        ai: process.env.GEMINI_API_KEY ? "available" : "unknown"
      },
      error: { code: "HEALTH_CHECK_FAILED", message: error instanceof Error ? error.message : "Health check failed" }
    });
  }
});

app.get("/config", (_request: Request, response: Response<ApiResponse<ReturnType<typeof getCurrentConfigResult>>>) => {
  response.json({ success: true, data: getCurrentConfigResult(), error: null });
});

app.post("/config", async (request: Request, response: Response) => {
  try {
    let origin = "Config Editor";
    if (request.query.origin === "ai-studio") {
      origin = "AI Studio";
    } else if (request.query.origin === "history-restore") {
      origin = "History Restore";
    }
    const oldConfig = getCurrentConfig();
    const result = applyConfig(request.body);
    const changes = diffConfigs(oldConfig, result.config);

    const version = await addConfigHistoryEntry(result.config, `Applied from ${origin}`, changes);
    if (request.query.origin === "history-restore") {
      await addRuntimeActivity("RUNTIME_RESTORED", `Restored config v1.0.${version} from sidebar history.`);
    } else {
      await addRuntimeActivity("CONFIG_APPLIED", `Applied config v1.0.${version} from ${origin}`);
    }

    response.json({
      success: true,
      data: {
        ...result,
        version,
        changes
      },
      error: null
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to apply config";
    response.status(400).json({ success: false, data: null, error: { code: "CONFIG_APPLY_FAILED", message } });
  }
});

app.post("/config/reset", async (_request: Request, response: Response) => {
  try {
    const oldConfig = getCurrentConfig();
    const result = resetConfig();
    const changes = diffConfigs(oldConfig, result.config);

    const version = await addConfigHistoryEntry(result.config, "Reset to demo baseline", changes);
    await addRuntimeActivity("CONFIG_RESTORED", `Reset config to demo baseline (v1.0.${version})`);

    response.json({
      success: true,
      data: {
        ...result,
        version,
        changes
      },
      error: null
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to reset config";
    response.status(500).json({ success: false, data: null, error: { code: "CONFIG_RESET_FAILED", message } });
  }
});

app.get("/config/history", async (_request: Request, response: Response) => {
  try {
    const history = await getConfigHistory();
    response.json({ success: true, data: history, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load history";
    response.status(500).json({ success: false, data: null, error: { code: "HISTORY_FAILED", message } });
  }
});

app.post("/config/restore", async (request: Request, response: Response) => {
  try {
    const { version } = request.body;
    if (typeof version !== "number") {
      response.status(400).json({ success: false, data: null, error: { code: "INVALID_VERSION", message: "Version must be a number." } });
      return;
    }
    const result = await restoreConfigVersion(version);
    await addRuntimeActivity("CONFIG_RESTORED", `Restored config v1.0.${version}`);
    response.json({ success: true, data: result, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to restore config";
    response.status(400).json({ success: false, data: null, error: { code: "RESTORE_FAILED", message } });
  }
});

app.get("/runtime/activities", async (_request: Request, response: Response) => {
  try {
    const activities = await getRuntimeActivities();
    response.json({ success: true, data: activities, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load activities";
    response.status(500).json({ success: false, data: null, error: { code: "ACTIVITIES_FAILED", message } });
  }
});

app.post("/runtime/activity", async (request: Request, response: Response) => {
  try {
    const { type, message } = request.body;
    if (!type || !message) {
      response.status(400).json({ success: false, data: null, error: { code: "INVALID_ACTIVITY", message: "Type and message are required." } });
      return;
    }
    await addRuntimeActivity(type, message);
    response.json({ success: true, data: null, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save activity";
    response.status(500).json({ success: false, data: null, error: { code: "ACTIVITY_FAILED", message } });
  }
});

app.use("/ai", createAiRouter());
app.use("/i18n", createI18nRouter());
app.use("/import", createImportRouter());
app.use("/export", createExportRouter());
app.use("/runtime", createDynamicRouter());
app.use("/integrations", createIntegrationsRouter());

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  response.status(500).json({
    success: false,
    data: null,
    error: { code: "INTERNAL_SERVER_ERROR", message }
  });
};

app.use(errorHandler);

await initializeConfigStore();
app.listen(port, () => {
  logger.info({ port }, "API server ready");
});
