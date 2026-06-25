import type { AppConfig, DatabaseTableConfig, FieldConfig } from "@genstack/config-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { triggerIntegrations } from "./integrations-engine.js";

export interface RuntimeRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface RuntimeValidationResult {
  data: Prisma.JsonObject;
  errors: string[];
}

const runtimeUserEmail = "runtime@genstack.local";

function appKey(config: AppConfig): string {
  return config.app.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "untitled-app";
}

function tableFor(config: AppConfig, tableName: string): DatabaseTableConfig | undefined {
  return config.database.tables.find((table) => table.name === tableName);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceFieldValue(field: FieldConfig, value: unknown): { value: Prisma.JsonValue | undefined; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { value: undefined };
  }

  if (field.type === "number") {
    const numberValue = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(numberValue)) {
      return { value: undefined, error: `${field.name} must be a number.` };
    }
    return { value: numberValue };
  }

  if (field.type === "boolean") {
    if (typeof value === "boolean") {
      return { value };
    }
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return { value: true };
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return { value: false };
    }
    return { value: undefined, error: `${field.name} must be true or false.` };
  }

  if (field.type === "date") {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return { value: undefined, error: `${field.name} must be a valid date.` };
    }
    return { value: date.toISOString() };
  }

  const stringValue = String(value);
  if (field.type === "enum" && field.options && field.options.length > 0 && !field.options.includes(stringValue)) {
    return { value: undefined, error: `${field.name} must be one of: ${field.options.join(", ")}.` };
  }

  return { value: stringValue };
}

export function validateRuntimePayload(
  table: DatabaseTableConfig,
  body: unknown,
  mode: "create" | "update"
): RuntimeValidationResult {
  const input = isObject(body) ? body : {};
  const errors: string[] = [];
  const data: Prisma.JsonObject = {};

  table.fields.forEach((field) => {
    const rawValue = input[field.name];
    const coerced = coerceFieldValue(field, rawValue);

    if (coerced.error) {
      errors.push(coerced.error);
      return;
    }

    if (coerced.value === undefined) {
      if (mode === "create" && field.required) {
        errors.push(`${field.name} is required.`);
      }
      return;
    }

    data[field.name] = coerced.value;
  });

  return { data, errors };
}

async function ensureRuntimeUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: runtimeUserEmail },
    update: {},
    create: { email: runtimeUserEmail, name: "Runtime Demo User" },
    select: { id: true }
  });
  return user.id;
}

function toRuntimeRecord(record: { id: string; data: Prisma.JsonValue; createdAt: Date; updatedAt: Date }): RuntimeRecord {
  const data = isObject(record.data) ? record.data : {};
  return {
    id: record.id,
    ...data,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function matchesFilters(record: RuntimeRecord, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([key, expected]) => {
    if (expected.trim() === "") {
      return true;
    }
    const actual = record[key];
    return String(actual ?? "").toLowerCase() === expected.toLowerCase();
  });
}

export async function listRuntimeRecords(
  config: AppConfig,
  tableName: string,
  filters: Record<string, string>,
  userId?: string
): Promise<{ records: RuntimeRecord[]; error?: string }> {
  const table = tableFor(config, tableName);
  if (!table) {
    return { records: [], error: `Unknown table "${tableName}". Add it to config.database.tables first.` };
  }

  const resolvedUserId = userId || (await ensureRuntimeUser());
  const rows = await prisma.generatedRecord.findMany({
    where: { appKey: appKey(config), tableName, userId: resolvedUserId },
    orderBy: { createdAt: "desc" }
  });
  const records = rows.map(toRuntimeRecord);
  return { records: records.filter((record) => matchesFilters(record, filters)) };
}

export async function createRuntimeRecord(
  config: AppConfig,
  tableName: string,
  body: unknown,
  userId?: string
): Promise<{ record?: RuntimeRecord; errors?: string[]; error?: string }> {
  const table = tableFor(config, tableName);
  if (!table) {
    return { error: `Unknown table "${tableName}". Add it to config.database.tables first.` };
  }

  const validation = validateRuntimePayload(table, body, "create");
  if (validation.errors.length > 0) {
    return { errors: validation.errors };
  }

  const resolvedUserId = userId || (await ensureRuntimeUser());
  const row = await prisma.generatedRecord.create({
    data: {
      appKey: appKey(config),
      tableName,
      data: validation.data,
      userId: resolvedUserId
    }
  });

  const record = toRuntimeRecord(row);
  void triggerIntegrations(tableName, "insert", record, userId);
  return { record };
}

export async function updateRuntimeRecord(
  config: AppConfig,
  tableName: string,
  id: string,
  body: unknown,
  userId?: string
): Promise<{ record?: RuntimeRecord; errors?: string[]; error?: string }> {
  const table = tableFor(config, tableName);
  if (!table) {
    return { error: `Unknown table "${tableName}". Add it to config.database.tables first.` };
  }

  const validation = validateRuntimePayload(table, body, "update");
  if (validation.errors.length > 0) {
    return { errors: validation.errors };
  }

  const resolvedUserId = userId || (await ensureRuntimeUser());
  const existing = await prisma.generatedRecord.findFirst({
    where: { id, appKey: appKey(config), tableName, userId: resolvedUserId }
  });
  if (!existing) {
    return { error: `Record "${id}" was not found in "${tableName}".` };
  }

  const previousData = isObject(existing.data) ? existing.data : {};
  const row = await prisma.generatedRecord.update({
    where: { id },
    data: { data: { ...previousData, ...validation.data } }
  });

  const record = toRuntimeRecord(row);
  void triggerIntegrations(tableName, "update", record, userId);
  return { record };
}

export async function deleteRuntimeRecord(
  config: AppConfig,
  tableName: string,
  id: string,
  userId?: string
): Promise<{ id?: string; error?: string }> {
  const table = tableFor(config, tableName);
  if (!table) {
    return { error: `Unknown table "${tableName}". Add it to config.database.tables first.` };
  }

  const resolvedUserId = userId || (await ensureRuntimeUser());
  const existing = await prisma.generatedRecord.findFirst({
    where: { id, appKey: appKey(config), tableName, userId: resolvedUserId },
    select: { id: true }
  });
  if (!existing) {
    return { error: `Record "${id}" was not found in "${tableName}".` };
  }

  await prisma.generatedRecord.delete({ where: { id } });
  void triggerIntegrations(tableName, "delete", { id }, userId);
  return { id };
}
