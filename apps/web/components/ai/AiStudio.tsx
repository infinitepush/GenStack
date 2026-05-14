"use client";

import { AlertTriangle, CheckCircle2, Dumbbell, Hammer, Hospital, Play, ReceiptText, Sparkles, Target, Warehouse } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AppConfig } from "@genstack/config-types";
import { getActiveRuntime, saveRuntimeConfig, type RuntimeHistoryEntry } from "@/lib/runtime-history";

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

const examples = [
  "Build an expense tracker with dashboard, form, table, and analytics by category.",
  "Create a CRM for leads with stages, deal value, company name, and lead owner.",
  "Generate a task tracker with priority, status, due date, and a project dashboard."
];

const templates = [
  {
    icon: Target,
    title: "CRM System",
    prompt: "Create a CRM for leads with stages, deal value, company name, and lead owner."
  },
  {
    icon: ReceiptText,
    title: "Expense Tracker",
    prompt: "Build an expense tracker with dashboard, form, table, and analytics by category."
  },
  {
    icon: Dumbbell,
    title: "Gym Manager",
    prompt: "Build a gym manager for members, membership types, payments, classes, and bookings."
  },
  {
    icon: Hospital,
    title: "Hospital Billing",
    prompt: "Build a hospital billing app for patients, invoices, payment status, departments, and analytics."
  },
  {
    icon: Warehouse,
    title: "Inventory Manager",
    prompt: "Build an inventory manager for products, stock levels, suppliers, reorder status, and warehouse analytics."
  }
];

const generationSteps = ["Generating config", "Repairing schema", "Building runtime", "Preparing analytics"];

function statusClass(status: StageStatus): string {
  if (status === "error") return "border-red-500/50 bg-red-500/10 text-red-100";
  if (status === "warning") return "border-yellow-500/50 bg-yellow-500/10 text-yellow-100";
  return "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
}

function severityClass(severity: FindingSeverity): string {
  if (severity === "error") return "border-red-500/50 bg-red-500/10 text-red-100";
  if (severity === "warning") return "border-yellow-500/50 bg-yellow-500/10 text-yellow-100";
  return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const activeConfig = repair?.config ?? result?.config;
  const activeEvaluation = result?.evaluation;
  const runtimeReady = Boolean(activeEvaluation && activeEvaluation.blockers.length === 0);
  const scorePercent = useMemo(() => {
    if (!result) return 0;
    return Math.round((result.evaluation.score / result.evaluation.maxScore) * 100);
  }, [result]);

  useEffect(() => {
    setCurrentRuntime(getActiveRuntime());
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
      await postJson<unknown>("/config", activeConfig);
      const savedRuntime = saveRuntimeConfig(activeConfig, result?.prompt ?? prompt);
      setCurrentRuntime(savedRuntime);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      const firstRoute = activeConfig.ui.pages[0]?.route ?? "/dashboard";
      toast.success("Config applied. Opening generated app.");
      router.push(`/${locale}${firstRoute}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to apply config");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
      <section className="space-y-6">
        <div className="rounded-lg border border-line bg-panel/90 p-6 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-electric">AI Runtime Studio</p>
              <h1 className="mt-3 text-4xl font-semibold">Generate a working internal tool</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Start with an empty workspace, describe an app, then open a live CRUD dashboard generated from config.
              </p>
            </div>
            <Sparkles className="h-6 w-6 text-indigo-300" />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {templates.map((template) => (
              <button
                className="rounded-lg border border-line bg-black/25 p-4 text-left hover:border-indigo-electric/60 hover:bg-indigo-electric/10"
                key={template.title}
                onClick={() => setPrompt(template.prompt)}
                type="button"
              >
                <template.icon className="h-5 w-5 text-indigo-300" />
                <p className="mt-3 text-sm font-medium text-zinc-100">{template.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{template.prompt.split(" ").slice(0, 9).join(" ")}...</p>
              </button>
            ))}
          </div>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: Build a parking manager for vehicles, slots, payments, and analytics."
            className="mt-6 min-h-36 w-full resize-y rounded-lg border border-line bg-black/40 p-4 text-sm text-zinc-100 outline-none focus:border-indigo-electric"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                className="rounded-full border border-line bg-black/25 px-3 py-1.5 text-xs text-zinc-400 hover:border-indigo-electric/50 hover:text-zinc-100"
                key={example}
                onClick={() => setPrompt(example)}
                type="button"
              >
                {example.split(" ").slice(1, 4).join(" ")}
              </button>
            ))}
          </div>

          <button
            onClick={() => void runPipeline()}
            disabled={isGenerating || prompt.trim().length === 0}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {isGenerating ? "Running pipeline..." : "Run pipeline"}
          </button>

          {isGenerating ? (
            <div className="mt-5 grid gap-2 md:grid-cols-4">
              {generationSteps.map((step, index) => (
                <div className="rounded-md border border-indigo-400/30 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-100" key={step}>
                  <span className="mr-2 font-mono text-indigo-300">0{index + 1}</span>
                  {step}...
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="rounded-lg border border-line bg-panel p-5">
              <p className="text-sm text-zinc-400">Runtime status</p>
              <div className="mt-3 flex items-end gap-2">
                <span className={runtimeReady ? "text-3xl font-semibold text-emerald-300" : "text-3xl font-semibold text-yellow-300"}>
                  {runtimeReady ? "Runtime Ready" : "Needs Review"}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-xs text-zinc-500">
                <p>{result.config.database.tables.length} table(s) configured</p>
                <p>{result.config.api.endpoints.length} CRUD API route(s) generated</p>
                <p>{result.config.ui.pages.reduce((total, page) => total + page.components.length, 0)} runtime component(s)</p>
                <p>{result.evaluation.blockers.length} blocking issue(s)</p>
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                {result.provider} / {result.model}
              </p>
              <p className="mt-1 text-xs text-zinc-600">Evaluation grade {result.evaluation.grade} · {scorePercent}%</p>
            </div>

            <div className="rounded-lg border border-line bg-panel p-5">
              <h2 className="text-sm font-medium text-zinc-200">Pipeline stages</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {result.stages.map((stage) => (
                  <div key={stage.name} className={`rounded-lg border p-3 ${statusClass(stage.status)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium capitalize">{stage.name}</span>
                      <span className="font-mono text-xs">{stage.durationMs}ms</span>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{stage.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-sm font-medium text-zinc-200">Evaluation metrics</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {result.evaluation.metrics.map((metric) => (
                <div key={metric.key} className="rounded-lg border border-line bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-200">{metric.label}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {metric.score}/{metric.maxScore}
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-indigo-electric"
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

      <aside className="space-y-6">
        {!activeConfig ? (
          <div className="rounded-lg border border-indigo-400/20 bg-indigo-400/10 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-300">Empty workspace</p>
            <h2 className="mt-3 text-xl font-semibold text-white">Ready to generate your first app</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              GenStack will create a schema, CRUD APIs, dashboard pages, forms, tables, and analytics from your prompt.
            </p>
            <div className="mt-5 space-y-2 text-sm text-zinc-300">
              {["Generate schema", "Build runtime pages", "Wire CRUD endpoints", "Open generated dashboard"].map((item, index) => (
                <div className="flex items-center gap-3 rounded-md border border-line bg-black/20 px-3 py-2" key={item}>
                  <span className="font-mono text-xs text-indigo-300">0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            {currentRuntime ? (
              <p className="mt-4 text-xs text-zinc-500">
                Current runtime: <span className="text-zinc-300">{currentRuntime.appName}</span>. New configs will ask before replacing it.
              </p>
            ) : null}
          </div>
        ) : null}

        {activeConfig ? (
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">Generated runtime</h2>
                <p className="mt-1 text-xs text-zinc-500">{activeConfig.app.name}</p>
              </div>
              <button
                className="rounded-md bg-indigo-electric px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                disabled={isApplying}
                onClick={() => void applyConfig()}
              >
                {isApplying ? "Applying..." : currentRuntime ? "Replace & Open App" : "Apply & Open App"}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-black/30 p-3">
                <p className="text-lg font-semibold">{activeConfig.database.tables.length}</p>
                <p className="text-xs text-zinc-500">Tables</p>
              </div>
              <div className="rounded-md bg-black/30 p-3">
                <p className="text-lg font-semibold">{activeConfig.ui.pages.length}</p>
                <p className="text-xs text-zinc-500">Pages</p>
              </div>
              <div className="rounded-md bg-black/30 p-3">
                <p className="text-lg font-semibold">{activeConfig.api.endpoints.length}</p>
                <p className="text-xs text-zinc-500">APIs</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">Config JSON</h2>
              <p className="mt-1 text-xs text-zinc-500">Developer details, hidden by default for demos.</p>
            </div>
            <button
              className="rounded-md border border-line bg-black/30 px-3 py-2 text-xs text-zinc-200"
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
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-xs text-zinc-200 disabled:opacity-60"
                >
                  <Hammer className="h-3.5 w-3.5" />
                  {isRepairing ? "Repairing..." : "Repair"}
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                placeholder="Generated config appears here. Paste config JSON to repair it."
                className="mt-3 min-h-[360px] w-full resize-y rounded-md border border-line bg-black/60 p-4 font-mono text-xs leading-5 text-zinc-300 outline-none focus:border-indigo-electric"
              />
            </>
          ) : (
            <div className="mt-4 rounded-md border border-line bg-black/25 p-4 text-sm text-zinc-500">
              JSON is available for inspection and repair, but the primary flow is generation, runtime readiness, and opening the app.
            </div>
          )}
        </div>

        {(repair?.findings ?? result?.repair.findings ?? []).length > 0 ? (
          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-sm font-medium text-zinc-200">Findings</h2>
            <div className="mt-4 space-y-2">
              {(repair?.findings ?? result?.repair.findings ?? []).slice(0, 8).map((finding, index) => (
                <div key={`${finding.path}-${index}`} className={`rounded-md border p-3 ${severityClass(finding.severity)}`}>
                  <div className="flex items-center gap-2">
                    {finding.severity === "error" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="font-mono text-xs">{finding.path}</span>
                  </div>
                  <p className="mt-2 text-xs opacity-80">{finding.message}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
