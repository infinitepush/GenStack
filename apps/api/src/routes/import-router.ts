import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import {
  createUploadSession,
  ingestCsvRows,
  previewCsvMapping,
  type CsvIngestResult,
  type CsvPreviewResult,
  type CsvUploadResult
} from "../engine/csv-ingestor.js";
import type { ApiResponse } from "../engine/types.js";
import { getCurrentConfig, addRuntimeActivity } from "../lib/config-store.js";
import { logger } from "../lib/logger.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".csv") && file.mimetype !== "text/csv") {
      callback(new Error("Only .csv files are supported."));
      return;
    }
    callback(null, true);
  }
});

const mapSchema = z.object({
  uploadId: z.string().min(1),
  tableName: z.string().min(1),
  mappings: z.record(z.string(), z.string())
});

function sendError(response: Response<ApiResponse<never>>, status: number, code: string, message: string): void {
  response.status(status).json({ success: false, data: null, error: { code, message } });
}

export function createImportRouter(): Router {
  const router = Router();

  router.post("/upload", (request: Request, response: Response<ApiResponse<CsvUploadResult>>) => {
    upload.single("file")(request, response, (error: unknown) => {
      if (error) {
        sendError(
          response as Response<ApiResponse<never>>,
          400,
          "CSV_UPLOAD_FAILED",
          error instanceof Error && error.message.includes("File too large")
            ? "CSV file is larger than 5MB."
            : error instanceof Error
              ? error.message
              : "CSV upload failed."
        );
        return;
      }

      try {
        if (!request.file) {
          sendError(response as Response<ApiResponse<never>>, 400, "CSV_REQUIRED", "Upload a CSV file.");
          return;
        }
        response.json({ success: true, data: createUploadSession(request.file), error: null });
      } catch (parseError: unknown) {
        sendError(
          response as Response<ApiResponse<never>>,
          400,
          "CSV_PARSE_FAILED",
          parseError instanceof Error ? parseError.message : "CSV parse failed."
        );
      }
    });
  });

  router.post("/map", (request: Request, response: Response<ApiResponse<CsvPreviewResult>>) => {
    const parsed = mapSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response as Response<ApiResponse<never>>, 400, "INVALID_MAPPING", parsed.error.issues[0]?.message ?? "Invalid mapping.");
      return;
    }

    try {
      response.json({
        success: true,
        data: previewCsvMapping(getCurrentConfig(), parsed.data.uploadId, parsed.data.tableName, parsed.data.mappings),
        error: null
      });
    } catch (error: unknown) {
      sendError(response as Response<ApiResponse<never>>, 400, "MAPPING_FAILED", error instanceof Error ? error.message : "Mapping failed.");
    }
  });

  router.post("/ingest", async (request: Request, response: Response<ApiResponse<CsvIngestResult>>) => {
    const parsed = mapSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response as Response<ApiResponse<never>>, 400, "INVALID_MAPPING", parsed.error.issues[0]?.message ?? "Invalid mapping.");
      return;
    }

    try {
      const userId = request.userId;
      const config = getCurrentConfig();
      const data = await ingestCsvRows(config, parsed.data.uploadId, parsed.data.tableName, parsed.data.mappings, userId);
      
      if (data.inserted > 0) {
        await addRuntimeActivity("CSV_IMPORTED", `Successfully imported ${data.inserted} rows into table ${parsed.data.tableName}.`);
      }
      
      response.json({
        success: true,
        data,
        error: null
      });
    } catch (error: unknown) {
      logger.error({ error }, "CSV ingest failed");
      sendError(response as Response<ApiResponse<never>>, 500, "INGEST_FAILED", error instanceof Error ? error.message : "CSV ingest failed.");
    }
  });

  return router;
}
