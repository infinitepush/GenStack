import { Router, type Request, type Response } from "express";
import { 
  getIntegrationSettings, 
  saveIntegrationSettings, 
  testIntegration,
  checkSheetsConnection,
  type IntegrationSettings 
} from "../engine/integrations-engine.js";
import type { ApiResponse } from "../engine/types.js";

export function createIntegrationsRouter(): Router {
  const router = Router();

  router.get("/", async (request: Request, response: Response<ApiResponse<IntegrationSettings>>) => {
    try {
      const data = await getIntegrationSettings(request.userId);
      response.json({ success: true, data, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load integrations";
      response.status(500).json({ success: false, data: null, error: { code: "LOAD_FAILED", message } });
    }
  });

  router.post("/", async (request: Request, response: Response<ApiResponse<IntegrationSettings>>) => {
    try {
      const updated = await saveIntegrationSettings(request.body, request.userId);
      response.json({ success: true, data: updated, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save integrations";
      response.status(500).json({ success: false, data: null, error: { code: "SAVE_FAILED", message } });
    }
  });

  router.post("/test", async (request: Request, response: Response) => {
    try {
      const { type, settings } = request.body;
      const res = await testIntegration(type, settings);
      response.json({ success: true, data: res, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to run integration test";
      response.status(500).json({ success: false, data: null, error: { code: "TEST_FAILED", message } });
    }
  });

  router.get("/sheets/status", async (request: Request, response: Response) => {
    try {
      const status = await checkSheetsConnection(request.userId);
      response.json({ success: true, data: status, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to retrieve sheets status";
      response.status(500).json({ success: false, data: null, error: { code: "STATUS_FAILED", message } });
    }
  });

  return router;
}
