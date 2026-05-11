import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { Prisma } from "@prisma/client";
import type { AppConfig, DatabaseTableConfig, FieldConfig } from "@genstack/config-types";
import { prisma } from "../lib/prisma.js";

export interface CsvRowError {
  row: number;
  reason: string;
}

export interface CsvUploadSession {
  id: string;
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

export interface CsvUploadResult {
  uploadId: string;
  fileName: string;
  headers: string[];
  preview: Record<string, string>[];
  rowCount: number;
  warnings: string[];
}

export interface CsvPreviewResult {
  valid: number;
  skipped: number;
  preview: Record<string, unknown>[];
  errors: CsvRowError[];
}

export interface CsvIngestResult {
  inserted: number;
  skipped: number;
  errors: CsvRowError[];
}

const sessions = new Map<string, CsvUploadSession>();
const maxPreviewErrors = 25;

function normalizeHeader(value: string, index: number): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : `column_${index + 1}`;
}

function looksLikeDataRow(values: string[]): boolean {
  return values.length > 0 && values.every((value) => value.trim() === "" || !Number.isNaN(Number(value)) || /^\d{4}-\d{1,2}-\d{1,2}/.test(value));
}

function parseCsv(buffer: Buffer, fileName: string): CsvUploadSession {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  if (text.trim().length === 0) {
    throw new Error("CSV is empty. Add at least one data row and try again.");
  }
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse failed.");
  }

  const matrix = parsed.data.filter((row) => row.some((cell) => String(cell).trim().length > 0));
  if (matrix.length === 0) {
    throw new Error("CSV is empty. Add at least one data row and try again.");
  }

  const warnings: string[] = [];
  const firstRow = matrix[0] ?? [];
  const noHeader = looksLikeDataRow(firstRow);
  if (noHeader) {
    warnings.push("No header row was detected. Columns were named column_1, column_2, etc.");
  }

  const headers = noHeader ? firstRow.map((_value, index) => `column_${index + 1}`) : firstRow.map(normalizeHeader);
  const dataRows = noHeader ? matrix : matrix.slice(1);

  if (dataRows.length === 0) {
    throw new Error("CSV has headers but no data rows.");
  }

  const rows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]))
  );

  return {
    id: randomUUID(),
    fileName,
    headers,
    rows,
    warnings
  };
}

function findTable(config: AppConfig, tableName: string): DatabaseTableConfig {
  const table = config.database.tables.find((candidate) => candidate.name === tableName);
  if (!table) {
    throw new Error(`Unknown table "${tableName}".`);
  }
  return table;
}

function coerceValue(field: FieldConfig, value: string | undefined): { value?: unknown; error?: string } {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    if (field.required) {
      return { error: `${field.name} is required.` };
    }
    return {};
  }

  if (field.type === "number") {
    const numberValue = Number(trimmed);
    if (Number.isNaN(numberValue)) {
      return { error: `${field.name} must be a number.` };
    }
    return { value: numberValue };
  }

  if (field.type === "boolean") {
    if (["true", "1", "yes"].includes(trimmed.toLowerCase())) return { value: true };
    if (["false", "0", "no"].includes(trimmed.toLowerCase())) return { value: false };
    return { error: `${field.name} must be true or false.` };
  }

  if (field.type === "date") {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return { error: `${field.name} must be a valid date.` };
    }
    return { value: date.toISOString() };
  }

  if (field.type === "enum" && field.options && field.options.length > 0) {
    if (!field.options.includes(trimmed)) {
      return { error: `${field.name} must be one of: ${field.options.join(", ")}.` };
    }
  }

  return { value: trimmed };
}

function applyMappings(
  row: Record<string, string>,
  rowNumber: number,
  table: DatabaseTableConfig,
  mappings: Record<string, string>
): { data?: Record<string, unknown>; error?: CsvRowError } {
  const fieldByName = new Map(table.fields.map((field) => [field.name, field]));
  const valuesByField = new Map<string, string>();

  Object.entries(mappings).forEach(([csvColumn, fieldName]) => {
    if (fieldName !== "ignore" && fieldByName.has(fieldName)) {
      valuesByField.set(fieldName, row[csvColumn] ?? "");
    }
  });

  const data: Record<string, unknown> = {};
  for (const field of table.fields) {
    const result = coerceValue(field, valuesByField.get(field.name));
    if (result.error) {
      return { error: { row: rowNumber, reason: result.error } };
    }
    if (result.value !== undefined) {
      data[field.name] = result.value;
    }
  }

  return { data };
}

export function createUploadSession(file: Express.Multer.File): CsvUploadResult {
  const session = parseCsv(file.buffer, file.originalname);
  sessions.set(session.id, session);
  return {
    uploadId: session.id,
    fileName: session.fileName,
    headers: session.headers,
    preview: session.rows.slice(0, 5),
    rowCount: session.rows.length,
    warnings: session.warnings
  };
}

export function previewCsvMapping(
  config: AppConfig,
  uploadId: string,
  tableName: string,
  mappings: Record<string, string>
): CsvPreviewResult {
  const session = sessions.get(uploadId);
  if (!session) throw new Error("Upload session expired. Upload the CSV again.");
  const table = findTable(config, tableName);
  const errors: CsvRowError[] = [];
  const preview: Record<string, unknown>[] = [];
  let valid = 0;

  session.rows.forEach((row, index) => {
    const result = applyMappings(row, index + 2, table, mappings);
    if (result.error) {
      errors.push(result.error);
      return;
    }
    valid += 1;
    if (preview.length < 5 && result.data) preview.push(result.data);
  });

  return { valid, skipped: errors.length, preview, errors: errors.slice(0, maxPreviewErrors) };
}

async function ensureImportUser(userId?: string): Promise<string> {
  if (userId) return userId;
  const user = await prisma.user.upsert({
    where: { email: "import@genstack.local" },
    create: { email: "import@genstack.local", name: "Import User" },
    update: {}
  });
  return user.id;
}

export async function ingestCsvRows(
  config: AppConfig,
  uploadId: string,
  tableName: string,
  mappings: Record<string, string>,
  userId?: string
): Promise<CsvIngestResult> {
  const session = sessions.get(uploadId);
  if (!session) throw new Error("Upload session expired. Upload the CSV again.");
  const table = findTable(config, tableName);
  const errors: CsvRowError[] = [];
  const validRows: Record<string, unknown>[] = [];

  session.rows.forEach((row, index) => {
    const result = applyMappings(row, index + 2, table, mappings);
    if (result.error) {
      errors.push(result.error);
      return;
    }
    if (result.data) validRows.push(result.data);
  });

  const resolvedUserId = await ensureImportUser(userId);
  let inserted = 0;
  for (let index = 0; index < validRows.length; index += 100) {
    const chunk = validRows.slice(index, index + 100);
    if (chunk.length === 0) continue;
    const result = await prisma.generatedRecord.createMany({
      data: chunk.map((data) => ({
        appKey: config.app.name,
        tableName,
        userId: resolvedUserId,
        data: data as Prisma.JsonObject
      }))
    });
    inserted += result.count;
  }

  return { inserted, skipped: errors.length, errors };
}
