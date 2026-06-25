"use client";

import { BarChart3, Bot, Clock3, FileUp, Gauge, Github, Languages, Layers3, Link2, LogIn, LogOut, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import type { AppConfig, ConfigEngineResult } from "@genstack/config-types";
import {
  deleteRuntimeHistoryEntry,
  getActiveRuntime,
  readRuntimeHistory,
  setActiveRuntime,
  saveRuntimeConfig,
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
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function Sidebar({ locale }: SidebarProps): JSX.Element {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [runtimeConfig, setRuntimeConfig] = useState<AppConfig | null>(null);
  const [history, setHistory] = useState<RuntimeHistoryEntry[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  const isActive = (href: string): boolean => {
    return pathname === href || (pathname.startsWith(href) && href !== `/${locale}`);
  };

  const linkClass = (href: string): string => {
    const active = isActive(href);
    return `group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-all duration-150 ${
      active
        ? "bg-elevated text-accent font-medium"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-elevated/35"
    }`;
  };

  const iconForRoute = (route: string): JSX.Element =>
    route === "/analytics" ? <BarChart3 className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />;

  const syncFromHistory = useCallback((): void => {
    const nextHistory = readRuntimeHistory();
    const activeRuntime = getActiveRuntime();
    setHistory(nextHistory);
    setRuntimeConfig(activeRuntime?.config ?? null);
  }, []);

  const restoreRuntime = useCallback(async (entry: RuntimeHistoryEntry): Promise<void> => {
    setIsRestoring(true);
    try {
      const response = await fetch(`${apiBase()}/config?origin=history-restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

    async function hydrateActiveConfig() {
      try {
        const response = await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" });
        const body = (await response.json()) as ApiResponse<ConfigEngineResult>;
        if (body.success && body.data?.config) {
          const apiConfig = body.data.config;
          // Hydrate locally if this is a custom generated app (not the default Expense Tracker)
          if (apiConfig.app.name !== "Expense Tracker") {
            const activeRuntime = getActiveRuntime();
            if (!activeRuntime || activeRuntime.config.app.name !== apiConfig.app.name) {
              saveRuntimeConfig(apiConfig, "Hydrated from active database state");
              window.dispatchEvent(new CustomEvent("genstack:config-applied"));
            }
          }
        }
      } catch (err) {
        console.error("Failed to hydrate active configuration on mount:", err);
      }
    }
    void hydrateActiveConfig();

    const onConfigApplied = (): void => {
      syncFromHistory();
    };
    window.addEventListener("genstack:config-applied", onConfigApplied);
    return () => {
      window.removeEventListener("genstack:config-applied", onConfigApplied);
    };
  }, [syncFromHistory]);

  return (
    <aside className="flex flex-col border-b border-line/60 bg-panel p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 rounded-lg border border-line/40 bg-elevated/20 px-3 py-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-elevated text-zinc-300">
          <Layers3 className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-zinc-100">GenStack</p>
          <p className="text-[10px] text-zinc-500 font-mono">AI Studio v0.1</p>
        </div>
      </div>

      <nav className="mt-6 space-y-6">
        <section>
          <div className="mb-2.5 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-mono">
            <Bot className="h-3.5 w-3.5 text-zinc-600" />
            Workspace
          </div>
          <Link
            className={linkClass(`/${locale}/ai`)}
            href={`/${locale}/ai`}
          >
            <Bot className="h-3.5 w-3.5" />
            {t("nav_ai")}
          </Link>
          <Link
            className={linkClass(`/${locale}/config`)}
            href={`/${locale}/config`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("nav_config")}
          </Link>
          <Link
            className={linkClass(`/${locale}/summary`)}
            href={`/${locale}/summary`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {t("nav_runtime_overview")}
          </Link>
          <Link
            className={linkClass(`/${locale}/import`)}
            href={`/${locale}/import`}
          >
            <FileUp className="h-3.5 w-3.5" />
            {t("nav_import")}
          </Link>
          <Link
            className={linkClass(`/${locale}/export`)}
            href={`/${locale}/export`}
          >
            <Github className="h-3.5 w-3.5" />
            {t("nav_export")}
          </Link>
          <Link
            className={linkClass(`/${locale}/translations`)}
            href={`/${locale}/translations`}
          >
            <Languages className="h-3.5 w-3.5" />
            Translations
          </Link>
          <Link
            className={linkClass(`/${locale}/integrations`)}
            href={`/${locale}/integrations`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Integrations
          </Link>

          <div className="mt-5 border-t border-line/50 pt-5">
            <div className="mb-3 px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-mono">Current Runtime</p>
              {runtimeConfig ? (
                <div className="mt-2.5 rounded-lg border border-line/45 bg-elevated/25 p-3">
                  <p className="truncate text-xs font-semibold text-zinc-200">{runtimeConfig.app.name}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {runtimeConfig.database.tables.length} tables · {runtimeConfig.api.endpoints.length} APIs
                  </p>
                </div>
              ) : (
                <div className="mt-2.5 rounded-lg border border-line/40 bg-elevated/10 p-3">
                  <p className="text-xs font-medium text-zinc-400">No runtime active</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Generate an app in AI Studio to populate this workspace.</p>
                </div>
              )}
            </div>

            {runtimeConfig ? (
              <div className="space-y-1">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-mono">Pages</p>
                {runtimeConfig.ui.pages.map((page) => (
                  <Link
                    className={linkClass(`/${locale}${page.route}`)}
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
              <p className="flex items-center gap-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-mono">
                <Clock3 className="h-3.5 w-3.5 text-zinc-600" />
                History
              </p>
              {history.length > 0 ? (
                <div className="space-y-1">
                  {history.slice(0, 5).map((entry) => (
                    <div className="group flex items-center gap-1" key={entry.id}>
                      <button
                        className="min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-left text-xs text-zinc-400 hover:bg-elevated/30 hover:text-zinc-200 disabled:opacity-60 transition duration-150"
                        disabled={isRestoring}
                        onClick={() => void restoreRuntime(entry)}
                        type="button"
                      >
                        <span className="block truncate font-medium text-zinc-300 group-hover:text-zinc-100">{entry.appName}</span>
                        <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{new Date(entry.createdAt).toLocaleDateString()}</span>
                      </button>
                      <button
                        aria-label={`Delete ${entry.appName}`}
                        className="rounded-md p-1.5 text-zinc-500 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 transition duration-150"
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
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-line/30 bg-elevated/5 p-3 text-[10px] leading-relaxed text-zinc-500">
                  Generated apps will appear here and can be restored later.
                </div>
              )}
              <Link
                className="mt-2 flex items-center gap-2 rounded-md border border-line/40 bg-elevated/20 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-elevated/35 hover:text-zinc-200 transition duration-150"
                href={`/${locale}/ai`}
              >
                <Plus className="h-3.5 w-3.5 text-zinc-400 group-hover:text-accent transition duration-150" />
                New Generation
              </Link>
            </div>
          </div>
        </section>
      </nav>
      <div className="mt-auto border-t border-line/80 pt-4 flex flex-col gap-2">
        {session ? (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-elevated/30 border border-line/45">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-200">{session.user?.name ?? session.user?.email}</p>
              <p className="text-[9px] text-zinc-500 font-mono">User Session</p>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-danger/10 hover:text-danger-hover transition duration-150"
              title="Sign Out"
              type="button"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Link
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-elevated hover:text-zinc-100 transition duration-150"
            href={`/${locale}/auth`}
          >
            <LogIn className="h-3.5 w-3.5 text-accent" />
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
