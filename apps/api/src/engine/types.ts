import type { AppConfig, ConfigIssue } from "@genstack/config-types";

export type PipelineStageStatus = "success" | "warning" | "error";
export type FindingSeverity = "error" | "warning" | "info";

export interface PipelineStage {
  name: string;
  status: PipelineStageStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  message: string;
}

export interface ValidationFinding {
  severity: FindingSeverity;
  path: string;
  message: string;
}

export interface RepairChange {
  path: string;
  action: "defaulted" | "deduplicated" | "removed" | "added" | "coerced";
  message: string;
}

export interface RepairResult {
  config: AppConfig;
  findings: ValidationFinding[];
  changes: RepairChange[];
  configErrors: ConfigIssue[];
  configWarnings: ConfigIssue[];
}

export interface EvaluationMetric {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  notes: string[];
}

export interface EvaluationResult {
  score: number;
  maxScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  metrics: EvaluationMetric[];
  blockers: ValidationFinding[];
  recommendations: string[];
}

export interface AiDraft {
  text: string;
  provider: string;
  model: string;
}

export interface PipelineRunResult {
  runId: string;
  prompt: string;
  provider: string;
  model: string;
  stages: PipelineStage[];
  rawDraft: string;
  config: AppConfig;
  repair: RepairResult;
  evaluation: EvaluationResult;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateConfigDraft(input: { prompt: string; seedConfig?: unknown }): Promise<AiDraft>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
