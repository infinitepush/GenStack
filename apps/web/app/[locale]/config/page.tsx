"use client";

import Editor from "@monaco-editor/react";
import { Download, ExternalLink, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AppConfig, ConfigIssue } from "@genstack/config-types";
import { appConfig } from "@/lib/app-config";
import { buildConfigDownloadName, downloadJson } from "@/lib/download-json";
import { getActiveRuntime, saveRuntimeConfig } from "@/lib/runtime-history";

interface ConfigEngineResult {
  config: AppConfig;
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string } | null;
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

export default function ConfigPage(): JSX.Element {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? "en";
  const [json, setJson] = useState(JSON.stringify(appConfig, null, 2));
  const [result, setResult] = useState<ConfigEngineResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const activeConfig = result?.config ?? appConfig;
  const issueCount = useMemo(() => (result?.errors.length ?? 0) + (result?.warnings.length ?? 0), [result]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${apiBase()}/config/history`, { credentials: "include" });
      const body = await response.json();
      if (body.success && Array.isArray(body.data)) {
        setHistory(body.data);
      }
    } catch (err) {
      console.error("Failed to load version history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const apply = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const parsed = JSON.parse(json) as AppConfig;
      
      // If nothing changed, explain why instead of silently succeeding
      const currentConfig = result?.config;
      if (currentConfig && JSON.stringify(currentConfig) === JSON.stringify(parsed)) {
        toast.info("No changes detected in configuration. Nothing to apply.");
        return;
      }

      const currentRuntime = getActiveRuntime();
      const parsedAppName = parsed?.app?.name ?? "this config";
      if (currentRuntime && currentRuntime.appName !== parsedAppName) {
        const shouldReplace = window.confirm(
          `Replace current runtime "${currentRuntime.appName}" with "${parsedAppName}"? You can restore older generations from the sidebar history.`
        );
        if (!shouldReplace) return;
      }

      // POST config
      const next = await readApi<ConfigEngineResult & { version: number; changes: string[] }>(
        await fetch(`${apiBase()}/config?origin=config-editor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(parsed)
        })
      );

      // Reload config again from database to verify
      const verified = await readApi<ConfigEngineResult>(
        await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" })
      );

      // Compare hashes (JSON strings)
      const match = JSON.stringify(verified.config) === JSON.stringify(next.config);
      if (match) {
        setResult(verified);
        setJson(JSON.stringify(verified.config, null, 2));
        saveRuntimeConfig(verified.config, "Applied from Config Editor");
        window.dispatchEvent(new CustomEvent("genstack:config-applied"));
        
        setLastSaved(new Date().toISOString());
        void fetchHistory();

        const changeText = next.changes && next.changes.length > 0
          ? `\nApplied Changes:\n${next.changes.join("\n")}`
          : "";
        toast.success(`Configuration applied successfully (v1.0.${next.version})${changeText}`);

        const firstRoute = verified.config.ui.pages[0]?.route ?? "/dashboard";
        router.push(`/${locale}${firstRoute}`);
      } else {
        throw new Error("Verification failed. Persisted configuration does not match the applied configuration.");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to apply config");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadCurrentConfig(): Promise<void> {
      try {
        const next = await readApi<ConfigEngineResult>(await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" }));
        if (isMounted) {
          setResult(next);
          setJson(JSON.stringify(next.config, null, 2));
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unable to load current config");
      }
    }

    void loadCurrentConfig();
    void fetchHistory();

    const active = getActiveRuntime();
    if (active) {
      setLastSaved(active.createdAt);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const reset = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const next = await readApi<ConfigEngineResult & { version: number; changes: string[] }>(
        await fetch(`${apiBase()}/config/reset`, { method: "POST", credentials: "include" })
      );
      setResult(next);
      setJson(JSON.stringify(next.config, null, 2));
      saveRuntimeConfig(next.config, "Reset to demo config");
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      
      setLastSaved(new Date().toISOString());
      void fetchHistory();
      toast.success("Demo config restored");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to reset config");
    } finally {
      setIsSaving(false);
    }
  };

  const restoreVersion = async (version: number): Promise<void> => {
    setIsSaving(true);
    try {
      const next = await readApi<ConfigEngineResult>(
        await fetch(`${apiBase()}/config/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ version })
        })
      );
      setResult(next);
      setJson(JSON.stringify(next.config, null, 2));
      saveRuntimeConfig(next.config, `Restored version v1.0.${version}`);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));

      setLastSaved(new Date().toISOString());
      void fetchHistory();
      toast.success(`Restored configuration v1.0.${version} successfully`);

      const firstRoute = next.config.ui.pages[0]?.route ?? "/dashboard";
      router.push(`/${locale}${firstRoute}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to restore configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = useMemo(() => {
    try {
      const parsed = JSON.parse(json);
      return JSON.stringify(parsed) !== JSON.stringify(result?.config);
    } catch {
      return true;
    }
  }, [json, result]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent font-semibold">Live Runtime</p>
            <h1 className="mt-2 text-3xl font-semibold">{t("nav_config")}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void reset()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 transition">
              <RotateCcw className="h-4 w-4" />
              {t("btn_reset_demo")}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 transition"
              onClick={() => downloadJson(buildConfigDownloadName(activeConfig), activeConfig)}
              type="button"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </button>
            <button onClick={() => void apply()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition shadow-none">
              <Save className="h-4 w-4" />
              {isSaving ? t("loading") : t("btn_apply_config")}
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          <Editor
            height="68vh"
            language="json"
            theme="vs-dark"
            value={json}
            onChange={(value) => setJson(value ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              wordWrap: "on",
              scrollBeyondLastLine: false
            }}
          />
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <h2 className="text-sm font-medium text-zinc-200">Configuration status</h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-line/40">
              <span className="text-zinc-500">Active Runtime</span>
              <span className="font-mono text-zinc-200 font-semibold">{activeConfig.app.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/40">
              <span className="text-zinc-500">Version</span>
              <span className="font-mono text-zinc-200">v1.0.{history.length || 1}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/40">
              <span className="text-zinc-500">Last Applied</span>
              <span className="font-mono text-zinc-200">{lastSaved ? new Date(lastSaved).toLocaleString() : "Never"}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/40">
              <span className="text-zinc-500">Status</span>
              <span className={`font-mono font-semibold ${isDirty ? "text-yellow-400" : "text-emerald-400"}`}>
                {isDirty ? "Unapplied Draft" : "Configuration applied"}
              </span>
            </div>
          </div>
        </div>

        {/* Feature Availability Checklist */}
        <div className="rounded-lg border border-line bg-panel p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">Feature Availability</h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Application Name</span>
              <span className="font-semibold text-emerald-400 font-mono text-[10px]">🟢 Supported</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Pages, Tables & Fields</span>
              <span className="font-semibold text-emerald-400 font-mono text-[10px]">🟢 Supported</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Locale & Translations</span>
              <span className="font-semibold text-emerald-400 font-mono text-[10px]">🟢 Supported</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Navigation Layout</span>
              <span className="font-semibold text-zinc-500 font-mono text-[10px]">⚪ Coming Soon</span>
            </div>
            <div className="flex justify-between py-1.5 last:border-0">
              <span className="text-zinc-400">Theme</span>
              <span className="font-semibold text-zinc-500 font-mono text-[10px] text-right">⚪ Coming Soon<br/><span className="text-[9px] text-zinc-500 font-normal font-sans">(editorial dark active)</span></span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <h2 className="text-sm font-medium text-zinc-200">Version History</h2>
          {isLoadingHistory ? (
            <p className="text-xs text-zinc-500 font-mono">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono">No revisions found.</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {history.slice().reverse().map((entry) => (
                <div key={entry.version} className="rounded-md border border-line/45 bg-elevated/10 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-accent">v1.0.{entry.version}</span>
                    <button
                      onClick={() => void restoreVersion(entry.version)}
                      disabled={isSaving || (result?.config && JSON.stringify(result.config) === JSON.stringify(entry.config))}
                      className="rounded bg-elevated border border-line px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-elevated/60 transition disabled:opacity-40"
                    >
                      Restore
                    </button>
                  </div>
                  <p className="text-zinc-400 font-mono text-[10px]">{new Date(entry.timestamp).toLocaleString()}</p>
                  <p className="text-zinc-300 font-medium">{entry.message}</p>
                  {entry.changes && entry.changes.length > 0 && (
                    <details className="text-[10px] text-zinc-500 font-mono cursor-pointer">
                      <summary className="hover:text-zinc-400">View changes ({entry.changes.length})</summary>
                      <ul className="mt-1 list-disc list-inside space-y-0.5 text-zinc-400">
                        {entry.changes.map((change: string, idx: number) => (
                          <li key={idx} className="truncate">{change}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-sm font-medium text-zinc-200">Live preview</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md bg-elevated/20 p-3 border border-line/30">
              <p className="text-xl font-semibold font-mono">{activeConfig.database.tables.length}</p>
              <p className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">{t("tables")}</p>
            </div>
            <div className="rounded-md bg-elevated/20 p-3 border border-line/30">
              <p className="text-xl font-semibold font-mono">{activeConfig.ui.pages.length}</p>
              <p className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">{t("pages")}</p>
            </div>
            <div className="rounded-md bg-elevated/20 p-3 border border-line/30">
              <p className="text-xl font-semibold font-mono">{activeConfig.api.endpoints.length}</p>
              <p className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">APIs</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-zinc-300 font-mono">{activeConfig.app.name}</p>
          {activeConfig.ui.pages.length > 0 ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 font-mono font-bold">Generated pages</p>
              {activeConfig.ui.pages.map((page) => (
                <Link
                  className="flex items-center justify-between rounded-md border border-line bg-elevated/10 px-3 py-2 text-xs text-zinc-300 hover:bg-elevated/25 transition"
                  href={`/${locale}${page.route}`}
                  key={page.route}
                >
                  <span>{page.name}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                    {page.route}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-sm font-medium text-zinc-200">Validation</h2>
          <p className="mt-2 text-xs text-zinc-500 font-mono">{issueCount} issue(s)</p>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-auto">
            {[...(result?.errors ?? []), ...(result?.warnings ?? [])].map((issue, index) => (
              <div
                key={`${issue.path}-${index}`}
                className={`rounded-md border p-3 text-xs ${issue.level === "error" ? "border-danger/25 bg-danger/5 text-danger font-mono" : "border-warning/25 bg-warning/5 text-warning font-mono"}`}
              >
                <p className="font-semibold">{issue.path}</p>
                <p className="mt-1 text-zinc-400">{issue.message}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
