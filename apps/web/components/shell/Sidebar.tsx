"use client";

import { BarChart3, Bot, Clock3, Gauge, Layers3, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { AppConfig } from "@genstack/config-types";
import {
  deleteRuntimeHistoryEntry,
  getActiveRuntime,
  readRuntimeHistory,
  setActiveRuntime,
  type RuntimeHistoryEntry
} from "@/lib/runtime-history";

interface SidebarProps {
  locale: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string } | null;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function Sidebar({ locale }: SidebarProps): JSX.Element {
  const t = useTranslations();
  const router = useRouter();
  const [runtimeConfig, setRuntimeConfig] = useState<AppConfig | null>(null);
  const [history, setHistory] = useState<RuntimeHistoryEntry[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const iconForRoute = (route: string): JSX.Element =>
    route === "/analytics" ? <BarChart3 className="h-4 w-4" /> : <Gauge className="h-4 w-4" />;

  const syncFromHistory = useCallback((): void => {
    const nextHistory = readRuntimeHistory();
    const activeRuntime = getActiveRuntime();
    setHistory(nextHistory);
    setRuntimeConfig(activeRuntime?.config ?? null);
  }, []);

  const restoreRuntime = useCallback(async (entry: RuntimeHistoryEntry): Promise<void> => {
    setIsRestoring(true);
    try {
      const response = await fetch(`${apiBase()}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.config)
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to restore runtime.");
      }
      setActiveRuntime(entry.id);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      const firstRoute = entry.config.ui.pages[0]?.route ?? "/dashboard";
      router.push(`/${locale}${firstRoute}`);
    } catch {
      setActiveRuntime(entry.id);
      syncFromHistory();
    } finally {
      setIsRestoring(false);
    }
  }, [locale, router, syncFromHistory]);

  useEffect(() => {
    syncFromHistory();
    const onConfigApplied = (): void => {
      syncFromHistory();
    };
    window.addEventListener("genstack:config-applied", onConfigApplied);
    return () => {
      window.removeEventListener("genstack:config-applied", onConfigApplied);
    };
  }, [syncFromHistory]);

  return (
    <aside className="border-b border-line bg-black/30 p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-indigo-electric text-white">
          <Layers3 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">GenStack</p>
          <p className="text-xs text-zinc-500">AI Runtime Studio</p>
        </div>
      </div>

      <nav className="mt-6 space-y-6">
        <section>
          <div className="mb-2 flex items-center gap-2 px-2 text-xs uppercase tracking-[0.14em] text-zinc-600">
            <Bot className="h-3.5 w-3.5" />
            MVP
          </div>
          <Link
            className="mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            href={`/${locale}/ai`}
          >
            <Bot className="h-4 w-4" />
            {t("nav_ai")}
          </Link>
          <Link
            className="mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            href={`/${locale}/config`}
          >
            <Sparkles className="h-4 w-4" />
            {t("nav_config")}
          </Link>

          <div className="mt-5 border-t border-line pt-5">
            <div className="mb-3 px-2">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">Current Runtime</p>
              {runtimeConfig ? (
                <div className="mt-2 rounded-md border border-indigo-400/20 bg-indigo-400/10 p-3">
                  <p className="truncate text-sm font-medium text-zinc-100">{runtimeConfig.app.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {runtimeConfig.database.tables.length} table(s) · {runtimeConfig.api.endpoints.length} API(s)
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-line bg-black/20 p-3">
                  <p className="text-sm font-medium text-zinc-200">No runtime generated</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Start in AI Studio to create your first app.</p>
                </div>
              )}
            </div>

            {runtimeConfig ? (
              <div className="space-y-1">
                <p className="px-2 pb-1 text-xs uppercase tracking-[0.14em] text-zinc-600">Pages</p>
                {runtimeConfig.ui.pages.map((page) => (
                  <Link
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                    href={`/${locale}${page.route}`}
                    key={page.route}
                  >
                    {iconForRoute(page.route)}
                    {page.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-5 space-y-1">
              <p className="flex items-center gap-2 px-2 pb-1 text-xs uppercase tracking-[0.14em] text-zinc-600">
                <Clock3 className="h-3.5 w-3.5" />
                Recent Generations
              </p>
              {history.length > 0 ? (
                history.slice(0, 5).map((entry) => (
                  <div className="group flex items-center gap-1" key={entry.id}>
                    <button
                      className="min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-100 disabled:opacity-60"
                      disabled={isRestoring}
                      onClick={() => void restoreRuntime(entry)}
                      type="button"
                    >
                      <span className="block truncate">{entry.appName}</span>
                      <span className="block text-xs text-zinc-600">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </button>
                    <button
                      aria-label={`Delete ${entry.appName}`}
                      className="rounded-md p-2 text-zinc-600 opacity-0 hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100"
                      onClick={() => {
                        const nextHistory = deleteRuntimeHistoryEntry(entry.id);
                        setHistory(nextHistory);
                        setRuntimeConfig(getActiveRuntime()?.config ?? null);
                      }}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-line bg-black/20 p-3 text-xs leading-5 text-zinc-500">
                  Generated apps will appear here and can be restored later.
                </div>
              )}
              <Link
                className="mt-2 flex items-center gap-2 rounded-md border border-line bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                href={`/${locale}/ai`}
              >
                <Plus className="h-4 w-4" />
                New Generation
              </Link>
            </div>
          </div>
        </section>
      </nav>
    </aside>
  );
}
