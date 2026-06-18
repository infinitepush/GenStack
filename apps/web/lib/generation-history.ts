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

const HISTORY_KEY = "genstack.generation.history";
const MAX_HISTORY = 8;

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

function readRawHistory(): GenerationHistoryEntry[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function readGenerationHistory(): GenerationHistoryEntry[] {
  return readRawHistory();
}

export function saveGenerationHistory(entry: Omit<GenerationHistoryEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }): GenerationHistoryEntry[] {
  if (!storageAvailable()) return [];

  const history = readRawHistory();
  const nextEntry: GenerationHistoryEntry = {
    ...entry,
    id: entry.id ?? createId(),
    createdAt: entry.createdAt ?? new Date().toISOString()
  };
  const nextHistory = [nextEntry, ...history.filter((item) => item.id !== nextEntry.id)].slice(0, MAX_HISTORY);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function clearGenerationHistory(): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(HISTORY_KEY);
}
