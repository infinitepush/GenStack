import type { AppConfig } from "@genstack/config-types";

export interface RuntimeHistoryEntry {
  id: string;
  appName: string;
  config: AppConfig;
  createdAt: string;
  prompt?: string;
}

const HISTORY_KEY = "genstack.runtime.history";
const ACTIVE_KEY = "genstack.runtime.active";
const MAX_HISTORY = 8;

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isRuntimeHistoryEntry(value: unknown): value is RuntimeHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RuntimeHistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.appName === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.config === "object" &&
    candidate.config !== null
  );
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readRuntimeHistory(): RuntimeHistoryEntry[] {
  if (!storageAvailable()) return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRuntimeHistoryEntry);
  } catch {
    return [];
  }
}

export function getActiveRuntimeId(): string | null {
  if (!storageAvailable()) return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function getActiveRuntime(): RuntimeHistoryEntry | null {
  const activeId = getActiveRuntimeId();
  if (!activeId) return null;
  return readRuntimeHistory().find((entry) => entry.id === activeId) ?? null;
}

export function writeRuntimeHistory(entries: RuntimeHistoryEntry[]): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function setActiveRuntime(id: string): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(ACTIVE_KEY, id);
}

export function saveRuntimeConfig(config: AppConfig, prompt?: string): RuntimeHistoryEntry {
  const history = readRuntimeHistory();
  const normalizedPrompt = prompt?.trim();
  const existingIndex = history.findIndex((entry) => entry.appName === config.app.name);
  const existing = existingIndex >= 0 ? history[existingIndex] : undefined;
  const entry: RuntimeHistoryEntry = {
    id: existing?.id ?? createId(),
    appName: config.app.name,
    config,
    createdAt: new Date().toISOString(),
    ...(normalizedPrompt ? { prompt: normalizedPrompt } : {})
  };

  const nextHistory = [entry, ...history.filter((item) => item.id !== entry.id)];
  writeRuntimeHistory(nextHistory);
  setActiveRuntime(entry.id);
  return entry;
}

export function deleteRuntimeHistoryEntry(id: string): RuntimeHistoryEntry[] {
  const nextHistory = readRuntimeHistory().filter((entry) => entry.id !== id);
  writeRuntimeHistory(nextHistory);
  if (getActiveRuntimeId() === id) {
    if (storageAvailable()) {
      if (nextHistory[0]) {
        window.localStorage.setItem(ACTIVE_KEY, nextHistory[0].id);
      } else {
        window.localStorage.removeItem(ACTIVE_KEY);
      }
    }
  }
  return nextHistory;
}

