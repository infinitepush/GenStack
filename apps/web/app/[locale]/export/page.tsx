"use client";

import { Archive, CheckCircle2, Download, Github, Loader2, XCircle, Info, ExternalLink, HelpCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { appConfig } from "@/lib/app-config";
import type { AppConfig } from "@genstack/config-types";
import { getActiveRuntime } from "@/lib/runtime-history";

interface ExportError {
  stage: string;
  path?: string;
  message: string;
}

interface ExportJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  repoName: string;
  repoUrl?: string;
  filesTotal: number;
  filesExported: number;
  errors: ExportError[];
  cloneCommand?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string } | null;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "generated-app";
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }
  return payload.data;
}

export default function ExportPage(): JSX.Element {
  const t = useTranslations();
  const [activeConfig, setActiveConfig] = useState<AppConfig>(appConfig);
  const [repoName, setRepoName] = useState("");
  const [token, setToken] = useState("");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [exportStartTime, setExportStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  const stages = useMemo(
    () => [
      { name: "Generating project scaffold", complete: Boolean(job && job.filesTotal > 0) },
      { name: "Creating GitHub repository", complete: Boolean(job?.repoUrl) },
      { name: `Uploading files (${job?.filesExported ?? 0} / ${job?.filesTotal ?? 0})`, complete: Boolean(job && job.filesTotal > 0 && job.filesExported === job.filesTotal) },
      { name: "Finalizing", complete: job?.status === "completed" }
    ],
    [job]
  );

  // Dynamically resolve configuration on mount
  useEffect(() => {
    const runtime = getActiveRuntime();
    const configToUse = runtime?.config ?? appConfig;
    setActiveConfig(configToUse);
    setRepoName(slugify(configToUse.app.name));
  }, []);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const interval = window.setInterval(async () => {
      try {
        const next = await readApi<ExportJob>(await fetch(`${apiBase()}/export/status/${job.id}`, { credentials: "include" }));
        setJob(next);

        if (next.status === "completed") {
          // Log success timeline activity
          await fetch(`${apiBase()}/runtime/activity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              type: "GITHUB_EXPORTED",
              message: `Exported Next.js app "${next.repoName}" successfully to GitHub.`
            })
          }).catch(err => console.error("Failed to log activity:", err));
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unable to poll export status");
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [job]);

  useEffect(() => {
    if (!exportStartTime || !job || job.status === "completed" || job.status === "failed") return;
    const timer = window.setInterval(() => {
      setElapsedTime(Math.round((Date.now() - exportStartTime) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exportStartTime, job]);

  const startExport = async (): Promise<void> => {
    setIsStarting(true);
    setExportStartTime(Date.now());
    setElapsedTime(0);
    try {
      const next = await readApi<ExportJob>(
        await fetch(`${apiBase()}/export/github`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ repoName, token, config: activeConfig })
        })
      );
      setJob(next);
      toast.success("GitHub export started");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Export failed");
      setExportStartTime(null);
    } finally {
      setIsStarting(false);
    }
  };

  const downloadZip = async (): Promise<void> => {
    setIsDownloadingZip(true);
    try {
      const response = await fetch(`${apiBase()}/export/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ config: activeConfig })
      });
      if (!response.ok) {
        throw new Error("Failed to download ZIP");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${slugify(activeConfig.app.name)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("ZIP archive downloaded successfully");

      // Log success timeline activity
      await fetch(`${apiBase()}/runtime/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "ZIP_DOWNLOADED",
          message: `Downloaded local ZIP archive for Next.js app "${activeConfig.app.name}".`
        })
      }).catch(err => console.error("Failed to log activity:", err));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download ZIP");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_420px] max-w-[1600px] mx-auto">
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-panel p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Github className="h-6 w-6 text-zinc-400" />
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">{t("nav_export")}</h1>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">Generate a standalone Next.js app and push it directly to GitHub.</p>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Repository name</label>
              <input
                value={repoName}
                onChange={(event) => setRepoName(event.target.value)}
                className="w-full h-9 rounded-md border border-line/50 bg-[#121212] px-3 text-xs text-zinc-200 outline-none focus:border-accent focus:ring-0 transition"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-400">GitHub Personal Access Token (PAT)</label>
              </div>
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                type="password"
                placeholder="ghp_..."
                className="w-full h-9 rounded-md border border-line/50 bg-[#121212] px-3 text-xs text-zinc-200 outline-none focus:border-accent focus:ring-0 transition"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Tokens are processed securely on the local backend and never stored.</p>
            </div>
            <button
              onClick={() => void startExport()}
              disabled={isStarting || token.trim().length === 0 || repoName.trim().length === 0}
              className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition disabled:opacity-50 shadow-none"
            >
              {isStarting ? "Starting..." : t("btn_export")}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-6 md:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-line/50 bg-elevated text-zinc-400">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-200">Local ZIP Export</h2>
                <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">Download your generated app instantly as a compressed ZIP file.</p>
              </div>
            </div>
            <p className="mt-3.5 text-[11px] leading-relaxed text-zinc-500">
              No API credentials or tokens needed. You will receive a fully configured Next.js project with Tailwind CSS, Prisma schemas, and data visualizations ready to run locally.
            </p>
          </div>
          <button
            onClick={() => void downloadZip()}
            disabled={isDownloadingZip}
            className="mt-6 rounded-md bg-elevated/30 border border-line hover:bg-elevated/50 px-4 py-2 text-xs font-semibold text-zinc-300 flex items-center justify-center gap-2 disabled:opacity-60 transition duration-150"
          >
            {isDownloadingZip ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating ZIP...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download ZIP Archive
              </>
            )}
          </button>
        </section>
      </div>

      <aside className="space-y-6">
        {/* Onboarding Guide Card */}
        <div className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-line/40">
            <HelpCircle className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">GitHub PAT Guide</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            GenStack uses a personal access token to create a repo and upload the code scaffold on your behalf.
          </p>

          <div className="space-y-3.5 text-xs">
            <div className="rounded-md bg-elevated/20 border border-line/40 p-3 space-y-2">
              <span className="font-semibold text-zinc-300 block">Option A: Fine-grained tokens (Recommended)</span>
              <p className="text-zinc-500 text-[11px]">
                Highly secure, scoped to specific repositories.
              </p>
              <a 
                href="https://github.com/settings/personal-access-tokens/new" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1 font-mono"
              >
                Generate Token <ExternalLink className="h-3 w-3" />
              </a>
              <div className="text-[10px] text-zinc-400 space-y-1 font-mono pt-1">
                <p>• Repository access: <strong className="text-zinc-300">All</strong> or <strong className="text-zinc-300">Select repos</strong></p>
                <p>• Administration: <strong className="text-emerald-400">Read & Write</strong></p>
                <p>• Contents: <strong className="text-emerald-400">Read & Write</strong></p>
                <p>• Metadata: <strong className="text-zinc-400">Read-only (auto)</strong></p>
              </div>
            </div>

            <div className="rounded-md bg-elevated/20 border border-line/40 p-3 space-y-2">
              <span className="font-semibold text-zinc-300 block">Option B: Classic Tokens</span>
              <p className="text-zinc-500 text-[11px]">
                Legacy token style supporting broad scopes.
              </p>
              <a 
                href="https://github.com/settings/tokens/new" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1 font-mono"
              >
                Generate Classic Token <ExternalLink className="h-3 w-3" />
              </a>
              <div className="text-[10px] text-zinc-400 space-y-1 font-mono pt-1">
                <p>• Select scope: <strong className="text-emerald-400">repo</strong> (Full control of repositories)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="rounded-lg border border-line bg-panel p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-200">Progress</h2>
            {job && (job.status === "running" || job.status === "completed") && (
              <span className="font-mono text-[10px] text-zinc-500">
                Elapsed: {elapsedTime}s
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2.5">
            {stages.map((stage) => (
              <div key={stage.name} className="flex items-center gap-3 rounded-md border border-line/40 bg-elevated/10 p-2.5">
                {stage.complete ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                ) : job?.status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-line/80" />
                )}
                <span className="text-xs text-zinc-300 font-mono">{stage.name}</span>
              </div>
            ))}
          </div>
        </div>

        {job?.status === "completed" ? (
          <div className="rounded-lg border border-line bg-[#181818] p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Repository created ({elapsedTime}s)
            </div>
            {job.repoUrl ? (
              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Repository URL</span>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={job.repoUrl}
                    className="flex-1 h-8 rounded border border-line/50 bg-[#121212] px-2 text-[11px] text-zinc-300 font-mono outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(job.repoUrl || "");
                      toast.success("Repository URL copied to clipboard");
                    }}
                    className="h-8 rounded border border-line bg-elevated px-3 text-[10px] font-semibold text-zinc-300 hover:bg-elevated/80 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}
            <p className="text-xs text-zinc-300 font-mono">{job.filesExported} files exported</p>
            
            {job.cloneCommand ? (
              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Clone Command</span>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={job.cloneCommand}
                    className="flex-1 h-8 rounded border border-line/50 bg-[#121212] px-2 text-[11px] text-zinc-300 font-mono outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(job.cloneCommand || "");
                      toast.success("Clone command copied to clipboard");
                    }}
                    className="h-8 rounded border border-line bg-elevated px-3 text-[10px] font-semibold text-zinc-300 hover:bg-elevated/80 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {job?.status === "failed" || (job?.errors.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-danger/25 bg-danger/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-danger">
              <XCircle className="h-4 w-4" />
              Export issues
            </div>
            <div className="mt-3 space-y-2 font-mono text-[11px]">
              {job?.errors.map((error, index) => (
                <div key={index} className="border-b border-danger/10 pb-2 last:border-b-0 last:pb-0 font-mono">
                  <p className="font-semibold text-danger">{error.stage}</p>
                  {error.path && <p className="text-zinc-500 text-[10px]">File: {error.path}</p>}
                  <p className="text-zinc-300 mt-0.5">{error.message}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
