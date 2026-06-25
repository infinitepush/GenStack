"use client";

import { AlertTriangle, CheckCircle2, Columns2, Download, Dumbbell, Gauge, Hammer, History, Hospital, Play, Sparkles, Target, Wand2, Warehouse } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AppConfig } from "@genstack/config-types";
import { buildConfigDownloadName, downloadJson } from "@/lib/download-json";
import { loadReviewerDemoData } from "@/lib/demo-data";
import { getActiveRuntime, saveRuntimeConfig, type RuntimeHistoryEntry } from "@/lib/runtime-history";
import {
  readGenerationHistory,
  saveGenerationHistory,
  type GenerationHistoryEntry,
  type PromptIntentSnapshot
} from "@/lib/generation-history";
import { buildConfigDiffLines, calculateAiConfidenceScore, summarizeReliability } from "@/lib/reviewer-metrics";

type StageStatus = "success" | "warning" | "error";
type FindingSeverity = "error" | "warning" | "info";

interface PipelineStage {
  name: string;
  status: StageStatus;
  durationMs: number;
  message: string;
}

interface ValidationFinding {
  severity: FindingSeverity;
  path: string;
  message: string;
}

interface RepairChange {
  path: string;
  action: string;
  message: string;
}

interface EvaluationMetric {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  notes: string[];
}

interface EvaluationResult {
  score: number;
  maxScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  metrics: EvaluationMetric[];
  blockers: ValidationFinding[];
  recommendations: string[];
}

interface RepairResult {
  config: AppConfig;
  findings: ValidationFinding[];
  changes: RepairChange[];
}

interface PipelineRunResult {
  runId: string;
  prompt: string;
  provider: string;
  model: string;
  generationMode: "structured" | "fallback";
  repairActions: number;
  intent: PromptIntentSnapshot;
  stages: PipelineStage[];
  rawDraft: string;
  config: AppConfig;
  repair: RepairResult;
  evaluation: EvaluationResult;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

const benchmarkPrompts = [
  {
    icon: Warehouse,
    title: "Inventory Tracker",
    prompt: "Build an inventory tracker with reorder alerts, low stock thresholds, restocked today analytics, and a clean dashboard.",
    detail: "Stress tests stock, reorder, and date-based analytics."
  },
  {
    icon: Target,
    title: "Sales CRM",
    prompt: "Create a sales CRM with leads, stages, company names, deal value, and pipeline analytics.",
    detail: "Tests relational thinking and funnel metrics."
  },
  {
    icon: Hospital,
    title: "Hospital Billing",
    prompt: "Build a hospital billing app for patients, invoices, payment status, departments, and analytics.",
    detail: "Checks multi-table generation and finance-like fields."
  },
  {
    icon: Gauge,
    title: "Car Parking Manager",
    prompt: "Build a car parking manager with slots, vehicle types, payment status, entry dates, and occupancy analytics.",
    detail: "Useful for CRUD plus slot/availability logic."
  },
  {
    icon: Dumbbell,
    title: "Task Tracker",
    prompt: "Generate a task tracker with priority, status, due date, assignee, and a project dashboard.",
    detail: "Covers everyday internal-tool generation."
  }
];

const generationSteps = ["Generating config", "Repairing schema", "Building runtime", "Preparing analytics"];

function statusClass(status: StageStatus): string {
  if (status === "error") return "border-danger/30 bg-danger/5 text-danger";
  if (status === "warning") return "border-warning/30 bg-warning/5 text-warning";
  return "border-line/60 bg-elevated/10 text-zinc-300";
}

function severityClass(severity: FindingSeverity): string {
  if (severity === "error") return "border-danger/30 bg-danger/5 text-danger";
  if (severity === "warning") return "border-warning/30 bg-warning/5 text-warning";
  return "border-line bg-elevated/20 text-zinc-300";
}

function formatReadableLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getMetric(result: PipelineRunResult | null, key: string): EvaluationMetric | undefined {
  return result?.evaluation.metrics.find((metric) => metric.key === key);
}

function getPromptCoveragePercent(result: PipelineRunResult | null): number {
  const metric = getMetric(result, "prompt_coverage");
  if (!metric || metric.maxScore <= 0) return 0;
  return Math.round((metric.score / metric.maxScore) * 100);
}

function getValidationPercent(result: PipelineRunResult | null): number {
  if (!result || result.evaluation.maxScore <= 0) return 0;
  return Math.round((result.evaluation.score / result.evaluation.maxScore) * 100);
}

function generationModeLabel(mode: "structured" | "fallback"): string {
  return mode === "structured" ? "Structured Gemini Output" : "Legacy Fallback";
}

function generationModeTone(mode: "structured" | "fallback"): string {
  return mode === "structured"
    ? "border-line/60 bg-elevated/45 text-zinc-300"
    : "border-warning/30 bg-warning/5 text-warning";
}

function promptCoverageTone(percent: number): string {
  if (percent >= 90) return "text-zinc-100";
  if (percent >= 70) return "text-warning";
  return "text-danger";
}

function stringifyIntentSignals(intent: PromptIntentSnapshot): string[] {
  const analytics = intent.analytics.map((item) => formatReadableLabel(item));
  const fields = intent.expectedFields.slice(0, 4).map((field) => formatReadableLabel(field));
  return [formatReadableLabel(intent.domain), ...analytics, ...fields];
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }

  return payload.data;
}

export function AiStudio(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? "en";
  const [prompt, setPrompt] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [repair, setRepair] = useState<RepairResult | null>(null);
  const [currentRuntime, setCurrentRuntime] = useState<RuntimeHistoryEntry | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [showReviewerInsights, setShowReviewerInsights] = useState(true);

  const activeConfig = repair?.config ?? result?.config ?? currentRuntime?.config;
  const activeEvaluation = result?.evaluation;
  const runtimeReady = Boolean(activeEvaluation && activeEvaluation.blockers.length === 0);
  const scorePercent = useMemo(() => getValidationPercent(result), [result]);
  const promptCoveragePercent = useMemo(() => getPromptCoveragePercent(result), [result]);
  const confidenceScore = useMemo(
    () =>
      result
        ? calculateAiConfidenceScore({
            generationMode: result.generationMode,
            validationPercent: scorePercent,
            promptCoveragePercent,
            repairActions: result.repairActions
          })
        : 0,
    [promptCoveragePercent, result, scorePercent]
  );
  const reliability = useMemo(() => summarizeReliability(generationHistory), [generationHistory]);
  const validationMetric = useMemo(() => getMetric(result, "prompt_coverage"), [result]);
  const diffLines = useMemo(() => (result && activeConfig ? buildConfigDiffLines(result.rawDraft, activeConfig) : []), [activeConfig, result]);
  const changedDiffLines = useMemo(() => diffLines.filter((line) => line.changed).length, [diffLines]);
  const intentSignals = useMemo(() => (result ? stringifyIntentSignals(result.intent) : []), [result]);
  const validationScoreText = result ? `${result.evaluation.score}/${result.evaluation.maxScore}` : "0/0";

  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  useEffect(() => {
    setCurrentRuntime(getActiveRuntime());
    setGenerationHistory(readGenerationHistory());
    
    // Load recent prompts from localStorage
    const saved = localStorage.getItem("genstack:recent-prompts");
    if (saved) {
      try {
        setRecentPrompts(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse recent prompts:", err);
      }
    }

    const onConfigApplied = (): void => {
      setCurrentRuntime(getActiveRuntime());
    };
    window.addEventListener("genstack:config-applied", onConfigApplied);
    return () => {
      window.removeEventListener("genstack:config-applied", onConfigApplied);
    };
  }, []);

  const runPipeline = async (): Promise<void> => {
    setIsGenerating(true);
    setRepair(null);
    try {
      const next = await postJson<PipelineRunResult>("/ai/generate", { prompt });
      setResult(next);
      setJsonInput(JSON.stringify(next.config, null, 2));
      const promptCoverage = getPromptCoveragePercent(next);
      const nextHistory = saveGenerationHistory({
        appName: next.config.app.name,
        prompt: next.prompt,
        generationMode: next.generationMode,
        repairActions: next.repairActions,
        validationScore: next.evaluation.score,
        validationMaxScore: next.evaluation.maxScore,
        promptCoverage,
        grade: next.evaluation.grade,
        intent: next.intent,
        config: next.config
      });
      setGenerationHistory(nextHistory);
      
      // Update and persist recent prompts list
      const nextPrompts = [prompt, ...recentPrompts.filter(p => p !== prompt)].slice(0, 12);
      setRecentPrompts(nextPrompts);
      localStorage.setItem("genstack:recent-prompts", JSON.stringify(nextPrompts));

      toast.success("Pipeline run completed");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Pipeline failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const repairJson = async (): Promise<void> => {
    setIsRepairing(true);
    try {
      const parsed = JSON.parse(jsonInput) as unknown;
      const next = await postJson<RepairResult>("/ai/repair", { config: parsed });
      setRepair(next);
      setJsonInput(JSON.stringify(next.config, null, 2));
      toast.success("Config repaired");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Repair failed");
    } finally {
      setIsRepairing(false);
    }
  };

  const applyConfig = async (): Promise<void> => {
    if (!activeConfig) return;
    if (currentRuntime && currentRuntime.appName !== activeConfig.app.name) {
      const shouldReplace = window.confirm(
        `Replace current runtime "${currentRuntime.appName}" with "${activeConfig.app.name}"? You can restore older generations from the sidebar history.`
      );
      if (!shouldReplace) return;
    }
    setIsApplying(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      
      const next = await postJson<{ config: AppConfig; version: number; changes: string[] }>("/config?origin=ai-studio", activeConfig);
      
      // Fetch again to verify
      const getResponse = await fetch(`${baseUrl}/config`, { cache: "no-store", credentials: "include" });
      const getPayload = (await getResponse.json()) as ApiResponse<{ config: AppConfig }>;
      if (!getResponse.ok || !getPayload.success || !getPayload.data) {
        throw new Error(getPayload.error?.message ?? "Failed to fetch configuration for verification.");
      }
      
      const verified = getPayload.data;
      
      // Compare hashes (JSON strings)
      const match = JSON.stringify(verified.config) === JSON.stringify(next.config);
      if (!match) {
        throw new Error("Verification failed. Persisted configuration does not match the applied configuration.");
      }

      const savedRuntime = saveRuntimeConfig(verified.config, result?.prompt ?? prompt);
      setCurrentRuntime(savedRuntime);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      
      const changeText = next.changes && next.changes.length > 0
        ? `\nApplied Changes:\n${next.changes.join("\n")}`
        : "";
      toast.success(`Config applied successfully (v1.0.${next.version})${changeText}`);

      const firstRoute = verified.config.ui.pages[0]?.route ?? "/dashboard";
      router.push(`/${locale}${firstRoute}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to apply config");
    } finally {
      setIsApplying(false);
    }
  };

  const downloadActiveConfig = (): void => {
    if (!activeConfig) return;
    downloadJson(buildConfigDownloadName(activeConfig), activeConfig);
    toast.success("Config downloaded");
  };

  const loadDemoData = (): void => {
    const nextHistory = loadReviewerDemoData();
    setGenerationHistory(nextHistory);
    setCurrentRuntime(getActiveRuntime());
    window.dispatchEvent(new CustomEvent("genstack:config-applied"));
    toast.success("Reviewer demo data loaded");
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_460px]">
      <section className="space-y-8">
        <div className="rounded-lg border border-line bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">AI Runtime Studio</p>
              <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white">Generate a working internal tool</h1>
              <p className="mt-1 text-xs text-zinc-400">
                Describe an application, and GenStack will compile a schema, dynamic CRUD endpoints, forms, tables, and analytics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-zinc-500" />
            </div>
          </div>

          <div className="mt-8 border-t border-line/40 pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-mono">Benchmark Prompts</p>
                <p className="mt-1 text-xs text-zinc-500">Click any card to auto-fill a validation prompt.</p>
              </div>
              <span className="rounded-full border border-line/45 bg-elevated/40 px-2.5 py-0.5 text-[10px] font-mono text-zinc-400">Fast test suite</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {benchmarkPrompts.map((template) => (
                <button
                  className="group rounded-lg border border-line/40 bg-elevated/10 p-3 text-left transition duration-150 hover:border-line/80 hover:bg-elevated/20"
                  key={template.title}
                  onClick={() => setPrompt(template.prompt)}
                  type="button"
                >
                  <template.icon className="h-4 w-4 text-zinc-400 transition group-hover:text-zinc-200" />
                  <p className="mt-2 text-xs font-semibold text-zinc-200">{template.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{template.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-line bg-elevated/25 p-2 transition duration-150 focus-within:border-accent focus-within:ring-0">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe your internal tool (e.g. Build an Inventory Tracker with reorder alerts...)"
              className="w-full min-h-28 resize-y bg-transparent p-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none"
            />
            <div className="flex items-center justify-between border-t border-line/30 px-3 pt-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-elevated hover:text-zinc-200 transition"
                onClick={loadDemoData}
                type="button"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Load Demo Data
              </button>
              <button
                onClick={() => void runPipeline()}
                disabled={isGenerating || prompt.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                    Generate App
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recent Prompts Panel */}
          {recentPrompts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Recent Prompts</p>
              <div className="flex flex-wrap gap-1.5">
                {recentPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(p)}
                    className="max-w-[280px] md:max-w-[360px] truncate rounded border border-line/50 bg-elevated/10 hover:bg-elevated/35 px-2.5 py-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 text-left transition duration-150"
                    title={p}
                    type="button"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isGenerating ? (
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {generationSteps.map((step, index) => (
                <div className="rounded-md border border-line bg-elevated/45 px-3 py-2 text-xs text-zinc-300" key={step}>
                  <span className="mr-2 font-mono text-zinc-500">0{index + 1}</span>
                  {step}...
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="rounded-lg border border-line/45 bg-panel p-5">
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Runtime status</p>
              <div className="mt-3 flex items-end gap-2">
                <span className={runtimeReady ? "text-2xl font-bold text-zinc-100" : "text-2xl font-bold text-warning"}>
                  {runtimeReady ? "Runtime Ready" : "Needs Review"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                <span className={`rounded-full border px-2.5 py-1 ${generationModeTone(result.generationMode)}`}>
                  Generation: {generationModeLabel(result.generationMode)}
                </span>
                <span className="rounded-full border border-line/60 bg-elevated/45 px-2.5 py-1 text-zinc-300">
                  Coverage: {promptCoveragePercent}%
                </span>
                <span className="rounded-full border border-line bg-elevated/20 px-2.5 py-1 text-zinc-300">
                  Repair: {result.repairActions}
                </span>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-zinc-500">
                <p>{result.config.database.tables.length} table(s) configured</p>
                <p>{result.config.api.endpoints.length} CRUD API route(s) generated</p>
                <p>{result.config.ui.pages.reduce((total, page) => total + page.components.length, 0)} runtime component(s)</p>
                <p>{result.evaluation.blockers.length} blocking issue(s)</p>
              </div>
              <p className="mt-4 text-xs text-zinc-500 font-mono">
                {result.provider} / {result.model}
              </p>
              <p className="mt-1 text-xs text-zinc-600">Evaluation grade {result.evaluation.grade} · {scorePercent}%</p>
            </div>

            <div className="rounded-lg border border-line/45 bg-panel p-5">
              <h2 className="text-sm font-medium text-zinc-200">Pipeline stages</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {result.stages.map((stage) => (
                  <div key={stage.name} className={`rounded-lg border p-3 ${statusClass(stage.status)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-sm font-medium capitalize">{stage.name}</span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] opacity-80">
                          {stage.name === "draft"
                            ? generationModeLabel(result.generationMode)
                            : stage.name === "repair"
                              ? `${result.repairActions} Change${result.repairActions === 1 ? "" : "s"}`
                              : stage.name === "evaluate"
                                ? `Coverage ${promptCoveragePercent}%`
                                : stage.name === "domain fallback"
                                  ? "Safe runtime fallback"
                                  : stage.status === "warning"
                                    ? "Needs review"
                                    : "Ready"}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-zinc-500">{stage.durationMs}ms</span>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{stage.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border border-line/45 bg-panel p-5">
            <h2 className="text-sm font-medium text-zinc-200">Evaluation metrics</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {result.evaluation.metrics.map((metric) => (
                <div key={metric.key} className="rounded-lg border border-line/40 bg-elevated/10 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-200">{metric.label}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {metric.score}/{metric.maxScore}
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
                    <div
                      className="h-1.5 rounded-full bg-indigo-electric"
                      style={{ width: `${Math.round((metric.score / metric.maxScore) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">{metric.notes.join(" ")}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="space-y-8">
        {!activeConfig ? (
          <div className="rounded-lg border border-line bg-panel p-6 shadow-sm">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Empty workspace</p>
            <h2 className="mt-3 text-xl font-semibold text-white">Ready to generate your first app</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              GenStack will create a schema, CRUD APIs, dashboard pages, forms, tables, and analytics from your prompt.
            </p>
            <div className="mt-6 space-y-2 text-sm text-zinc-300">
              {["Generate schema", "Build runtime pages", "Wire CRUD endpoints", "Open generated dashboard"].map((item, index) => (
                <div className="flex items-center gap-3 rounded-md border border-line/60 bg-elevated/20 px-3 py-2" key={item}>
                  <span className="font-mono text-xs text-zinc-500">0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-line bg-elevated/25 px-3.5 py-2 text-xs text-zinc-300 hover:bg-elevated/50 transition duration-150"
              onClick={loadDemoData}
              type="button"
            >
              <Wand2 className="h-3.5 w-3.5 text-zinc-400" />
              Load Demo Data
            </button>
            {currentRuntime ? (
              <p className="mt-5 text-xs text-zinc-500">
                Current runtime: <span className="text-zinc-300">{currentRuntime.appName}</span>. New configs will ask before replacing it.
              </p>
            ) : null}
          </div>
        ) : null}

        {activeConfig ? (
          <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">Generated runtime</h2>
                <p className="mt-1 text-xs text-zinc-500 font-mono">{activeConfig.app.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-elevated/25 px-3 py-2 text-xs text-zinc-300 hover:bg-elevated/50 transition duration-150"
                  onClick={downloadActiveConfig}
                  type="button"
                >
                  <Download className="h-3.5 w-3.5 text-zinc-400" />
                  Download JSON
                </button>
                <button
                  className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-60 transition duration-150"
                  disabled={isApplying}
                  onClick={() => void applyConfig()}
                >
                  {isApplying ? "Applying..." : currentRuntime ? "Replace & Open App" : "Apply & Open App"}
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-md border border-line/40 bg-elevated/15 p-3">
                <p className="text-lg font-semibold font-mono text-zinc-100">{activeConfig.database.tables.length}</p>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Tables</p>
              </div>
              <div className="rounded-md border border-line/40 bg-elevated/15 p-3">
                <p className="text-lg font-semibold font-mono text-zinc-100">{activeConfig.ui.pages.length}</p>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Pages</p>
              </div>
              <div className="rounded-md border border-line/40 bg-elevated/15 p-3">
                <p className="text-lg font-semibold font-mono text-zinc-100">{activeConfig.api.endpoints.length}</p>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">APIs</p>
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">AI Reliability</h2>
                <p className="mt-1 text-xs text-zinc-500">Reviewer-facing summary of generation quality and repair activity.</p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-mono ${generationModeTone(result.generationMode)}`}>
                {result.generationMode}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-line/40 bg-elevated/15 p-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Generation Mode</p>
                <p className="mt-2 text-xs font-semibold text-zinc-100">{generationModeLabel(result.generationMode)}</p>
              </div>
              <div className="rounded-lg border border-line/40 bg-elevated/15 p-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Prompt Coverage</p>
                <p className={`mt-2 text-xs font-semibold ${promptCoverageTone(promptCoveragePercent)}`}>{promptCoveragePercent}%</p>
              </div>
              <div className="rounded-lg border border-line/40 bg-elevated/15 p-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">AI Confidence Score</p>
                <p className={`mt-2 text-xs font-semibold ${promptCoverageTone(confidenceScore)}`}>{confidenceScore}%</p>
              </div>
              <div className="rounded-lg border border-line/40 bg-elevated/15 p-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Repair Actions</p>
                <p className="mt-2 text-xs font-semibold text-zinc-100">{result.repairActions}</p>
              </div>
              <div className="rounded-lg border border-line/40 bg-elevated/15 p-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Validation Score</p>
                <p className="mt-2 text-xs font-semibold text-zinc-100">{validationScoreText}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-line/40 bg-elevated/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Overall Grade</p>
                <p className="text-sm font-semibold text-accent font-mono">{result.evaluation.grade}</p>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
                <div className="h-1.5 rounded-full bg-indigo-electric" style={{ width: `${scorePercent}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                {validationMetric?.notes.join(" ") ?? "Prompt coverage and validation are surfaced above for reviewers."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold text-zinc-200">Reliability Metrics</h2>
              <p className="mt-0.5 text-[10px] text-zinc-500">Aggregated local runs summary.</p>
            </div>
            <span className="rounded-full border border-line/60 bg-elevated/40 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              {reliability.totalRuns} runs
            </span>
          </div>

          <div className="mt-3.5 divide-y divide-line/40 text-xs">
            <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
              <span className="text-zinc-500">Structured Runs</span>
              <span className="font-semibold text-zinc-300 font-mono">{reliability.structuredRuns}</span>
            </div>
            <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
              <span className="text-zinc-500">Fallback Runs</span>
              <span className="font-semibold text-warning font-mono">{reliability.fallbackRuns}</span>
            </div>
            <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
              <span className="text-zinc-500">Average Repairs</span>
              <span className="font-semibold text-zinc-300 font-mono">{reliability.averageRepairs.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
              <span className="text-zinc-500">Repair-Free Runs</span>
              <span className="font-semibold text-zinc-300 font-mono">{reliability.repairFreeRuns}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold text-zinc-200">Reviewer Insights</h2>
              <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">Config validation & intent signals.</p>
            </div>
            <button
              className="rounded-md border border-line bg-elevated/25 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:bg-elevated/50 transition duration-150"
              onClick={() => setShowReviewerInsights((previous) => !previous)}
              type="button"
            >
              {showReviewerInsights ? "Collapse" : "Expand"}
            </button>
          </div>

          {showReviewerInsights ? (
            <div className="mt-4 space-y-4 animate-fadeIn">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 font-mono">Detected Intent</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result ? (
                    <>
                      {intentSignals.map((signal, index) => (
                        <span
                          className={index === 0 ? "rounded-full border border-accent/20 bg-accent/5 px-2 py-0.5 text-[10px] text-accent font-mono" : "rounded-full border border-line/60 bg-elevated/20 px-2 py-0.5 text-[10px] text-zinc-400 font-mono"}
                          key={`${signal}-${index}`}
                        >
                          {signal}
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500 leading-relaxed font-mono">Run a generation to inspect intent signals.</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 font-mono">Validation Findings</p>
                {result?.evaluation.blockers.length ? (
                  <div className="mt-2 space-y-1.5">
                    {result.evaluation.blockers.slice(0, 3).map((finding) => (
                      <div className="rounded-md border border-danger/25 bg-danger/5 p-2.5 text-[10px] text-zinc-300 font-mono" key={finding.path}>
                        <p className="font-semibold text-danger">{finding.path}</p>
                        <p className="mt-0.5 opacity-90">{finding.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-400 font-medium">✓ No blocking findings.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <History className="h-3.5 w-3.5 text-zinc-500" />
                Generation History
              </h2>
              <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">Repeated local quality logs.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-line bg-elevated/40 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                {generationHistory.length} runs
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {generationHistory.length > 0 ? (
              generationHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setPrompt(entry.prompt)}
                  className="w-full rounded-lg border border-line/40 bg-elevated/10 p-2.5 text-left transition duration-150 hover:border-line hover:bg-elevated/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-200">{entry.appName}</p>
                      <p className="mt-0.5 text-[9px] text-zinc-500 font-mono">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${generationModeTone(entry.generationMode)}`}>
                      {entry.generationMode}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                    <span>Grade: <strong className="text-zinc-200 font-semibold">{entry.grade}</strong></span>
                    <span className="text-zinc-700">•</span>
                    <span>Coverage: <strong className="text-zinc-200 font-semibold">{entry.promptCoverage}%</strong></span>
                    <span className="text-zinc-700">•</span>
                    <span>Repairs: <strong className="text-zinc-200 font-semibold">{entry.repairActions}</strong></span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-md border border-line/40 bg-elevated/5 p-4 text-xs text-zinc-500">
                Generation history will appear here after you run a prompt.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">Config JSON</h2>
              <p className="mt-1 text-xs text-zinc-500 font-mono">Developer details, hidden by default for demos.</p>
            </div>
            <button
              className="rounded-md border border-line bg-elevated/25 px-3 py-2 text-xs text-zinc-300 hover:bg-elevated/50 transition duration-150"
              onClick={() => setShowJson((previous) => !previous)}
              type="button"
            >
              {showJson ? "Hide JSON" : "Show JSON"}
            </button>
          </div>

          {showJson ? (
            <>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => void repairJson()}
                  disabled={isRepairing || jsonInput.trim().length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-elevated/25 px-3 py-2 text-xs text-zinc-300 disabled:opacity-60 hover:bg-elevated/50 transition duration-150"
                >
                  <Hammer className="h-3.5 w-3.5 text-zinc-400" />
                  {isRepairing ? "Repairing..." : "Repair"}
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                placeholder="Generated config appears here. Paste config JSON to repair it."
                className="mt-3 min-h-[360px] w-full resize-y rounded-md border border-line/50 bg-[#121212] p-4 font-mono text-xs leading-5 text-zinc-300 outline-none focus:border-accent"
              />
            </>
          ) : (
            <div className="mt-4 rounded-md border border-line/40 bg-elevated/5 p-4 text-xs text-zinc-500 leading-relaxed font-mono">
              JSON is available for inspection and repair, but the primary flow is generation, runtime readiness, and opening the app.
            </div>
          )}
        </div>

        {result ? (
          <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <Columns2 className="h-4 w-4 text-zinc-500" />
                  Config Diff Viewer
                </h2>
                <p className="mt-1 text-xs text-zinc-500 font-mono">Original draft vs final normalized config.</p>
              </div>
              <button
                className="rounded-md border border-line bg-elevated/25 px-3 py-2 text-xs text-zinc-300 hover:bg-elevated/50 transition duration-150"
                onClick={() => setShowDiff((previous) => !previous)}
                type="button"
              >
                {showDiff ? "Hide Diff" : "Show Diff"}
              </button>
            </div>

            <p className="mt-3 text-xs text-zinc-500 font-mono">
              {changedDiffLines} changed line{changedDiffLines === 1 ? "" : "s"} between the raw draft and the repaired config.
            </p>

            {showDiff ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.14em] text-zinc-500">Original Draft</p>
                  <div className="mt-2 max-h-[360px] overflow-auto rounded-md border border-line/40 bg-elevated/15 font-mono text-[11px] leading-5 text-zinc-400">
                    {diffLines.map((line) => (
                      <div className={`grid grid-cols-[3rem_1fr] gap-3 px-3 py-1.5 ${line.changed ? "bg-danger/5 text-zinc-300" : ""}`} key={`draft-${line.lineNumber}`}>
                        <span className="text-zinc-600">{line.lineNumber}</span>
                        <span className="whitespace-pre-wrap break-words">{line.draft || " "}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.14em] text-zinc-500">Final Config</p>
                  <div className="mt-2 max-h-[360px] overflow-auto rounded-md border border-line/40 bg-elevated/15 font-mono text-[11px] leading-5 text-zinc-400">
                    {diffLines.map((line) => (
                      <div className={`grid grid-cols-[3rem_1fr] gap-3 px-3 py-1.5 ${line.changed ? "bg-success/5 text-zinc-200" : ""}`} key={`final-${line.lineNumber}`}>
                        <span className="text-zinc-600">{line.lineNumber}</span>
                        <span className="whitespace-pre-wrap break-words">{line.final || " "}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-line/40 bg-elevated/5 p-4 text-xs text-zinc-500 leading-relaxed font-mono">
                Hidden for now. Toggle the diff viewer when you want to compare the raw draft with the repaired config.
              </div>
            )}
          </div>
        ) : null}

        {(repair?.findings ?? result?.repair.findings ?? []).length > 0 ? (
          <div className="rounded-lg border border-line/45 bg-panel p-5 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-200">Findings</h2>
            <div className="mt-4 space-y-2">
              {(repair?.findings ?? result?.repair.findings ?? []).slice(0, 8).map((finding, index) => (
                <div key={`${finding.path}-${index}`} className={`rounded-md border p-3 ${severityClass(finding.severity)}`}>
                  <div className="flex items-center gap-2">
                    {finding.severity === "error" ? <AlertTriangle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-zinc-400" />}
                    <span className="font-mono text-xs">{finding.path}</span>
                  </div>
                  <p className="mt-2 text-xs opacity-85 leading-relaxed">{finding.message}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
