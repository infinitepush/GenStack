"use client";

import { CheckCircle2, Github, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { appConfig } from "@/lib/app-config";

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
  const [repoName, setRepoName] = useState(slugify(appConfig.app.name));
  const [token, setToken] = useState("");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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
    if (!job || job.status === "completed" || job.status === "failed") return;
    const interval = window.setInterval(async () => {
      try {
        const next = await readApi<ExportJob>(await fetch(`${apiBase()}/export/status/${job.id}`));
        setJob(next);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unable to poll export status");
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [job]);

  const startExport = async (): Promise<void> => {
    setIsStarting(true);
    try {
      const next = await readApi<ExportJob>(
        await fetch(`${apiBase()}/export/github`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoName, token, config: appConfig })
        })
      );
      setJob(next);
      toast.success("GitHub export started");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-lg border border-line bg-panel p-6">
        <div className="flex items-center gap-3">
          <Github className="h-7 w-7" />
          <div>
            <h1 className="text-3xl font-semibold">{t("nav_export")}</h1>
            <p className="mt-1 text-sm text-zinc-400">Generate a standalone Next.js app and push it to GitHub.</p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Repository name</label>
            <input
              value={repoName}
              onChange={(event) => setRepoName(event.target.value)}
              className="w-full rounded-md border border-line bg-black/40 px-3 py-2 text-sm outline-none focus:border-indigo-electric"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm text-zinc-300">GitHub token</label>
              <a className="text-xs text-indigo-300" href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
                How to get a token
              </a>
            </div>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              className="w-full rounded-md border border-line bg-black/40 px-3 py-2 text-sm outline-none focus:border-indigo-electric"
            />
            <p className="mt-2 text-xs text-zinc-500">Token needs: repo scope</p>
          </div>
          <button
            onClick={() => void startExport()}
            disabled={isStarting || token.trim().length === 0 || repoName.trim().length === 0}
            className="rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isStarting ? "Starting..." : t("btn_export")}
          </button>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-sm font-medium text-zinc-200">Progress</h2>
          <div className="mt-4 space-y-3">
            {stages.map((stage) => (
              <div key={stage.name} className="flex items-center gap-3 rounded-md border border-line bg-black/20 p-3">
                {stage.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                ) : job?.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-zinc-600" />
                )}
                <span className="text-sm text-zinc-300">{stage.name}</span>
              </div>
            ))}
          </div>
        </div>

        {job?.status === "completed" ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              Repository created
            </div>
            {job.repoUrl ? (
              <a className="mt-3 block text-sm text-indigo-200" href={job.repoUrl} target="_blank" rel="noreferrer">
                {job.repoUrl}
              </a>
            ) : null}
            <p className="mt-3 text-sm text-zinc-300">{job.filesExported} files exported</p>
            <pre className="mt-3 overflow-auto rounded-md bg-black/50 p-3 font-mono text-xs text-zinc-300">{job.cloneCommand}</pre>
          </div>
        ) : null}

        {job?.status === "failed" || (job?.errors.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5">
            <div className="flex items-center gap-2 text-red-200">
              <XCircle className="h-5 w-5" />
              Export issues
            </div>
            <div className="mt-3 space-y-2">
              {job?.errors.map((error, index) => (
                <p key={`${error.stage}-${index}`} className="text-sm text-red-100">
                  {error.stage}{error.path ? ` (${error.path})` : ""}: {error.message}
                </p>
              ))}
            </div>
            <button onClick={() => void startExport()} className="mt-4 rounded-md border border-red-400/40 px-3 py-2 text-sm text-red-100">
              Try again
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
