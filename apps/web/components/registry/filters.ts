import type { ComponentConfig } from "@genstack/config-types";
import type { DataRecord } from "./index";

interface FilterConfig {
  field?: string;
  operator?: string;
  value?: unknown;
  valueField?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFilter(value: unknown): FilterConfig | undefined {
  if (!isObject(value)) return undefined;
  const filter: FilterConfig = { value: value.value };
  if (typeof value.field === "string") {
    filter.field = value.field;
  }
  if (typeof value.operator === "string") {
    filter.operator = value.operator;
  }
  if (typeof value.valueField === "string") {
    filter.valueField = value.valueField;
  }
  return filter;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isToday(value: unknown): boolean {
  if (typeof value !== "string" && !(value instanceof Date)) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function matchesFilter(row: DataRecord, filter: FilterConfig): boolean {
  if (!filter.field) return true;
  const operator = filter.operator ?? "equals";
  const left = row[filter.field];
  const right = filter.valueField ? row[filter.valueField] : filter.value;

  if (operator === "today") return isToday(left);
  if (operator === "lte_field" || operator === "lte") {
    const leftNumber = toNumber(left);
    const rightNumber = toNumber(right);
    return leftNumber !== null && rightNumber !== null && leftNumber <= rightNumber;
  }
  if (operator === "lt") {
    const leftNumber = toNumber(left);
    const rightNumber = toNumber(right);
    return leftNumber !== null && rightNumber !== null && leftNumber < rightNumber;
  }
  if (operator === "gte") {
    const leftNumber = toNumber(left);
    const rightNumber = toNumber(right);
    return leftNumber !== null && rightNumber !== null && leftNumber >= rightNumber;
  }

  return String(left ?? "").toLowerCase() === String(right ?? "").toLowerCase();
}

export function applyComponentFilter(data: DataRecord[], config: ComponentConfig): DataRecord[] {
  const filter = readFilter(config.filter);
  return filter ? data.filter((row) => matchesFilter(row, filter)) : data;
}
