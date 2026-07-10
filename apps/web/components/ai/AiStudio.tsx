"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Columns2,
  Download,
  Dumbbell,
  Gauge,
  Hammer,
  History,
  Hospital,
  Play,
  Sparkles,
  Target,
  Wand2,
  Warehouse,
  ArrowRight,
  Sparkle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers3,
  Bot,
  Loader2
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { AppConfig } from "@genstack/config-types";
import { buildConfigDownloadName, downloadJson } from "@/lib/download-json";
import { loadReviewerDemoData } from "@/lib/demo-data";
import { getActiveRuntime, saveRuntimeConfig, type RuntimeHistoryEntry } from "@/lib/runtime-history";
import {
  readGenerationHistory,
  saveGenerationHistory,
  syncGenerationHistoryWithBackend,
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
    detail: "Tests relational thinking and funnel funnel metrics."
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
  if (status === "error") return "border-danger/35 bg-danger/5 text-danger";
  if (status === "warning") return "border-warning/35 bg-warning/5 text-warning";
  return "border-line bg-card/40 text-zinc-300";
}

function severityClass(severity: FindingSeverity): string {
  if (severity === "error") return "border-danger/35 bg-danger/5 text-danger";
  if (severity === "warning") return "border-warning/35 bg-warning/5 text-warning";
  return "border-line bg-card/30 text-zinc-300";
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
    ? "border-line bg-card/45 text-zinc-300"
    : "border-warning/35 bg-warning/5 text-warning";
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
  const baseUrl = typeof window !== "undefined" ? "/api/backend" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
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
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";
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

  // v2 Celebration & Autopilot State
  const [showCelebration, setShowCelebration] = useState(false);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [autopilotStep, setAutopilotStep] = useState("");

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

  // Autopilot script trigger
  const runDemoAutopilot = async (): Promise<void> => {
    setIsAutopilot(true);
    setShowCelebration(false);
    setResult(null);
    setRepair(null);

    try {
      const demoPrompt = "Build an Employee Management system with departments, salary tracking, and performance analytics.";
      setAutopilotStep("📋 Autofilling premium demo prompt...");
      setPrompt(demoPrompt);
      await new Promise((resolve) => setTimeout(resolve, 800));

      setAutopilotStep("🧠 AI Generator: Compiling schema and building routes...");
      setIsGenerating(true);
      const next = await postJson<PipelineRunResult>("/ai/generate", { prompt: demoPrompt });
      setResult(next);
      setJsonInput(JSON.stringify(next.config, null, 2));
      const coverage = getPromptCoveragePercent(next);
      
      const nextHistory = saveGenerationHistory(userId, {
        appName: next.config.app.name,
        prompt: next.prompt,
        generationMode: next.generationMode,
        repairActions: next.repairActions,
        validationScore: next.evaluation.score,
        validationMaxScore: next.evaluation.maxScore,
        promptCoverage: coverage,
        grade: next.evaluation.grade,
        intent: next.intent,
        config: next.config
      });
      setGenerationHistory(nextHistory);
      setIsGenerating(false);
      await new Promise((resolve) => setTimeout(resolve, 800));

      setAutopilotStep("🚀 Activating database tables and starting CRUD API endpoints...");
      setIsApplying(true);
      const applied = await postJson<{ config: AppConfig; version: number; changes: string[] }>("/config?origin=ai-studio", next.config);
      const savedRuntime = saveRuntimeConfig(applied.config, userId, demoPrompt);
      setCurrentRuntime(savedRuntime);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      setIsApplying(false);
      await new Promise((resolve) => setTimeout(resolve, 800));

      setAutopilotStep("✨ Inserting realistic sample mock data into employees...");
      const mockRes = await fetch("/api/backend/demo-data", { method: "POST", credentials: "include" });
      if (mockRes.ok) {
        const body = await mockRes.json();
        const total = body.data?.totalInserted ?? 12;
        toast.success(`Demo Mode: Added ${total} employee records.`);
      }
      
      setAutopilotStep("🎉 Redirecting to dashboard...");
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.success("Demo Autopilot finished successfully!");
      router.push(`/${locale}/dashboard`);
    } catch (err: any) {
      toast.error(`Autopilot error: ${err.message || "Something went wrong"}`);
    } finally {
      setIsAutopilot(false);
      setIsGenerating(false);
      setIsApplying(false);
      setAutopilotStep("");
    }
  };

  useEffect(() => {
    setCurrentRuntime(getActiveRuntime(userId));

    // Prefill check from landing redirect or Launchpad Example click
    const prefill = sessionStorage.getItem("genstack:prefill-prompt");
    if (prefill) {
      setPrompt(prefill);
      sessionStorage.removeItem("genstack:prefill-prompt");
    }

    // Auto trigger autopilot if landing page demo parameter is active
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("demo") === "true") {
      // Clear URL parameter so it doesn't loop
      window.history.replaceState({}, document.title, window.location.pathname);
      void runDemoAutopilot();
    }
    
    // Sync generation history from backend
    syncGenerationHistoryWithBackend(userId).then((synced) => {
      setGenerationHistory(synced);
    });
    
    // Load recent prompts from localStorage
    const scopedKey = `genstack:recent-prompts.${userId}`;
    const legacyKey = "genstack:recent-prompts";
    const legacyData = localStorage.getItem(legacyKey);
    if (legacyData && !localStorage.getItem(scopedKey)) {
      localStorage.setItem(scopedKey, legacyData);
      localStorage.removeItem(legacyKey);
    }
    const saved = localStorage.getItem(scopedKey);
    if (saved) {
      try {
        setRecentPrompts(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse recent prompts:", err);
      }
    }

    async function syncRecentPrompts() {
      if (userId === "_anonymous") return;
      try {
        const response = await fetch("/api/backend/user-data/recent_prompts", { credentials: "include" });
        if (response.ok) {
          const body = await response.json();
          if (body.success && Array.isArray(body.data)) {
            const remotePrompts = body.data as string[];
            const localSaved = localStorage.getItem(`genstack:recent-prompts.${userId}`);
            const localPrompts: string[] = localSaved ? JSON.parse(localSaved) : [];
            const merged = Array.from(new Set([...localPrompts, ...remotePrompts])).slice(0, 20);
            
            setRecentPrompts(merged);
            localStorage.setItem(`genstack:recent-prompts.${userId}`, JSON.stringify(merged));
            
            if (JSON.stringify(merged) !== JSON.stringify(remotePrompts)) {
              await fetch("/api/backend/user-data/recent_prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ value: merged })
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to sync recent prompts:", err);
      }
    }
    void syncRecentPrompts();

    const onConfigApplied = (): void => {
      setCurrentRuntime(getActiveRuntime(userId));
    };
    window.addEventListener("genstack:config-applied", onConfigApplied);
    return () => {
      window.removeEventListener("genstack:config-applied", onConfigApplied);
    };
  }, [userId]);

  const runPipeline = async (): Promise<void> => {
    setIsGenerating(true);
    setRepair(null);
    setShowCelebration(false);
    try {
      const next = await postJson<PipelineRunResult>("/ai/generate", { prompt });
      setResult(next);
      setJsonInput(JSON.stringify(next.config, null, 2));
      const promptCoverage = getPromptCoveragePercent(next);
      const nextHistory = saveGenerationHistory(userId, {
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
      
      const nextPrompts = [prompt, ...recentPrompts.filter(p => p !== prompt)].slice(0, 20);
      setRecentPrompts(nextPrompts);
      localStorage.setItem(`genstack:recent-prompts.${userId}`, JSON.stringify(nextPrompts));
      if (userId !== "_anonymous") {
        fetch("/api/backend/user-data/recent_prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: nextPrompts })
        }).catch(err => console.error("Failed to post recent prompts:", err));
      }

      toast.success("AI Generation completed!");
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
      const baseUrl = typeof window !== "undefined" ? "/api/backend" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
      const next = await postJson<{ config: AppConfig; version: number; changes: string[] }>("/config?origin=ai-studio", activeConfig);
      
      const getResponse = await fetch(`${baseUrl}/config`, { cache: "no-store", credentials: "include" });
      const getPayload = (await getResponse.json()) as ApiResponse<{ config: AppConfig }>;
      if (!getResponse.ok || !getPayload.success || !getPayload.data) {
        throw new Error(getPayload.error?.message ?? "Failed to fetch configuration for verification.");
      }
      
      const verified = getPayload.data;
      const match = JSON.stringify(verified.config) === JSON.stringify(next.config);
      if (!match) {
        throw new Error("Verification failed. Persisted configuration does not match the applied configuration.");
      }

      const savedRuntime = saveRuntimeConfig(verified.config, userId, result?.prompt ?? prompt);
      setCurrentRuntime(savedRuntime);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      
      const changeText = next.changes && next.changes.length > 0
        ? `\nApplied Changes:\n${next.changes.join("\n")}`
        : "";
      if (changeText) {
        console.log(changeText);
      }
      
      toast.success(`Config applied successfully (v1.0.${next.version})`);
      setShowCelebration(true); // Open celebration panel instead of immediate push
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
    const nextHistory = loadReviewerDemoData(userId);
    setGenerationHistory(nextHistory);
    setCurrentRuntime(getActiveRuntime(userId));
    window.dispatchEvent(new CustomEvent("genstack:config-applied"));
    toast.success("Reviewer demo data loaded");
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_420px] max-w-[1600px] mx-auto pb-12">
      <section className="space-y-6">
        {/* Title / Description */}
        <div className="premium-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
              AI App Compiler
            </span>
            <h1 className="mt-2 text-2xl font-bold text-zinc-100 tracking-tight">AI Generation Hub</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Generate tables, dynamic pages, CRUD forms, and visual analytics instantly.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runDemoAutopilot}
              disabled={isAutopilot || isGenerating || isApplying}
              className="premium-btn-secondary px-4 flex items-center gap-2 h-9 text-xs"
            >
              🎬 Watch Demo Autopilot
            </button>
          </div>
        </div>

        {/* Autopilot Status Bar */}
        {isAutopilot && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center gap-3 animate-pulse">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <p className="text-xs text-accent font-mono font-semibold">{autopilotStep}</p>
          </div>
        )}

        {/* Celebration Panel */}
        {showCelebration && activeConfig && (
          <div className="premium-card border-accent/40 bg-accent/5 p-6 md:p-8 relative overflow-hidden animate-fadeIn">
            {/* Ambient subtle green glow */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.12),transparent_70%)] glow-blob" />
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
                <Sparkle className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h2 className="text-lg font-bold text-zinc-100">🎉 Your application is ready!</h2>
                <p className="text-xs text-zinc-400">
                  GenStack has successfully applied &ldquo;{activeConfig.app.name}&rdquo; into the active runtime workspace.
                </p>
                <div className="mt-6 grid sm:grid-cols-2 gap-3.5">
                  <button
                    onClick={() => router.push(`/${activeConfig.app.locale}/dashboard`)}
                    className="premium-btn-primary flex items-center justify-between px-4 py-2 h-10 text-xs text-left"
                  >
                    <span>✓ Open Dashboard</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/backend/demo-data", { method: "POST", credentials: "include" });
                      if (res.ok) {
                        toast.success("Mock sample data loaded successfully!");
                        router.push(`/${activeConfig.app.locale}/dashboard`);
                      }
                    }}
                    className="premium-btn-secondary flex items-center justify-between px-4 py-2 h-10 text-xs text-left"
                  >
                    <span>✓ Insert Mock Data</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => router.push(`/${activeConfig.app.locale}/config`)}
                    className="premium-btn-secondary flex items-center justify-between px-4 py-2 h-10 text-xs text-left"
                  >
                    <span>✓ Customize JSON Config</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => router.push(`/${activeConfig.app.locale}/export`)}
                    className="premium-btn-secondary flex items-center justify-between px-4 py-2 h-10 text-xs text-left"
                  >
                    <span>✓ Export to GitHub</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Studio prompt area */}
        <div className="premium-card p-6 md:p-8 space-y-6">
          {/* Benchmark suggestions */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 font-mono">Not sure what to build?</label>
              <span className="text-[10px] text-zinc-500 font-mono">Pre-tested prompts</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {benchmarkPrompts.map((b) => (
                <button
                  key={b.title}
                  onClick={() => setPrompt(b.prompt)}
                  className="rounded-xl border border-line bg-card/40 hover:bg-hover px-3 py-1.5 text-xs text-zinc-300 transition duration-150 flex items-center gap-2"
                  type="button"
                >
                  <b.icon className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{b.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-zinc-300">Describe your application</span>
              <span className="text-[10px] text-zinc-500 font-mono">Use details to customize fields</span>
            </div>
            <div className="relative rounded-xl border border-line bg-card/20 p-2 transition duration-200 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/10">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your internal tool (e.g. Build a Sales CRM with lead names, conversions, and a conversions breakdown chart...)"
                className="w-full min-h-28 resize-y bg-transparent p-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none leading-relaxed"
                disabled={isAutopilot}
              />
              <div className="flex items-center justify-between border-t border-line/40 px-3 pt-2.5">
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-zinc-400 hover:bg-hover hover:text-zinc-200 transition"
                  onClick={loadDemoData}
                  type="button"
                >
                  <Wand2 className="h-4 w-4 text-zinc-500" />
                  Load Demo Data
                </button>
                <button
                  onClick={() => void runPipeline()}
                  disabled={isGenerating || isAutopilot || prompt.trim().length === 0}
                  className="premium-btn-primary px-5 flex items-center gap-2 h-9 text-xs"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Generate App
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Recent Prompts */}
          {recentPrompts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Recent Prompts</p>
              <div className="flex flex-wrap gap-2">
                {recentPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(p)}
                    className="max-w-[320px] truncate rounded-xl border border-line bg-card/30 hover:bg-hover px-3 py-1.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition"
                    title={p}
                    type="button"
                    disabled={isAutopilot}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generation Pipeline animation */}
          {isGenerating && (
            <div className="grid gap-3 sm:grid-cols-4 pt-4 border-t border-line/40 animate-fadeIn">
              {generationSteps.map((step, index) => (
                <div className="rounded-xl border border-line bg-card/30 px-3.5 py-3 text-xs text-zinc-300 flex items-center gap-2" key={step}>
                  <span className="font-mono text-zinc-500 text-[10px]">0{index + 1}</span>
                  <span>{step}...</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Reliability Grid */}
        {result && (
          <div className="grid gap-6 lg:grid-cols-[240px_1fr] animate-fadeIn">
            <div className="premium-card p-5 space-y-4">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Evaluation Summary</p>
              <div>
                <span className={runtimeReady ? "text-xl font-bold text-zinc-100" : "text-xl font-bold text-warning"}>
                  {runtimeReady ? "Runtime Ready" : "Needs Review"}
                </span>
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  Grade {result.evaluation.grade} · {scorePercent}% score
                </p>
              </div>
              <div className="space-y-2 text-xs text-zinc-400 font-mono border-t border-line/40 pt-4">
                <p>• {result.config.database.tables.length} tables</p>
                <p>• {result.config.api.endpoints.length} APIs</p>
                <p>• {result.evaluation.blockers.length} blockers</p>
              </div>
              <div className="pt-2">
                <p className="text-[10px] text-zinc-500 font-mono">{result.provider} / {result.model}</p>
              </div>
            </div>

            <div className="premium-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-200 font-mono uppercase tracking-wider">Pipeline Execution</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.stages.map((stage) => (
                  <div key={stage.name} className={`rounded-xl border p-3.5 ${statusClass(stage.status)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold capitalize">{stage.name}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{stage.durationMs}ms</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed opacity-80">{stage.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Evaluation breakdown */}
        {result && (
          <div className="premium-card p-6 space-y-5 animate-fadeIn">
            <h2 className="text-sm font-bold text-zinc-200 font-mono uppercase tracking-wider">Validation Metrics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {result.evaluation.metrics.map((metric) => (
                <div key={metric.key} className="rounded-xl border border-line bg-card/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-zinc-200">{metric.label}</p>
                    <p className="font-mono text-xs text-zinc-500">{metric.score}/{metric.maxScore}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800">
                    <div
                      className="h-1.5 rounded-full bg-accent"
                      style={{ width: `${Math.round((metric.score / metric.maxScore) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">{metric.notes.join(" ")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Sidebar Controls & History */}
      <aside className="space-y-6">
        {/* Workspace state / Actions */}
        {!activeConfig ? (
          <div className="premium-card p-6 space-y-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Empty Workspace</p>
            <h2 className="text-lg font-bold text-zinc-200">Generator Studio Ready</h2>
            <p className="text-xs leading-relaxed text-zinc-400">
              Submit a prompt to compile dynamic schemas and dashboard UI pages instantly.
            </p>
            <div className="space-y-2 text-xs text-zinc-300 font-mono pt-2">
              {["Generate database schema", "Build dashboard components", "Configure REST API routes", "Add mock sample data"].map((item, index) => (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-card/35 px-3.5 py-2.5" key={item}>
                  <span className="text-zinc-500 font-bold">0{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={loadDemoData}
              className="w-full premium-btn-secondary flex items-center justify-center gap-2 h-10 text-xs"
              type="button"
            >
              <Wand2 className="h-4 w-4" />
              Load Reviewer Demo Data
            </button>
          </div>
        ) : (
          <div className="premium-card p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line/40 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Generated Config</h2>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{activeConfig.app.name}</p>
              </div>
              <button
                onClick={downloadActiveConfig}
                className="rounded-xl border border-line bg-card/30 hover:bg-hover px-3 py-1.5 text-[11px] font-semibold text-zinc-300 flex items-center gap-2"
                type="button"
              >
                <Download className="h-3.5 w-3.5 text-zinc-500" />
                JSON
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="rounded-xl border border-line bg-card/30 p-2.5">
                <p className="text-base font-bold font-mono text-zinc-200">{activeConfig.database.tables.length}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Tables</p>
              </div>
              <div className="rounded-xl border border-line bg-card/30 p-2.5">
                <p className="text-base font-bold font-mono text-zinc-200">{activeConfig.ui.pages.length}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Pages</p>
              </div>
              <div className="rounded-xl border border-line bg-card/30 p-2.5">
                <p className="text-base font-bold font-mono text-zinc-200">{activeConfig.api.endpoints.length}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">APIs</p>
              </div>
            </div>

            <button
              onClick={() => void applyConfig()}
              disabled={isApplying || isAutopilot}
              className="w-full premium-btn-primary flex items-center justify-center gap-2 h-10 text-xs"
            >
              <Sparkles className="h-4 w-4 animate-pulse" />
              {isApplying ? "Applying..." : "Apply & Build Application"}
            </button>
          </div>
        )}

        {/* AI Reliability Grade Cards */}
        {result && (
          <div className="premium-card p-6 space-y-4 animate-fadeIn">
            <h2 className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider">AI Reliability</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-line bg-card/20 p-3">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Mode</span>
                <span className="font-bold text-zinc-200 mt-1 block">{result.generationMode}</span>
              </div>
              <div className="rounded-xl border border-line bg-card/20 p-3">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Confidence</span>
                <span className="font-bold text-accent mt-1 block">{confidenceScore}%</span>
              </div>
              <div className="rounded-xl border border-line bg-card/20 p-3">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Prompt Coverage</span>
                <span className="font-bold text-zinc-200 mt-1 block">{promptCoveragePercent}%</span>
              </div>
              <div className="rounded-xl border border-line bg-card/20 p-3">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Repairs</span>
                <span className="font-bold text-zinc-200 mt-1 block">{result.repairActions} actions</span>
              </div>
            </div>
          </div>
        )}

        {/* Global Quality Stats */}
        <div className="premium-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-zinc-200 font-mono uppercase tracking-wider">Quality Stats</h2>
            <span className="rounded-full border border-line bg-card/60 px-2 py-0.5 text-[9px] font-mono text-zinc-400">
              {reliability.totalRuns} runs
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-line/40">
              <span className="text-zinc-500">Structured Generation</span>
              <span className="text-zinc-300 font-bold">{reliability.structuredRuns}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line/40">
              <span className="text-zinc-500">Repairs Applied</span>
              <span className="text-zinc-300 font-bold">{reliability.averageRepairs.toFixed(1)} avg</span>
            </div>
            <div className="flex justify-between py-1 last:border-0">
              <span className="text-zinc-500">Clean Complies</span>
              <span className="text-emerald-400 font-bold">{reliability.repairFreeRuns} runs</span>
            </div>
          </div>
        </div>

        {/* Reviewer Insights panel */}
        <div className="premium-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-zinc-200 font-mono uppercase tracking-wider">Reviewer Insights</h2>
            <button
              onClick={() => setShowReviewerInsights(!showReviewerInsights)}
              className="text-[10px] font-bold text-accent font-mono uppercase tracking-wider"
              type="button"
            >
              {showReviewerInsights ? "Hide" : "Show"}
            </button>
          </div>

          {showReviewerInsights && (
            <div className="space-y-4 pt-2 border-t border-line/40 animate-fadeIn text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Intent Signals</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result ? (
                    intentSignals.map((signal, idx) => (
                      <span
                        key={idx}
                        className={idx === 0 ? "rounded-lg border border-accent/20 bg-accent/5 px-2 py-0.5 text-[10px] text-accent font-mono" : "rounded-lg border border-line bg-card/25 px-2 py-0.5 text-[10px] text-zinc-400 font-mono"}
                      >
                        {signal}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-mono">Generate an app to view intent signals.</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Blockers Checker</p>
                {result?.evaluation.blockers.length ? (
                  <div className="mt-2 space-y-1.5">
                    {result.evaluation.blockers.slice(0, 3).map((blocker) => (
                      <div className="rounded-xl border border-danger/35 bg-danger/5 p-2.5 font-mono text-[10px] text-zinc-300" key={blocker.path}>
                        <p className="font-semibold text-danger">{blocker.path}</p>
                        <p className="mt-0.5">{blocker.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 font-semibold font-mono mt-1.5">✓ 0 blockers in current build.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Generation History logs */}
        <div className="premium-card p-6 space-y-4">
          <h2 className="text-xs font-bold text-zinc-200 font-mono uppercase tracking-wider">Generation History</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {generationHistory.length > 0 ? (
              generationHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setPrompt(entry.prompt)}
                  className="w-full rounded-xl border border-line bg-card/20 p-3 text-left transition hover:border-line/80 hover:bg-card/45"
                  disabled={isAutopilot}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-zinc-200 truncate block max-w-[150px]">{entry.appName}</span>
                    <span className={`rounded px-1 text-[8px] font-mono uppercase tracking-wider ${generationModeTone(entry.generationMode)}`}>
                      {entry.generationMode}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1 font-mono">{new Date(entry.createdAt).toLocaleDateString()}</p>
                </button>
              ))
            ) : (
              <p className="text-xs text-zinc-500 font-mono">No previous generation runs logs.</p>
            )}
          </div>
        </div>

        {/* Developer JSON Config details */}
        <div className="premium-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-zinc-200 font-mono uppercase tracking-wider">Developer Inspector</h2>
              <p className="text-[9px] text-zinc-500 font-mono mt-0.5">Direct configuration details</p>
            </div>
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-[10px] font-bold text-accent font-mono uppercase tracking-wider"
              type="button"
            >
              {showJson ? "Hide" : "Show"}
            </button>
          </div>

          {showJson && (
            <div className="space-y-3.5 pt-2 border-t border-line/40 animate-fadeIn">
              <div className="flex justify-end">
                <button
                  onClick={repairJson}
                  disabled={isRepairing || jsonInput.trim().length === 0}
                  className="rounded-xl border border-line bg-card/40 hover:bg-hover px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-60 transition flex items-center gap-1.5"
                >
                  <Hammer className="h-3.5 w-3.5 text-zinc-500" />
                  {isRepairing ? "Repairing..." : "Run Repair"}
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Developer JSON schema configuration"
                className="w-full min-h-60 rounded-xl border border-line bg-card/25 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 outline-none focus:border-accent"
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
