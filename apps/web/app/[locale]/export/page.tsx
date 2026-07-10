"use client";

import { Archive, CheckCircle2, Download, Github, Loader2, XCircle, Info, ExternalLink, HelpCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { appConfig } from "@/lib/app-config";
import type { AppConfig } from "@genstack/config-types";
import { getActiveRuntime } from "@/lib/runtime-history";
import { EmptyState } from "@/components/onboarding/EmptyState";

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
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
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
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";

  const [activeConfig, setActiveConfig] = useState<AppConfig>(appConfig);
  const [repoName, setRepoName] = useState("");
  const [token, setToken] = useState("");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [exportStartTime, setExportStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [hasRuntime, setHasRuntime] = useState<boolean | null>(null);

  const stages = useMemo(
    () => [
      { name: "Generating project scaffold", complete: Boolean(job && job.filesTotal > 0) },
      { name: "Creating GitHub repository", complete: Boolean(job?.repoUrl) },
      { name: `Uploading files (${job?.filesExported ?? 0} / ${job?.filesTotal ?? 0})`, complete: Boolean(job && job.filesTotal > 0 && job.filesExported === job.filesTotal) },
      { name: "Finalizing", complete: job?.status === "completed" }
    ],
    [job]
  );

  useEffect(() => {
    const runtime = getActiveRuntime(userId);
    setHasRuntime(runtime !== null);
    const configToUse = runtime?.config ?? appConfig;
    setActiveConfig(configToUse);
    setRepoName(slugify(configToUse.app.name));
  }, [userId]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const interval = window.setInterval(async () => {
      try {
        const next = await readApi<ExportJob>(await fetch(`${apiBase()}/export/status/${job.id}`, { credentials: "include" }));
        setJob(next);

        if (next.status === "completed") {
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

  if (hasRuntime === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!hasRuntime) {
    return (
      <EmptyState
        locale={activeConfig.app.locale}
        icon={<Github className="h-7 w-7 text-zinc-500" />}
        title="No generated application to export"
        description="GenStack allows compiling and exporting the generated Next.js code workspace to a ZIP folder or directly onto GitHub. Generate an application first."
      />
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_420px] max-w-[1600px] mx-auto pb-12 animate-fadeIn">
      <div className="space-y-6">
        {/* GitHub Export Card */}
        <section className="premium-card p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#16181D] border border-line text-zinc-300">
              <Github className="h-5 w-5 text-accent" />
            </div>
            <div>
              <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
                GitHub integration
              </span>
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-1">{t("nav_export")}</h1>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Repository name</label>
              <input
                value={repoName}
                onChange={(event) => setRepoName(event.target.value)}
                className="w-full premium-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">GitHub Personal Access Token (PAT)</label>
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                type="password"
                placeholder="ghp_..."
                className="w-full premium-input"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Tokens are processed securely on the local backend and never stored.</p>
            </div>
            <button
              onClick={() => void startExport()}
              disabled={isStarting || token.trim().length === 0 || repoName.trim().length === 0}
              className="premium-btn-primary px-6 h-10 text-xs shadow-none"
            >
              {isStarting ? "Starting..." : t("btn_export")}
            </button>
          </div>
        </section>

        {/* ZIP Export Card */}
        <section className="premium-card p-6 md:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#16181D] border border-line text-zinc-300">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-200">Local ZIP Export</h2>
                <p className="mt-0.5 text-xs text-zinc-400">Download your generated app instantly as a compressed ZIP file.</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              No API credentials or tokens needed. You will receive a fully configured Next.js project with Tailwind CSS, Prisma schemas, and data visualizations ready to run locally.
            </p>
          </div>
          <button
            onClick={() => void downloadZip()}
            disabled={isDownloadingZip}
            className="mt-6 premium-btn-secondary px-5 h-10 text-xs flex items-center justify-center gap-2"
          >
            {isDownloadingZip ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Generating ZIP...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download ZIP Archive
              </>
            )}
          </button>
        </section>
      </div>

      <aside className="space-y-6">
        {/* PAT Guide */}
        <div className="premium-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-line">
            <HelpCircle className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">GitHub PAT Guide</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            GenStack uses a personal access token to create a repo and upload the code scaffold on your behalf.
          </p>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-line bg-card/25 p-3.5 space-y-2">
              <span className="font-semibold text-zinc-300 block">Option A: Fine-grained tokens (Recommended)</span>
              <p className="text-zinc-500 text-[10px]">Highly secure, scoped to specific repositories.</p>
              <a 
                href="https://github.com/settings/personal-access-tokens/new" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1 font-mono"
              >
                Generate Token <ExternalLink className="h-3 w-3" />
              </a>
              <div className="text-[10px] text-zinc-500 space-y-1 font-mono pt-1">
                <p>• Administration: <strong className="text-zinc-300">Read & Write</strong></p>
                <p>• Contents: <strong className="text-zinc-300">Read & Write</strong></p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-card/25 p-3.5 space-y-2">
              <span className="font-semibold text-zinc-300 block">Option B: Classic Tokens</span>
              <a 
                href="https://github.com/settings/tokens/new" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1 font-mono"
              >
                Generate Classic Token <ExternalLink className="h-3 w-3" />
              </a>
              <div className="text-[10px] text-zinc-500 font-mono pt-1">
                <p>• Select scope: <strong className="text-zinc-300">repo</strong> (Full control)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="premium-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-200">Progress</h2>
            {job && (job.status === "running" || job.status === "completed") && (
              <span className="font-mono text-[10px] text-zinc-500">Elapsed: {elapsedTime}s</span>
            )}
          </div>
          <div className="space-y-2.5">
            {stages.map((stage) => (
              <div key={stage.name} className="flex items-center gap-3 rounded-xl border border-line bg-card/20 p-2.5">
                {stage.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : job?.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-line" />
                )}
                <span className="text-xs text-zinc-300 font-mono">{stage.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Completed Info */}
        {job?.status === "completed" && (
          <div className="premium-card p-5 shadow-sm space-y-3.5 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Repository created successfully! ({elapsedTime}s)
            </div>
            {job.repoUrl && (
              <div className="space-y-1 text-xs">
                <span className="block text-[9px] uppercase font-bold text-zinc-500 font-mono">Repository URL</span>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={job.repoUrl}
                    className="flex-1 premium-input h-9 text-[11px]"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(job.repoUrl || "");
                      toast.success("Repository URL copied!");
                    }}
                    className="premium-btn-secondary px-3.5 text-xs h-9"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
