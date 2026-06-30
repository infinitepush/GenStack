import type { AppConfig } from "@genstack/config-types";

export interface RuntimeHistoryEntry {
  id: string;
  appName: string;
  config: AppConfig;
  createdAt: string;
  prompt?: string;
}

const LEGACY_HISTORY_KEY = "genstack.runtime.history";
const LEGACY_ACTIVE_KEY = "genstack.runtime.active";
const MAX_HISTORY = 8;

function historyKey(userId: string): string {
  return `genstack.runtime.history.${userId}`;
}

function activeKey(userId: string): string {
  return `genstack.runtime.active.${userId}`;
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function apiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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

/**
 * Migrate legacy global localStorage keys to user-scoped keys.
 * Runs only once per user: if the legacy key exists and the scoped key does not.
 */
function migrateLegacyKeys(userId: string): void {
  if (!storageAvailable()) return;

  // Migrate history
  const scopedHistoryKey = historyKey(userId);
  const legacyHistory = window.localStorage.getItem(LEGACY_HISTORY_KEY);
  if (legacyHistory && !window.localStorage.getItem(scopedHistoryKey)) {
    window.localStorage.setItem(scopedHistoryKey, legacyHistory);
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
  }

  // Migrate active runtime
  const scopedActiveKey = activeKey(userId);
  const legacyActive = window.localStorage.getItem(LEGACY_ACTIVE_KEY);
  if (legacyActive && !window.localStorage.getItem(scopedActiveKey)) {
    window.localStorage.setItem(scopedActiveKey, legacyActive);
    window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
  }
}

export async function pushRuntimeHistoryToBackend(entries: RuntimeHistoryEntry[], userId: string): Promise<void> {
  if (userId === "_anonymous") return;
  try {
    await fetch(`${apiBase()}/user-data/runtime_history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ value: entries })
    });
  } catch (err) {
    console.error("Failed to push runtime history to backend:", err);
  }
}

export async function syncRuntimeHistoryWithBackend(userId: string): Promise<RuntimeHistoryEntry[]> {
  if (!storageAvailable()) return [];
  migrateLegacyKeys(userId);

  if (userId === "_anonymous") {
    return readRuntimeHistory(userId);
  }

  try {
    const response = await fetch(`${apiBase()}/user-data/runtime_history`, { credentials: "include" });
    if (response.ok) {
      const body = await response.json();
      if (body.success && Array.isArray(body.data)) {
        const remoteHistory = body.data as RuntimeHistoryEntry[];
        const localHistory = readRuntimeHistory(userId);
        
        // Merge histories by unique appName/id, keeping the newest entry
        const mergedMap = new Map<string, RuntimeHistoryEntry>();
        [...localHistory, ...remoteHistory].forEach((entry) => {
          const existing = mergedMap.get(entry.appName);
          if (!existing || new Date(entry.createdAt) > new Date(existing.createdAt)) {
            mergedMap.set(entry.appName, entry);
          }
        });
        
        const merged = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, MAX_HISTORY);

        // Update local storage
        window.localStorage.setItem(historyKey(userId), JSON.stringify(merged));
        
        // Push merged state back to server if it changed
        if (JSON.stringify(merged) !== JSON.stringify(remoteHistory)) {
          await pushRuntimeHistoryToBackend(merged, userId);
        }
        
        return merged;
      }
    }
  } catch (err) {
    console.error("Failed to sync runtime history with backend:", err);
  }
  return readRuntimeHistory(userId);
}

export function readRuntimeHistory(userId: string): RuntimeHistoryEntry[] {
  if (!storageAvailable()) return [];
  migrateLegacyKeys(userId);

  try {
    const raw = window.localStorage.getItem(historyKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRuntimeHistoryEntry);
  } catch {
    return [];
  }
}

export function getActiveRuntimeId(userId: string): string | null {
  if (!storageAvailable()) return null;
  migrateLegacyKeys(userId);
  return window.localStorage.getItem(activeKey(userId));
}

export function getActiveRuntime(userId: string): RuntimeHistoryEntry | null {
  const activeId = getActiveRuntimeId(userId);
  if (!activeId) return null;
  return readRuntimeHistory(userId).find((entry) => entry.id === activeId) ?? null;
}

export function writeRuntimeHistory(entries: RuntimeHistoryEntry[], userId: string): void {
  if (!storageAvailable()) return;
  const sliced = entries.slice(0, MAX_HISTORY);
  window.localStorage.setItem(historyKey(userId), JSON.stringify(sliced));
  void pushRuntimeHistoryToBackend(sliced, userId);
}

export function setActiveRuntime(id: string, userId: string): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(activeKey(userId), id);
}

export function saveRuntimeConfig(config: AppConfig, userId: string, prompt?: string): RuntimeHistoryEntry {
  const history = readRuntimeHistory(userId);
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
  writeRuntimeHistory(nextHistory, userId);
  setActiveRuntime(entry.id, userId);
  return entry;
}

export function deleteRuntimeHistoryEntry(id: string, userId: string): RuntimeHistoryEntry[] {
  const nextHistory = readRuntimeHistory(userId).filter((entry) => entry.id !== id);
  writeRuntimeHistory(nextHistory, userId);
  if (getActiveRuntimeId(userId) === id) {
    if (storageAvailable()) {
      if (nextHistory[0]) {
        window.localStorage.setItem(activeKey(userId), nextHistory[0].id);
      } else {
        window.localStorage.removeItem(activeKey(userId));
      }
    }
  }
  return nextHistory;
}

/**
 * Clear transient runtime caches for the given user on logout.
 * Removes the active runtime selection but preserves persistent history.
 */
export function clearTransientRuntimeCache(userId: string): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(activeKey(userId));
}
