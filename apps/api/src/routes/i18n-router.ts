import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { normalizeAppConfig } from "@genstack/config-types";
import { generateI18nMessages } from "../engine/i18n-generator.js";
import type { ApiResponse } from "../engine/types.js";
import { getCurrentConfig } from "../lib/config-store.js";

const requestSchema = z.object({
  config: z.unknown().optional()
});

export function createI18nRouter(): Router {
  const router = Router();

  router.post("/generate", (request: Request, response: Response<ApiResponse<Record<string, Record<string, string>>>>) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        success: false,
        data: null,
        error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid input." }
      });
      return;
    }

    const config = parsed.data.config == null ? getCurrentConfig() : normalizeAppConfig(parsed.data.config).config;
    response.json({
      success: true,
      data: generateI18nMessages(config),
      error: null
    });
  });

  return router;
}
