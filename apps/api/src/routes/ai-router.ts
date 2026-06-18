import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { evaluateConfig } from "../engine/evaluation-engine.js";
import { PipelineEngine } from "../engine/pipeline-engine.js";
import { createAiProvider, LocalHeuristicProvider } from "../engine/providers.js";
import { repairAndValidateConfig } from "../engine/repair-engine.js";
import type { ApiResponse, EvaluationResult, PipelineRunResult, RepairResult } from "../engine/types.js";
import { logger } from "../lib/logger.js";

const generateSchema = z.object({
  prompt: z.string().min(1),
  seedConfig: z.unknown().optional()
});

const repairSchema = z.object({
  config: z.unknown(),
  prompt: z.string().optional()
});

function ok<T>(response: Response<ApiResponse<T>>, data: T): void {
  response.json({ success: true, data, error: null });
}

function fail(response: Response<ApiResponse<never>>, status: number, code: string, message: string): void {
  response.status(status).json({ success: false, data: null, error: { code, message } });
}

export function createAiRouter(): Router {
  const router = Router();

  router.get("/capabilities", (_request: Request, response: Response<ApiResponse<{ provider: string; model: string }>>) => {
    const provider = createAiProvider();
    ok(response, { provider: provider.name, model: provider.model });
  });

  router.post("/generate", async (request: Request, response: Response<ApiResponse<PipelineRunResult>>) => {
    const parsed = generateSchema.safeParse(request.body);
    if (!parsed.success) {
      fail(response as Response<ApiResponse<never>>, 400, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }

    try {
      const engine = new PipelineEngine();
      ok(response, await engine.run(parsed.data));
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("AI provider returned 429")) {
        logger.warn({ error: error.message }, "AI provider rate limited; using local fallback provider");
        const fallbackEngine = new PipelineEngine(new LocalHeuristicProvider());
        ok(response, await fallbackEngine.run(parsed.data));
        return;
      }

      logger.error({ error }, "AI pipeline failed");
      fail(
        response as Response<ApiResponse<never>>,
        500,
        "PIPELINE_FAILED",
        error instanceof Error ? error.message : "AI pipeline failed."
      );
    }
  });

  router.post("/repair", (request: Request, response: Response<ApiResponse<RepairResult>>) => {
    const parsed = repairSchema.safeParse(request.body);
    if (!parsed.success) {
      fail(response as Response<ApiResponse<never>>, 400, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }

    ok(response, repairAndValidateConfig(parsed.data.config));
  });

  router.post("/evaluate", (request: Request, response: Response<ApiResponse<EvaluationResult>>) => {
    const parsed = repairSchema.safeParse(request.body);
    if (!parsed.success) {
      fail(response as Response<ApiResponse<never>>, 400, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }

    const repair = repairAndValidateConfig(parsed.data.config);
    ok(response, evaluateConfig(repair.config, parsed.data.prompt));
  });

  return router;
}
