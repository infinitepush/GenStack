import { Router, type Request, type Response } from "express";
import { getUserData, saveUserData } from "../lib/config-store.js";
import type { ApiResponse } from "../engine/types.js";

export function createUserDataRouter(): Router {
  const router = Router();

  router.get("/:key", async (request: Request, response: Response<ApiResponse<any>>) => {
    try {
      const userId = request.userId;
      const key = request.params.key;
      if (!userId || typeof userId !== "string") {
        response.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
        return;
      }
      if (!key || typeof key !== "string") {
        response.status(400).json({ success: false, data: null, error: { code: "BAD_REQUEST", message: "Key parameter is required." } });
        return;
      }
      const data = await getUserData(userId, key);
      response.json({ success: true, data, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load user data";
      response.status(500).json({ success: false, data: null, error: { code: "LOAD_FAILED", message } });
    }
  });

  router.post("/:key", async (request: Request, response: Response<ApiResponse<any>>) => {
    try {
      const userId = request.userId;
      const key = request.params.key;
      if (!userId || typeof userId !== "string") {
        response.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
        return;
      }
      if (!key || typeof key !== "string") {
        response.status(400).json({ success: false, data: null, error: { code: "BAD_REQUEST", message: "Key parameter is required." } });
        return;
      }
      await saveUserData(userId, key, request.body.value);
      response.json({ success: true, data: request.body.value, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save user data";
      response.status(500).json({ success: false, data: null, error: { code: "SAVE_FAILED", message } });
    }
  });

  return router;
}
