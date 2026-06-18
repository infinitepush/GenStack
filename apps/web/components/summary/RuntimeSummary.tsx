"use client";

import { ArrowRight, Download, Gauge, RefreshCw, Sparkles, History, Wand2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildConfigDownloadName, downloadJson } from "@/lib/download-json";
import { loadReviewerDemoData, getReviewerDemoConfig } from "@/lib/demo-data";
import { readGenerationHistory, type GenerationHistoryEntry } from "@/lib/generation-history";
import { calculateAiConfidenceScore, summarizeReliability } from "@/lib/reviewer-metrics";
import { getActiveRuntime, type RuntimeHistoryEntry } from "@/lib/runtime-history";

interface RuntimeSummaryProps {
  locale: string;
}

function confidenceClass(value: number): string {
  if (value >= 90) return "text-emerald-300";
  if (value >= 75) return "text-indigo-200";
  if (value >= 60) return "text-yellow-200";
  return "text-red-200";
}

function confidenceTone(value: number): string {
  if (value >= 90) return "border-emerald-500/30 bg-emerald-500/10";
  if (value >= 75) return "border-indigo-500/30 bg-indigo-500/10";
  if (value >= 60) return "border-yellow-500/30 bg-yellow-500/10";
  return "border-red-500/30 bg-red-500/10";
}

function formatConfidence(entry: GenerationHistoryEntry | null): number {
  if (!entry) return 0;
  return calculateAiConfidenceScore({
    generationMode: entry.generationMode,
    validationPercent: entry.validationMaxScore > 0 ? (entry.validationScore / entry.validationMaxScore) * 100 : 0,
    promptCoveragePercent: entry.promptCoverage,
    repairActions: entry.repairActions
  });
}

export function RuntimeSummary({ locale }: RuntimeSummaryProps): JSX.Element {
  const t = useTranslations();
  const [history, setHistory] = useState<GenerationHistoryEntry[]>([]);
  const [currentRuntime, setCurrentRuntime] = useState<RuntimeHistoryEntry | null>(null);

  useEffect(() => {
    const sync = (): void => {
      setHistory(readGenerationHistory());
      setCurrentRuntime(getActiveRuntime());
    };

    sync();
    const onConfigApplied = (): void => sync();
    window.addEventListener("genstack:config-applied", onConfigApplied);
    return () => {
      window.removeEventListener("genstack:config-applied", onConfigApplied);
    };
  }, []);

  const reliability = useMemo(() => summarizeReliability(history), [history]);
  const latestEntry = history[0] ?? null;
  const latestConfidence = formatConfidence(latestEntry);
  const activeConfig = currentRuntime?.config ?? latestEntry?.config ?? getReviewerDemoConfig();
  const hasRuntime = Boolean(currentRuntime);
  const currentRuntimeRoute = currentRuntime?.config.ui.pages[0]?.route;

  const handleLoadDemoData = (): void => {
    const nextHistory = loadReviewerDemoData();
    setHistory(nextHistory);
    setCurrentRuntime(getActiveRuntime());
    window.dispatchEvent(new CustomEvent("genstack:config-applied"));
    toast.success("Reviewer demo data loaded");
  };

  const handleDownloadConfig = (): void => {
    downloadJson(buildConfigDownloadName(activeConfig), activeConfig);
    toast.success("Config downloaded");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-panel/90 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-electric">{t("nav_runtime_overview")}</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Reviewer-ready runtime summary</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              This page makes generation quality visible at a glance: confidence, structured runs, fallback runs, repair cost, and a local history of recent generations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
              onClick={handleLoadDemoData}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              Load Demo Data
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
              onClick={handleDownloadConfig}
              type="button"
            >
              <Download className="h-4 w-4" />
              Download Config JSON
            </button>
            <Link
              className="inline-flex items-center gap-2 rounded-md bg-indigo-electric px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              href={`/${locale}/ai`}
            >
              Open AI Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">AI Confidence Score</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className={`text-4xl font-semibold ${confidenceClass(latestConfidence)}`}>{latestConfidence}%</p>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${confidenceTone(latestConfidence)}`}>
              Latest run
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Derived from validation score, prompt coverage, generation mode, and repair cost.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Structured Runs</p>
          <p className="mt-3 text-4xl font-semibold text-indigo-200">{reliability.structuredRuns}</p>
          <p className="mt-3 text-xs text-zinc-500">Runs returned valid structured Gemini output.</p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Fallback Runs</p>
          <p className="mt-3 text-4xl font-semibold text-yellow-200">{reliability.fallbackRuns}</p>
          <p className="mt-3 text-xs text-zinc-500">Runs that used legacy parsing or safety fallback.</p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Repair-Free Runs</p>
          <p className="mt-3 text-4xl font-semibold text-emerald-200">{reliability.repairFreeRuns}</p>
          <p className="mt-3 text-xs text-zinc-500">Runs that passed without needing config repair.</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-electric">Reliability Metrics</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Generation quality summary</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-black/25 px-3 py-1 text-[11px] text-zinc-400">
              <RefreshCw className="h-3.5 w-3.5" />
              {reliability.totalRuns} run(s)
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Average Repairs</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reliability.averageRepairs.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-line bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Repair-Free Rate</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reliability.repairFreeRate}%</p>
            </div>
            <div className="rounded-lg border border-line bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Average Confidence</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reliability.averageConfidence}%</p>
            </div>
            <div className="rounded-lg border border-line bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Latest Mode</p>
              <p className="mt-2 text-3xl font-semibold text-white">{latestEntry?.generationMode ?? "n/a"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Structured</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">{reliability.structuredRuns}</p>
            </div>
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Fallback</p>
              <p className="mt-2 text-2xl font-semibold text-yellow-100">{reliability.fallbackRuns}</p>
            </div>
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Current</p>
              <p className="mt-2 text-2xl font-semibold text-indigo-100">{history[0]?.grade ?? "n/a"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-electric">Current Runtime</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{hasRuntime ? currentRuntime?.appName : "No active runtime"}</h2>
            </div>
            <Gauge className="h-5 w-5 text-indigo-300" />
          </div>

          {hasRuntime ? (
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-line bg-black/20 p-3">
                  <p className="text-2xl font-semibold text-white">{currentRuntime?.config.database.tables.length ?? 0}</p>
                  <p className="text-xs text-zinc-500">Tables</p>
                </div>
                <div className="rounded-lg border border-line bg-black/20 p-3">
                  <p className="text-2xl font-semibold text-white">{currentRuntime?.config.ui.pages.length ?? 0}</p>
                  <p className="text-xs text-zinc-500">Pages</p>
                </div>
                <div className="rounded-lg border border-line bg-black/20 p-3">
                  <p className="text-2xl font-semibold text-white">{currentRuntime?.config.api.endpoints.length ?? 0}</p>
                  <p className="text-xs text-zinc-500">APIs</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-zinc-400">
                The sidebar and runtime pages are driven by this active config. Click a generation in the history below to restore a prior app.
              </p>
              {currentRuntimeRoute ? (
                <Link
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  href={`/${locale}${currentRuntimeRoute}`}
                >
                  Open generated app
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-5">
              <p className="text-sm text-indigo-100">No runtime is active yet. Load demo data to see a ready-made workspace.</p>
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                onClick={handleLoadDemoData}
                type="button"
              >
                <Wand2 className="h-4 w-4" />
                Load Demo Data
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-electric">Generation History</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Evidence of consistent generation quality</h2>
              <p className="mt-2 text-xs text-zinc-500">Click any generation card to download its config JSON.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-black/25 px-3 py-1 text-[11px] text-zinc-400">
              <History className="h-3.5 w-3.5" />
              {history.length} item(s)
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {history.length > 0 ? (
              history.map((entry) => {
                const confidence = formatConfidence(entry);
                return (
                  <button
                    className="w-full rounded-lg border border-line bg-black/25 p-4 text-left transition hover:border-indigo-electric/50 hover:bg-indigo-electric/10"
                    key={entry.id}
                    onClick={() => downloadJson(buildConfigDownloadName(entry.config), entry.config)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{entry.appName}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(entry.createdAt).toLocaleString()} · Grade {entry.grade}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] ${confidenceTone(confidence)}`}>
                        {confidence}%
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-black/30 p-2">
                        <p className="text-[11px] text-zinc-500">Mode</p>
                        <p className="mt-1 text-sm font-semibold text-white">{entry.generationMode}</p>
                      </div>
                      <div className="rounded-md bg-black/30 p-2">
                        <p className="text-[11px] text-zinc-500">Coverage</p>
                        <p className="mt-1 text-sm font-semibold text-white">{entry.promptCoverage}%</p>
                      </div>
                      <div className="rounded-md bg-black/30 p-2">
                        <p className="text-[11px] text-zinc-500">Repair</p>
                        <p className="mt-1 text-sm font-semibold text-white">{entry.repairActions}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-line bg-black/20 p-5 text-sm text-zinc-500">
                No generations have been recorded yet. Load demo data or run a prompt in AI Studio to populate this section.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-electric">Reviewer Insights</p>
              <h2 className="mt-2 text-xl font-semibold text-white">What the reviewer can verify immediately</h2>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-300" />
          </div>

          <div className="mt-5 space-y-3 text-sm text-zinc-300">
            {[
              "Structured vs fallback generation is counted in the reliability metrics.",
              "Average repairs and repair-free runs show how much the repair pipeline is doing.",
              "AI confidence is derived from validation, prompt coverage, generation mode, and repair load.",
              "Demo data can seed a ready-to-review workspace in one click."
            ].map((item) => (
              <div className="rounded-lg border border-line bg-black/20 p-4" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
