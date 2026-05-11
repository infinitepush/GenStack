import cors from "cors";
import "dotenv/config";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { createAiRouter } from "./routes/ai-router.js";
import { applyConfig, getCurrentConfigResult, resetConfig } from "./lib/config-store.js";
import { createI18nRouter } from "./routes/i18n-router.js";
import { createImportRouter } from "./routes/import-router.js";
import { createExportRouter } from "./routes/export-router.js";
import { createDynamicRouter } from "./routes/dynamic-router.js";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

const app = express();
const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);

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

app.get("/health", (_request: Request, response: Response<ApiResponse<{ status: string }>>) => {
  response.json({ success: true, data: { status: "ok" }, error: null });
});

app.get("/config", (_request: Request, response: Response<ApiResponse<ReturnType<typeof getCurrentConfigResult>>>) => {
  response.json({ success: true, data: getCurrentConfigResult(), error: null });
});

app.post("/config", (request: Request, response: Response<ApiResponse<ReturnType<typeof getCurrentConfigResult>>>) => {
  response.json({ success: true, data: applyConfig(request.body), error: null });
});

app.post("/config/reset", (_request: Request, response: Response<ApiResponse<ReturnType<typeof getCurrentConfigResult>>>) => {
  response.json({ success: true, data: resetConfig(), error: null });
});

app.use("/ai", createAiRouter());
app.use("/i18n", createI18nRouter());
app.use("/import", createImportRouter());
app.use("/export", createExportRouter());
app.use("/runtime", createDynamicRouter());

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  response.status(500).json({
    success: false,
    data: null,
    error: { code: "INTERNAL_SERVER_ERROR", message }
  });
};

app.use(errorHandler);

app.listen(port, () => {
  logger.info({ port }, "API server ready");
});
