"use client";

import Editor from "@monaco-editor/react";
import { Download, ExternalLink, RotateCcw, Save, Sparkles, AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import type { AppConfig, ConfigIssue } from "@genstack/config-types";
import { appConfig } from "@/lib/app-config";
import { buildConfigDownloadName, downloadJson } from "@/lib/download-json";
import { getActiveRuntime, saveRuntimeConfig } from "@/lib/runtime-history";
import { EmptyState } from "@/components/onboarding/EmptyState";

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

export default function ConfigPage(): JSX.Element {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";
  const locale = params.locale ?? "en";

  const [json, setJson] = useState(JSON.stringify(appConfig, null, 2));
  const [result, setResult] = useState<ConfigEngineResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasRuntime, setHasRuntime] = useState<boolean | null>(null);

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
      
      const currentConfig = result?.config;
      if (currentConfig && JSON.stringify(currentConfig) === JSON.stringify(parsed)) {
        toast.info("No changes detected in configuration. Nothing to apply.");
        return;
      }

      const currentRuntime = getActiveRuntime(userId);
      const parsedAppName = parsed?.app?.name ?? "this config";
      if (currentRuntime && currentRuntime.appName !== parsedAppName) {
        const shouldReplace = window.confirm(
          `Replace current runtime "${currentRuntime.appName}" with "${parsedAppName}"? You can restore older generations from the sidebar history.`
        );
        if (!shouldReplace) return;
      }

      const next = await readApi<ConfigEngineResult & { version: number; changes: string[] }>(
        await fetch(`${apiBase()}/config?origin=config-editor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(parsed)
        })
      );

      const verified = await readApi<ConfigEngineResult>(
        await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" })
      );

      const match = JSON.stringify(verified.config) === JSON.stringify(next.config);
      if (match) {
        setResult(verified);
        setJson(JSON.stringify(verified.config, null, 2));
        saveRuntimeConfig(verified.config, userId, "Applied from Config Editor");
        window.dispatchEvent(new CustomEvent("genstack:config-applied"));
        
        setLastSaved(new Date().toISOString());
        void fetchHistory();

        const changeText = next.changes && next.changes.length > 0
          ? `\nApplied Changes:\n${next.changes.join("\n")}`
          : "";
        if (changeText) {
          console.log(changeText);
        }
        toast.success(`Configuration applied successfully (v1.0.${next.version})`);

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

    const active = getActiveRuntime(userId);
    setHasRuntime(active !== null);
    if (active) {
      setLastSaved(active.createdAt);
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const reset = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const next = await readApi<ConfigEngineResult & { version: number; changes: string[] }>(
        await fetch(`${apiBase()}/config/reset`, { method: "POST", credentials: "include" })
      );
      setResult(next);
      setJson(JSON.stringify(next.config, null, 2));
      saveRuntimeConfig(next.config, userId, "Reset to demo config");
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
      saveRuntimeConfig(next.config, userId, `Restored version v1.0.${version}`);
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

  if (hasRuntime === null) {
    return <div className="min-h-[50vh]" />;
  }

  if (!hasRuntime) {
    return (
      <EmptyState
        locale={locale}
        icon={<Sparkles className="h-7 w-7 text-zinc-500" />}
        title="No configuration to edit yet"
        description="GenStack workspaces start empty before generation. Build your application first, then inspect and edit the generated JSON schema configuration here."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px] max-w-[1600px] mx-auto pb-12 animate-fadeIn">
      {/* Editor Main Section */}
      <section className="premium-card p-6 flex flex-col space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line/45">
          <div>
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
              Configuration Schema
            </span>
            <h1 className="mt-1.5 text-2xl font-bold text-zinc-100 tracking-tight">{t("nav_config")}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void reset()}
              disabled={isSaving}
              className="premium-btn-secondary px-3.5 flex items-center gap-1.5 h-9 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("btn_reset_demo")}
            </button>
            <button
              className="premium-btn-secondary px-3.5 flex items-center gap-1.5 h-9 text-xs"
              onClick={() => downloadJson(buildConfigDownloadName(activeConfig), activeConfig)}
              type="button"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              onClick={() => void apply()}
              disabled={isSaving}
              className="premium-btn-primary px-4 flex items-center gap-1.5 h-9 text-xs shadow-none"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? t("loading") : t("btn_apply_config")}
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="overflow-hidden rounded-xl border border-line bg-[#0e0e11] p-1.5">
          <Editor
            height="62vh"
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

      {/* Editor Sidebar */}
      <aside className="space-y-6">
        {/* Configuration status */}
        <div className="premium-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">Configuration status</h2>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-line/45">
              <span className="text-zinc-500">Active Runtime</span>
              <span className="text-zinc-200 font-semibold">{activeConfig.app.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/45">
              <span className="text-zinc-500">Version</span>
              <span className="text-zinc-200">v1.0.{history.length || 1}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/45">
              <span className="text-zinc-500">Last Applied</span>
              <span className="text-zinc-200">{lastSaved ? new Date(lastSaved).toLocaleString() : "Never"}</span>
            </div>
            <div className="flex justify-between py-1.5 last:border-0">
              <span className="text-zinc-500">Status</span>
              <span className={`font-semibold ${isDirty ? "text-yellow-400" : "text-emerald-400"}`}>
                {isDirty ? "Unapplied Draft" : "Config active"}
              </span>
            </div>
          </div>
        </div>

        {/* Feature Checklist */}
        <div className="premium-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">Feature Availability</h2>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Application Name</span>
              <span className="font-semibold text-emerald-400 text-[10px]">🟢 Supported</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Pages, Tables & Fields</span>
              <span className="font-semibold text-emerald-400 text-[10px]">🟢 Supported</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/20">
              <span className="text-zinc-400">Locale & Translations</span>
              <span className="font-semibold text-emerald-400 text-[10px]">🟢 Supported</span>
            </div>
            <div className="flex justify-between py-1.5 last:border-0">
              <span className="text-zinc-400">Theme Configurations</span>
              <span className="font-semibold text-zinc-500 text-[10px]">⚪ Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Version History revisions */}
        <div className="premium-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">Version History</h2>
          {isLoadingHistory ? (
            <p className="text-xs text-zinc-500 font-mono">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono">No revisions found.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {history.slice().reverse().map((entry) => (
                <div key={entry.version} className="rounded-xl border border-line bg-card/25 p-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-accent">v1.0.{entry.version}</span>
                    <button
                      onClick={() => void restoreVersion(entry.version)}
                      disabled={isSaving || (result?.config && JSON.stringify(result.config) === JSON.stringify(entry.config))}
                      className="rounded-lg bg-card/65 border border-line px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:bg-hover transition disabled:opacity-40"
                    >
                      Restore
                    </button>
                  </div>
                  <p className="text-zinc-500 text-[10px]">{new Date(entry.timestamp).toLocaleString()}</p>
                  <p className="text-zinc-300 font-medium">{entry.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Preview stats */}
        <div className="premium-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">Live Preview Summary</h2>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl border border-line bg-card/20 p-2.5">
              <p className="text-lg font-bold font-mono">{activeConfig.database.tables.length}</p>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">{t("tables")}</p>
            </div>
            <div className="rounded-xl border border-line bg-card/20 p-2.5">
              <p className="text-lg font-bold font-mono">{activeConfig.ui.pages.length}</p>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">{t("pages")}</p>
            </div>
            <div className="rounded-xl border border-line bg-card/20 p-2.5">
              <p className="text-lg font-bold font-mono">{activeConfig.api.endpoints.length}</p>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">APIs</p>
            </div>
          </div>
          {activeConfig.ui.pages.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-line/40">
              {activeConfig.ui.pages.map((page) => (
                <Link
                  className="flex items-center justify-between rounded-xl border border-line bg-card/20 px-3 py-2 text-xs text-zinc-300 hover:bg-hover transition"
                  href={`/${locale}${page.route}`}
                  key={page.route}
                >
                  <span>{page.name}</span>
                  <ExternalLink className="h-3 w-3 text-zinc-500" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Validation Issues check */}
        <div className="premium-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">Validation check</h2>
          <p className="text-xs text-zinc-500 font-mono">{issueCount} active issues</p>
          <div className="space-y-2 max-h-56 overflow-auto">
            {[...(result?.errors ?? []), ...(result?.warnings ?? [])].map((issue, index) => (
              <div
                key={`${issue.path}-${index}`}
                className={`rounded-xl border p-3 text-xs font-mono ${issue.level === "error" ? "border-danger/35 bg-danger/5 text-danger" : "border-warning/35 bg-warning/5 text-warning"}`}
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
