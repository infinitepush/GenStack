"use client";

import { BarChart3, Bot, Gauge, Layers3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { AppConfig, ConfigEngineResult } from "@genstack/config-types";
import { appConfig } from "@/lib/app-config";

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
  const [runtimeConfig, setRuntimeConfig] = useState<AppConfig>(appConfig);
  const iconForRoute = (route: string): JSX.Element =>
    route === "/analytics" ? <BarChart3 className="h-4 w-4" /> : <Gauge className="h-4 w-4" />;

  const loadRuntimeConfig = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBase()}/config`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<ConfigEngineResult>;
      if (payload.success && payload.data) {
        setRuntimeConfig(payload.data.config);
      }
    } catch {
      setRuntimeConfig(appConfig);
    }
  }, []);

  useEffect(() => {
    void loadRuntimeConfig();
    const onConfigApplied = (): void => {
      void loadRuntimeConfig();
    };
    window.addEventListener("genstack:config-applied", onConfigApplied);
    return () => {
      window.removeEventListener("genstack:config-applied", onConfigApplied);
    };
  }, [loadRuntimeConfig]);

  return (
    <aside className="border-b border-line bg-black/30 p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-indigo-electric text-white">
          <Layers3 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{runtimeConfig.app.name}</p>
          <p className="text-xs text-zinc-500">Config runtime</p>
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
            <p className="mb-2 px-2 text-xs uppercase tracking-[0.14em] text-zinc-600">Generated app</p>
            {runtimeConfig.ui.pages.map((page) => (
              <Link
                className="mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                href={`/${locale}${page.route}`}
                key={page.route}
              >
                {iconForRoute(page.route)}
                {page.name}
              </Link>
            ))}
          </div>
        </section>
      </nav>
    </aside>
  );
}
