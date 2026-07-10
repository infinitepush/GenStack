"use client";

import {
  BarChart3,
  Bot,
  ChevronDown,
  Clock3,
  FileUp,
  Gauge,
  Github,
  Languages,
  Layers3,
  Link2,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import type { AppConfig, ConfigEngineResult } from "@genstack/config-types";
import {
  clearTransientRuntimeCache,
  deleteRuntimeHistoryEntry,
  getActiveRuntime,
  readRuntimeHistory,
  setActiveRuntime,
  saveRuntimeConfig,
  syncRuntimeHistoryWithBackend,
  type RuntimeHistoryEntry
} from "@/lib/runtime-history";
import { getUserPreferences } from "@/lib/user-preferences";

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

// ---------------------------------------------------------------------------
// Sidebar nav link definitions
// ---------------------------------------------------------------------------

interface NavLink {
  href: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  translationKey?: string;
}

interface NavSection {
  key: string;
  emoji: string;
  label: string;
  requiresRuntime: boolean;
  links: NavLink[];
}

function buildSections(locale: string): NavSection[] {
  return [
    {
      key: "build",
      emoji: "🏗",
      label: "BUILD",
      requiresRuntime: false,
      links: [
        {
          href: `/${locale}/ai`,
          icon: <Bot className="h-4 w-4" />,
          label: "AI Generator",
          tooltip: "Describe your app and generate it with AI",
          translationKey: "nav_ai"
        }
      ]
    },
    {
      key: "explore",
      emoji: "📊",
      label: "EXPLORE",
      requiresRuntime: true,
      links: [
        {
          href: `/${locale}/dashboard`,
          icon: <Gauge className="h-4 w-4" />,
          label: "Dashboard",
          tooltip: "View the generated application dashboard"
        },
        {
          href: `/${locale}/summary`,
          icon: <BarChart3 className="h-4 w-4" />,
          label: "Runtime Summary",
          tooltip: "Inspect generated APIs, database, runtime health, analytics",
          translationKey: "nav_runtime_overview"
        }
      ]
    },
    {
      key: "customize",
      emoji: "⚙",
      label: "CUSTOMIZE",
      requiresRuntime: true,
      links: [
        {
          href: `/${locale}/config`,
          icon: <Sparkles className="h-4 w-4" />,
          label: "Config Editor",
          tooltip: "View and edit the generated JSON configuration",
          translationKey: "nav_config"
        },
        {
          href: `/${locale}/translations`,
          icon: <Languages className="h-4 w-4" />,
          label: "Translations",
          tooltip: "Manage multi-language translations"
        },
        {
          href: `/${locale}/import`,
          icon: <FileUp className="h-4 w-4" />,
          label: "Import CSV",
          tooltip: "Upload CSV files into generated tables",
          translationKey: "nav_import"
        }
      ]
    },
    {
      key: "deploy",
      emoji: "🚀",
      label: "DEPLOY",
      requiresRuntime: true,
      links: [
        {
          href: `/${locale}/export`,
          icon: <Github className="h-4 w-4" />,
          label: "Export to GitHub",
          tooltip: "Push your generated application to GitHub or download it",
          translationKey: "nav_export"
        },
        {
          href: `/${locale}/integrations`,
          icon: <Link2 className="h-4 w-4" />,
          label: "Integrations",
          tooltip: "Connect webhooks and external services"
        }
      ]
    }
  ];
}

function readCollapsedSections(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("genstack:sidebar-collapsed");
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeCollapsedSections(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("genstack:sidebar-collapsed", JSON.stringify(state));
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="group/tooltip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-[#16181D] px-2.5 py-1.5 text-[11px] text-zinc-300 opacity-0 shadow-xl transition-all duration-200 group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100">
        {text}
      </div>
    </div>
  );
}

export function Sidebar({ locale }: SidebarProps): JSX.Element {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";
  const [runtimeConfig, setRuntimeConfig] = useState<AppConfig | null>(null);
  const [history, setHistory] = useState<RuntimeHistoryEntry[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const hasRuntime = runtimeConfig !== null;
  const sections = buildSections(locale);

  const isActive = (href: string): boolean => {
    return pathname === href || (pathname.startsWith(href) && href !== `/${locale}`);
  };

  const linkClass = (href: string): string => {
    const active = isActive(href);
    return `group relative flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-accent/10 text-accent font-semibold"
        : "text-[#B6BDC6] hover:text-zinc-100 hover:bg-hover"
    }`;
  };

  const iconForRoute = (route: string): JSX.Element =>
    route === "/analytics" ? <BarChart3 className="h-4 w-4" /> : <Gauge className="h-4 w-4" />;

  const toggleSection = (key: string): void => {
    const next = { ...collapsed, [key]: !collapsed[key] };
    setCollapsed(next);
    writeCollapsedSections(next);
  };

  const syncFromHistory = useCallback((): void => {
    const nextHistory = readRuntimeHistory(userId);
    const activeRuntime = getActiveRuntime(userId);
    setHistory(nextHistory);
    setRuntimeConfig(activeRuntime?.config ?? null);
  }, [userId]);

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
      setActiveRuntime(entry.id, userId);
      window.dispatchEvent(new CustomEvent("genstack:config-applied"));
      const firstRoute = entry.config.ui.pages[0]?.route ?? "/dashboard";
      router.push(`/${locale}${firstRoute}`);
    } catch {
      setActiveRuntime(entry.id, userId);
      syncFromHistory();
    } finally {
      setIsRestoring(false);
    }
  }, [locale, router, syncFromHistory, userId]);

  useEffect(() => {
    syncRuntimeHistoryWithBackend(userId).then(() => {
      syncFromHistory();
    });
    getUserPreferences(userId);
    setCollapsed(readCollapsedSections());

    async function hydrateActiveConfig() {
      try {
        const response = await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" });
        const body = (await response.json()) as ApiResponse<ConfigEngineResult>;
        if (body.success && body.data?.config) {
          const apiConfig = body.data.config;
          if (apiConfig.app.name !== "Expense Tracker") {
            const activeRuntime = getActiveRuntime(userId);
            if (!activeRuntime || activeRuntime.config.app.name !== apiConfig.app.name) {
              saveRuntimeConfig(apiConfig, userId, "Hydrated from active database state");
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
  }, [syncFromHistory, userId]);

  return (
    <aside className="lg:sticky lg:top-4 flex flex-col bg-panel border border-line p-5 lg:h-[calc(100vh-2rem)] lg:my-4 lg:ml-4 lg:rounded-[20px] shadow-2xl overflow-y-auto">
      {/* Brand logo & status */}
      <div className="flex items-center gap-3.5 px-2 py-3 select-none mb-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-[#1B1F24] text-zinc-300">
          <Layers3 className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#F8FAFC] tracking-tight leading-none">GenStack</p>
          <p className="text-[9px] text-[#7A828D] font-mono tracking-[0.16em] uppercase mt-1.5">AI RUNTIME STUDIO</p>
        </div>
      </div>

      <nav className="mt-8 space-y-6 flex-1">
        {/* Navigation sections */}
        {sections.map((section) => {
          if (section.requiresRuntime && !hasRuntime) return null;

          const isCollapsed = collapsed[section.key] ?? false;

          return (
            <section key={section.key} className="space-y-1.5 animate-fadeIn">
              {/* Section Header */}
              <button
                className="flex w-full items-center justify-between px-2 py-1.5 text-left group"
                onClick={() => toggleSection(section.key)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A828D] font-mono">
                    {section.label}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-zinc-600 transition-transform duration-200 group-hover:text-zinc-400 ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {/* Section Links */}
              {!isCollapsed && (
                <div className="space-y-1 pl-1">
                  {section.links.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <Tooltip text={link.tooltip} key={link.href}>
                        <Link className={linkClass(link.href)} href={link.href}>
                          {active && (
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded bg-accent animate-fadeIn" />
                          )}
                          {link.icon}
                          <span>{link.translationKey ? t(link.translationKey) : link.label}</span>
                        </Link>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* Current Active Runtime details */}
        {hasRuntime && (
          <div className="border-t border-line/40 pt-5 space-y-3.5">
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A828D] font-mono">Active Runtime</p>
            <div className="rounded-xl border border-line bg-[#15181D]/45 p-4 space-y-1.5">
              <p className="truncate text-xs font-semibold text-[#F8FAFC]">{runtimeConfig.app.name}</p>
              <p className="text-[10px] text-[#7A828D] font-mono leading-none">
                {runtimeConfig.database.tables.length} tables · {runtimeConfig.api.endpoints.length} APIs
              </p>
            </div>

            {/* Runtime custom dynamic pages */}
            <div className="space-y-1 pl-1">
              {runtimeConfig.ui.pages.map((page) => {
                const routeHref = `/${locale}${page.route}`;
                const active = isActive(routeHref);
                return (
                  <Link
                    className={linkClass(routeHref)}
                    href={routeHref}
                    key={page.route}
                  >
                    {active && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded bg-accent animate-fadeIn" />
                    )}
                    {iconForRoute(page.route)}
                    <span>{page.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Runtime Generation History */}
        <div className="border-t border-line/40 pt-5 space-y-3">
          <p className="flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-mono">
            <Clock3 className="h-3.5 w-3.5 text-zinc-600" />
            History
          </p>
          {history.length > 0 ? (
            <div className="space-y-1.5">
              {history.slice(0, 5).map((entry) => (
                <div className="group flex items-center gap-1" key={entry.id}>
                  <button
                    className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-xs text-zinc-400 hover:bg-hover hover:text-zinc-200 disabled:opacity-60 transition duration-200"
                    disabled={isRestoring}
                    onClick={() => void restoreRuntime(entry)}
                    type="button"
                  >
                    <span className="block truncate font-semibold text-zinc-300 group-hover:text-zinc-100">{entry.appName}</span>
                    <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </button>
                  <button
                    aria-label={`Delete ${entry.appName}`}
                    className="rounded-xl p-2 text-zinc-500 opacity-0 hover:bg-danger/10 hover:text-danger group-hover:opacity-100 transition duration-200"
                    onClick={() => {
                      const nextHistory = deleteRuntimeHistoryEntry(entry.id, userId);
                      setHistory(nextHistory);
                      setRuntimeConfig(getActiveRuntime(userId)?.config ?? null);
                    }}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line/40 bg-card/10 p-3.5 text-[10px] leading-relaxed text-zinc-500">
              Generated apps will appear here and can be restored later.
            </div>
          )}
          <Link
            className="flex items-center gap-2 rounded-xl border border-line bg-card/20 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-hover hover:text-zinc-100 transition duration-200"
            href={`/${locale}/ai`}
          >
            <Plus className="h-3.5 w-3.5 text-zinc-400 group-hover:text-accent" />
            New Generation
          </Link>
        </div>
      </nav>

      {/* User profile & signout card */}
      <div className="mt-auto pt-5 border-t border-line/60 flex flex-col gap-2">
        {session ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-card/40 border border-line/50">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-zinc-200">{session.user?.name ?? session.user?.email}</p>
              <p className="text-[9px] text-zinc-500 font-mono">USER SESSION</p>
            </div>
            <button
              onClick={() => {
                clearTransientRuntimeCache(userId);
                void signOut();
              }}
              className="rounded-xl p-2 text-zinc-400 hover:bg-danger/10 hover:text-danger transition duration-200"
              title="Sign Out"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            className="flex items-center gap-2 rounded-xl px-4.5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-hover hover:text-zinc-100 transition duration-200"
            href={`/${locale}/auth`}
          >
            <LogIn className="h-4 w-4 text-accent animate-pulse" />
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
