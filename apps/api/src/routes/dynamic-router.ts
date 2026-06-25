import type { ApiEndpointConfig } from "@genstack/config-types";
import { Router, type Request, type Response } from "express";
import {
  createRuntimeRecord,
  deleteRuntimeRecord,
  listRuntimeRecords,
  updateRuntimeRecord
} from "../engine/runtime-store.js";
import { getCurrentConfig } from "../lib/config-store.js";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: string[]; method?: string; path?: string; available?: string[] } | null;
}

interface EndpointMatch {
  endpoint: ApiEndpointConfig;
  params: Record<string, string>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchPath(pattern: string, requestPath: string): Record<string, string> | null {
  const names: string[] = [];
  const parts = pattern.split("/").filter(Boolean);
  const expression = parts
    .map((part) => {
      if (part.startsWith(":")) {
        names.push(part.slice(1));
        return "([^/]+)";
      }
      return escapeRegex(part);
    })
    .join("/");
  const regex = new RegExp(`^/${expression}$`);
  const match = regex.exec(requestPath);
  if (!match) {
    return null;
  }

  return names.reduce<Record<string, string>>((params, name, index) => {
    params[name] = decodeURIComponent(match[index + 1] ?? "");
    return params;
  }, {});
}

function normalizeRuntimePath(path: string): string {
  const withoutRuntimePrefix = path.replace(/^\/runtime(?=\/|$)/, "");
  const normalized = withoutRuntimePrefix === "" ? "/" : withoutRuntimePrefix;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function findEndpoint(method: string, requestPath: string): EndpointMatch | undefined {
  const config = getCurrentConfig();
  const normalizedPath = normalizeRuntimePath(requestPath);
  for (const endpoint of config.api.endpoints) {
    if (endpoint.method !== method.toUpperCase()) {
      continue;
    }
    const params = matchPath(endpoint.path, normalizedPath);
    if (params) {
      return { endpoint, params };
    }
  }
  return undefined;
}

function queryFilters(request: Request): Record<string, string> {
  return Object.entries(request.query).reduce<Record<string, string>>((filters, [key, value]) => {
    if (typeof value === "string") {
      filters[key] = value;
    }
    return filters;
  }, {});
}

function sendError(
  response: Response<ApiResponse<unknown>>,
  status: number,
  code: string,
  message: string,
  details?: string[]
): void {
  const error = details ? { code, message, details } : { code, message };
  response.status(status).json({ success: false, data: null, error });
}

function sendEndpointNotFound(response: Response<ApiResponse<unknown>>, method: string, path: string): void {
  const config = getCurrentConfig();
  const normalizedPath = normalizeRuntimePath(path);
  const available = config.api.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
  response.status(404).json({
    success: false,
    data: null,
    error: {
      code: "DYNAMIC_ENDPOINT_NOT_FOUND",
      message: "Endpoint not defined in config.",
      method: method.toUpperCase(),
      path: normalizedPath,
      available
    }
  });
}

export function createDynamicRouter(): Router {
  const router = Router();

  router.use(async (request: Request, response: Response<ApiResponse<unknown>>) => {
    try {
      const requestPath = normalizeRuntimePath(request.path);
      const match = findEndpoint(request.method, requestPath);
      if (!match) {
        sendEndpointNotFound(response, request.method, requestPath);
        return;
      }

      const config = getCurrentConfig();
      const { endpoint, params } = match;
      const userId = typeof request.headers["x-user-id"] === "string" ? request.headers["x-user-id"] : undefined;

      if (endpoint.method === "GET") {
        const result = await listRuntimeRecords(config, endpoint.table, queryFilters(request), userId);
        if (result.error) {
          sendError(response, 400, "UNKNOWN_TABLE", result.error);
          return;
        }
        response.json({ success: true, data: result.records, error: null });
        return;
      }

      if (endpoint.method === "POST") {
        const result = await createRuntimeRecord(config, endpoint.table, request.body, userId);
        if (result.error) {
          sendError(response, 400, "UNKNOWN_TABLE", result.error);
          return;
        }
        if (result.errors) {
          sendError(response, 422, "VALIDATION_ERROR", "Record failed config validation.", result.errors);
          return;
        }
        response.status(201).json({ success: true, data: result.record ?? null, error: null });
        return;
      }

      const id = params.id;
      if (!id) {
        sendError(response, 400, "MISSING_RECORD_ID", `${endpoint.method} endpoints must include an :id path param.`);
        return;
      }

      if (endpoint.method === "PUT") {
        const result = await updateRuntimeRecord(config, endpoint.table, id, request.body, userId);
        if (result.error) {
          sendError(response, 404, "RECORD_NOT_FOUND", result.error);
          return;
        }
        if (result.errors) {
          sendError(response, 422, "VALIDATION_ERROR", "Record failed config validation.", result.errors);
          return;
        }
        response.json({ success: true, data: result.record ?? null, error: null });
        return;
      }

      if (endpoint.method === "DELETE") {
        const result = await deleteRuntimeRecord(config, endpoint.table, id, userId);
        if (result.error) {
          sendError(response, 404, "RECORD_NOT_FOUND", result.error);
          return;
        }
        response.json({ success: true, data: { id: result.id }, error: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected dynamic runtime error.";
      sendError(response, 500, "DYNAMIC_RUNTIME_ERROR", message);
    }
  });

  return router;
}
