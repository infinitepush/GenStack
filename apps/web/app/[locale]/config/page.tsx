"use client";

import Editor from "@monaco-editor/react";
import { ExternalLink, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AppConfig, ConfigIssue } from "@genstack/config-types";
import { appConfig } from "@/lib/app-config";
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

  const activeConfig = result?.config ?? appConfig;
  const issueCount = useMemo(() => (result?.errors.length ?? 0) + (result?.warnings.length ?? 0), [result]);

  const apply = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const parsed = JSON.parse(json) as unknown;
      const currentRuntime = getActiveRuntime();
      const parsedAppName =
        typeof parsed === "object" &&
        parsed !== null &&
        "app" in parsed &&
        typeof parsed.app === "object" &&
        parsed.app !== null &&
        "name" in parsed.app &&
        typeof parsed.app.name === "string"
          ? parsed.app.name
          : "this config";
      if (currentRuntime && currentRuntime.appName !== parsedAppName) {
        const shouldReplace = window.confirm(
          `Replace current runtime "${currentRuntime.appName}" with "${parsedAppName}"? You can restore older generations from the sidebar history.`
        );
        if (!shouldReplace) return;
      }
      const next = await readApi<ConfigEngineResult>(
        await fetch(`${apiBase()}/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed)
        })
      );
      setResult(next);
      setJson(JSON.stringify(next.config, null, 2));
      saveRuntimeConfig(next.config, "Applied from Config Editor");
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      const firstRoute = next.config.ui.pages[0]?.route ?? "/dashboard";
      toast.success("Config applied. Opening generated app.");
      router.push(`/${locale}${firstRoute}`);
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
        const next = await readApi<ConfigEngineResult>(await fetch(`${apiBase()}/config`, { cache: "no-store" }));
        if (isMounted) {
          setResult(next);
          setJson(JSON.stringify(next.config, null, 2));
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Unable to load current config");
      }
    }

    void loadCurrentConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const reset = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const next = await readApi<ConfigEngineResult>(await fetch(`${apiBase()}/config/reset`, { method: "POST" }));
      setResult(next);
      setJson(JSON.stringify(next.config, null, 2));
      saveRuntimeConfig(next.config, "Reset to demo config");
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      toast.success("Demo config restored");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to reset config");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-electric">Live Runtime</p>
            <h1 className="mt-2 text-3xl font-semibold">{t("nav_config")}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void reset()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-3 py-2 text-sm">
              <RotateCcw className="h-4 w-4" />
              {t("btn_reset_demo")}
            </button>
            <button onClick={() => void apply()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md bg-indigo-electric px-3 py-2 text-sm font-medium text-white">
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
        <div className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-sm font-medium text-zinc-200">Live preview</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md bg-black/30 p-3">
              <p className="text-xl font-semibold">{activeConfig.database.tables.length}</p>
              <p className="text-xs text-zinc-500">{t("tables")}</p>
            </div>
            <div className="rounded-md bg-black/30 p-3">
              <p className="text-xl font-semibold">{activeConfig.ui.pages.length}</p>
              <p className="text-xs text-zinc-500">{t("pages")}</p>
            </div>
            <div className="rounded-md bg-black/30 p-3">
              <p className="text-xl font-semibold">{activeConfig.api.endpoints.length}</p>
              <p className="text-xs text-zinc-500">APIs</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-400">{activeConfig.app.name}</p>
          {activeConfig.ui.pages.length > 0 ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">Generated pages</p>
              {activeConfig.ui.pages.map((page) => (
                <Link
                  className="flex items-center justify-between rounded-md border border-line bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                  href={`/${locale}${page.route}`}
                  key={page.route}
                >
                  <span>{page.name}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-500">
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
          <p className="mt-2 text-sm text-zinc-500">{issueCount} issue(s)</p>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-auto">
            {[...(result?.errors ?? []), ...(result?.warnings ?? [])].map((issue, index) => (
              <div
                key={`${issue.path}-${index}`}
                className={`rounded-md border p-3 text-sm ${issue.level === "error" ? "border-red-500/50 bg-red-500/10 text-red-100" : "border-yellow-500/50 bg-yellow-500/10 text-yellow-100"}`}
              >
                <p className="font-mono text-xs">{issue.path}</p>
                <p className="mt-1">{issue.message}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
