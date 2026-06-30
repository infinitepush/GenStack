import type { AppConfig } from "@genstack/config-types";

export interface PromptIntentSnapshot {
  domain: string;
  analytics: string[];
  expectedFields: string[];
  expectedTokens: string[];
}

export interface GenerationHistoryEntry {
  id: string;
  appName: string;
  prompt: string;
  generationMode: "structured" | "fallback";
  repairActions: number;
  validationScore: number;
  validationMaxScore: number;
  promptCoverage: number;
  grade: "A" | "B" | "C" | "D" | "F";
  intent: PromptIntentSnapshot;
  createdAt: string;
  config: AppConfig;
}

const LEGACY_HISTORY_KEY = "genstack.generation.history";
const MAX_HISTORY = 8;

function historyKey(userId: string): string {
  return `genstack.generation.history.${userId}`;
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

function isEntry(value: unknown): value is GenerationHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<GenerationHistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.appName === "string" &&
    typeof candidate.prompt === "string" &&
    (candidate.generationMode === "structured" || candidate.generationMode === "fallback") &&
    typeof candidate.repairActions === "number" &&
    typeof candidate.validationScore === "number" &&
    typeof candidate.validationMaxScore === "number" &&
    typeof candidate.promptCoverage === "number" &&
    typeof candidate.grade === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.intent === "object" &&
    candidate.intent !== null &&
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
 * Migrate legacy global localStorage key to user-scoped key.
 * Runs only once per user: if the legacy key exists and the scoped key does not.
 */
function migrateLegacyKey(userId: string): void {
  if (!storageAvailable()) return;

  const scopedKey = historyKey(userId);
  const legacyData = window.localStorage.getItem(LEGACY_HISTORY_KEY);
  if (legacyData && !window.localStorage.getItem(scopedKey)) {
    window.localStorage.setItem(scopedKey, legacyData);
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
  }
}

export async function pushGenerationHistoryToBackend(entries: GenerationHistoryEntry[], userId: string): Promise<void> {
  if (userId === "_anonymous") return;
  try {
    await fetch(`${apiBase()}/user-data/generation_history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ value: entries })
    });
  } catch (err) {
    console.error("Failed to push generation history to backend:", err);
  }
}

export async function syncGenerationHistoryWithBackend(userId: string): Promise<GenerationHistoryEntry[]> {
  if (!storageAvailable()) return [];
  migrateLegacyKey(userId);

  if (userId === "_anonymous") {
    return readGenerationHistory(userId);
  }

  try {
    const response = await fetch(`${apiBase()}/user-data/generation_history`, { credentials: "include" });
    if (response.ok) {
      const body = await response.json();
      if (body.success && Array.isArray(body.data)) {
        const remoteHistory = body.data as GenerationHistoryEntry[];
        const localHistory = readGenerationHistory(userId);
        
        // Merge histories by unique ID, keeping the newest entry
        const mergedMap = new Map<string, GenerationHistoryEntry>();
        [...localHistory, ...remoteHistory].forEach((entry) => {
          const existing = mergedMap.get(entry.id);
          if (!existing || new Date(entry.createdAt) > new Date(existing.createdAt)) {
            mergedMap.set(entry.id, entry);
          }
        });
        
        const merged = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, MAX_HISTORY);

        // Update local storage
        window.localStorage.setItem(historyKey(userId), JSON.stringify(merged));
        
        // Push merged state back to server if it changed
        if (JSON.stringify(merged) !== JSON.stringify(remoteHistory)) {
          await pushGenerationHistoryToBackend(merged, userId);
        }
        
        return merged;
      }
    }
  } catch (err) {
    console.error("Failed to sync generation history with backend:", err);
  }
  return readGenerationHistory(userId);
}

function readRawHistory(userId: string): GenerationHistoryEntry[] {
  if (!storageAvailable()) return [];
  migrateLegacyKey(userId);
  try {
    const raw = window.localStorage.getItem(historyKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function readGenerationHistory(userId: string): GenerationHistoryEntry[] {
  return readRawHistory(userId);
}

export function saveGenerationHistory(userId: string, entry: Omit<GenerationHistoryEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }): GenerationHistoryEntry[] {
  if (!storageAvailable()) return [];

  const history = readRawHistory(userId);
  const nextEntry: GenerationHistoryEntry = {
    ...entry,
    id: entry.id ?? createId(),
    createdAt: entry.createdAt ?? new Date().toISOString()
  };
  const nextHistory = [nextEntry, ...history.filter((item) => item.id !== nextEntry.id)].slice(0, MAX_HISTORY);
  window.localStorage.setItem(historyKey(userId), JSON.stringify(nextHistory));
  void pushGenerationHistoryToBackend(nextHistory, userId);
  return nextHistory;
}

export function clearGenerationHistory(userId: string): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(historyKey(userId));
  void pushGenerationHistoryToBackend([], userId);
}
