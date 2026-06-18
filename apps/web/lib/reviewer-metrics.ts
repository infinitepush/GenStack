import type { AppConfig } from "@genstack/config-types";
import type { GenerationHistoryEntry } from "@/lib/generation-history";

export interface ConfidenceInput {
  generationMode: "structured" | "fallback";
  validationPercent: number;
  promptCoveragePercent: number;
  repairActions: number;
}

export interface ReliabilitySummary {
  totalRuns: number;
  structuredRuns: number;
  fallbackRuns: number;
  averageRepairs: number;
  repairFreeRuns: number;
  repairFreeRate: number;
  averageConfidence: number;
}

export interface ConfigDiffLine {
  lineNumber: number;
  draft: string;
  final: string;
  changed: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceScoreForHistoryEntry(entry: GenerationHistoryEntry): number {
  const validationPercent = entry.validationMaxScore > 0 ? (entry.validationScore / entry.validationMaxScore) * 100 : 0;
  return calculateAiConfidenceScore({
    generationMode: entry.generationMode,
    validationPercent,
    promptCoveragePercent: entry.promptCoverage,
    repairActions: entry.repairActions
  });
}

export function calculateAiConfidenceScore(input: ConfidenceInput): number {
  const validation = clamp(input.validationPercent, 0, 100);
  const coverage = clamp(input.promptCoveragePercent, 0, 100);
  const modeScore = input.generationMode === "structured" ? 100 : 72;
  const repairScore = input.repairActions === 0 ? 100 : clamp(100 - input.repairActions * 14, 40, 100);
  const blended = validation * 0.4 + coverage * 0.3 + modeScore * 0.2 + repairScore * 0.1;
  return Math.round(clamp(blended, 0, 100));
}

export function summarizeReliability(history: GenerationHistoryEntry[]): ReliabilitySummary {
  const totalRuns = history.length;
  if (totalRuns === 0) {
    return {
      totalRuns: 0,
      structuredRuns: 0,
      fallbackRuns: 0,
      averageRepairs: 0,
      repairFreeRuns: 0,
      repairFreeRate: 0,
      averageConfidence: 0
    };
  }

  const structuredRuns = history.filter((entry) => entry.generationMode === "structured").length;
  const fallbackRuns = totalRuns - structuredRuns;
  const repairFreeRuns = history.filter((entry) => entry.repairActions === 0).length;
  const averageRepairs = history.reduce((sum, entry) => sum + entry.repairActions, 0) / totalRuns;
  const averageConfidence = history.reduce((sum, entry) => sum + confidenceScoreForHistoryEntry(entry), 0) / totalRuns;

  return {
    totalRuns,
    structuredRuns,
    fallbackRuns,
    averageRepairs: Number(averageRepairs.toFixed(2)),
    repairFreeRuns,
    repairFreeRate: Number(((repairFreeRuns / totalRuns) * 100).toFixed(1)),
    averageConfidence: Math.round(averageConfidence)
  };
}

export function buildConfigDiffLines(rawDraft: string, finalConfig: AppConfig): ConfigDiffLine[] {
  const draftLines = rawDraft.trim().length > 0 ? rawDraft.trim().split(/\r?\n/) : ["{}"];
  const finalLines = JSON.stringify(finalConfig, null, 2).split("\n");
  const totalLines = Math.max(draftLines.length, finalLines.length);

  return Array.from({ length: totalLines }, (_value, index) => {
    const draft = draftLines[index] ?? "";
    const final = finalLines[index] ?? "";
    return {
      lineNumber: index + 1,
      draft,
      final,
      changed: draft !== final
    };
  });
}
