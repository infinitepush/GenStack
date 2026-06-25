import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { normalizeAppConfig } from "@genstack/config-types";
import { getExportJob, startGitHubExport, type ExportJob } from "../engine/github-exporter.js";
import { exportProjectAsZip } from "../engine/zip-exporter.js";
import type { ApiResponse } from "../engine/types.js";

const exportSchema = z.object({
  repoName: z.string().min(1),
  token: z.string().min(1),
  config: z.unknown()
});

export function createExportRouter(): Router {
  const router = Router();

  router.post("/github", (request: Request, response: Response<ApiResponse<ExportJob>>) => {
    const parsed = exportSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ success: false, data: null, error: { code: "INVALID_EXPORT", message: parsed.error.issues[0]?.message ?? "Invalid export request." } });
      return;
    }

    response.status(202).json({
      success: true,
      data: startGitHubExport({
        repoName: parsed.data.repoName,
        token: parsed.data.token,
        config: normalizeAppConfig(parsed.data.config).config,
        userId: request.userId
      }),
      error: null
    });
  });

  router.post("/zip", async (request: Request, response: Response) => {
    try {
      const config = normalizeAppConfig(request.body.config).config;
      const buffer = await exportProjectAsZip(config);
      
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", `attachment; filename="${config.app.name || "generated-app"}.zip"`);
      response.status(200).send(buffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate ZIP archive.";
      response.status(500).json({ success: false, data: null, error: { code: "ZIP_EXPORT_FAILED", message } });
    }
  });

  router.get("/status/:id", (request: Request, response: Response<ApiResponse<ExportJob>>) => {
    const id = request.params.id;
    if (typeof id !== "string") {
      response.status(400).json({ success: false, data: null, error: { code: "EXPORT_ID_REQUIRED", message: "Export id is required." } });
      return;
    }
    const job = getExportJob(id, request.userId);
    if (!job) {
      response.status(404).json({ success: false, data: null, error: { code: "EXPORT_NOT_FOUND", message: "Export job not found." } });
      return;
    }
    response.json({ success: true, data: job, error: null });
  });

  return router;
}
