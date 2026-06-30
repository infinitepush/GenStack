"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { AppConfig, ComponentConfig, ConfigEngineResult, DatabaseTableConfig, PageConfig } from "@genstack/config-types";
import { getComponentRenderer, type DataRecord } from "@/components/registry";
import { getActiveRuntime } from "@/lib/runtime-history";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: string[] } | null;
}

interface DynamicPageProps {
  route: string;
  locale: string;
}

function apiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function componentSource(component: ComponentConfig): string | undefined {
  return (
    readString(component.dataSource) ??
    readString(component.source) ??
    readString(component.target)
  );
}

function findTable(config: AppConfig, tableName: string | undefined): DatabaseTableConfig | undefined {
  if (!tableName) {
    return undefined;
  }
  return config.database.tables.find((table) => table.name === tableName);
}

function findPage(config: AppConfig, route: string): PageConfig | undefined {
  return config.ui.pages.find((page) => page.route === route);
}

async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const body = (await response.json()) as ApiResponse<T>;
  return body;
}

export function DynamicPage({ route, locale }: DynamicPageProps): JSX.Element {
  const t = useTranslations();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [dataByTable, setDataByTable] = useState<Record<string, DataRecord[]>>({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [hasActiveRuntime, setHasActiveRuntime] = useState(true);
  const [loadingTables, setLoadingTables] = useState<Record<string, boolean>>({});
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadConfig(): Promise<void> {
      try {
        const activeRuntime = getActiveRuntime(userId);
        if (!activeRuntime) {
          if (isMounted) {
            setHasActiveRuntime(false);
            setConfig(null);
            setDataByTable({});
          }
          return;
        }
        if (isMounted) {
          setHasActiveRuntime(true);
        }
        const response = await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" });
        const body = await parseApiResponse<ConfigEngineResult>(response);
        if (!body.success || !body.data) {
          throw new Error(body.error?.message ?? "Unable to load runtime config.");
        }
        if (isMounted) {
          setConfig(body.data.config);
          setDataByTable({});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load runtime config.";
        if (isMounted) {
          setRuntimeError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingConfig(false);
        }
      }
    }

    void loadConfig();

    const onApplied = (): void => {
      void loadConfig();
    };
    window.addEventListener("genstack:config-applied", onApplied);

    return () => {
      isMounted = false;
      window.removeEventListener("genstack:config-applied", onApplied);
    };
  }, [route]);

  const page = useMemo(() => (config ? findPage(config, route) : undefined), [config, route]);
  const dataSources = useMemo(() => {
    const sources = new Set<string>();
    page?.components.forEach((component) => {
      const source = componentSource(component);
      if (source) {
        sources.add(source);
      }
    });
    return Array.from(sources);
  }, [page]);

  const loadTable = useCallback(async (tableName: string): Promise<void> => {
    setLoadingTables((previous) => ({ ...previous, [tableName]: true }));
    try {
      const headers: Record<string, string> = {};
      const response = await fetch(`${apiBase()}/runtime/${encodeURIComponent(tableName)}`, {
        cache: "no-store",
        headers,
        credentials: "include"
      });
      const body = await parseApiResponse<DataRecord[]>(response);
      if (!body.success) {
        throw new Error(body.error?.message ?? `Unable to load ${tableName}.`);
      }
      setDataByTable((previous) => ({ ...previous, [tableName]: body.data ?? [] }));
      setRuntimeError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to load ${tableName}.`;
      setRuntimeError(message);
    } finally {
      setLoadingTables((previous) => ({ ...previous, [tableName]: false }));
    }
  }, [session]);

  useEffect(() => {
    dataSources.forEach((source) => {
      void loadTable(source);
    });
  }, [dataSources, loadTable]);

  const createRecord = useCallback(async (tableName: string, payload: DataRecord): Promise<void> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const response = await fetch(`${apiBase()}/runtime/${encodeURIComponent(tableName)}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const body = await parseApiResponse<DataRecord>(response);
    if (!body.success) {
      const details = body.error?.details?.join(" ") ?? "";
      throw new Error(`${body.error?.message ?? "Unable to create record."} ${details}`.trim());
    }
    await loadTable(tableName);
  }, [loadTable, session]);

  const updateRecord = useCallback(async (tableName: string, id: string, payload: DataRecord): Promise<void> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const response = await fetch(`${apiBase()}/runtime/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const body = await parseApiResponse<DataRecord>(response);
    if (!body.success) {
      const details = body.error?.details?.join(" ") ?? "";
      throw new Error(`${body.error?.message ?? "Unable to update record."} ${details}`.trim());
    }
    await loadTable(tableName);
  }, [loadTable, session]);

  const deleteRecord = useCallback(async (tableName: string, id: string): Promise<void> => {
    const headers: Record<string, string> = {};
    const response = await fetch(`${apiBase()}/runtime/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
      credentials: "include"
    });
    const body = await parseApiResponse<{ id: string }>(response);
    if (!body.success) {
      throw new Error(body.error?.message ?? "Unable to delete record.");
    }
    await loadTable(tableName);
  }, [loadTable, session]);

   if (isLoadingConfig) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-white/5" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg border border-line bg-panel" />
          <div className="h-48 animate-pulse rounded-lg border border-line bg-panel" />
        </div>
      </div>
    );
  }

  if (!config && !hasActiveRuntime) {
    return (
      <section className="rounded-lg border border-line/45 bg-panel p-8 text-center shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">No Active Runtime</p>
        <h1 className="mt-3 text-xl font-bold text-white">Generate your first app</h1>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-zinc-400">
          This workspace starts empty so GenStack feels like an AI platform, not a preloaded demo app. Create a runtime in AI Studio, then its pages will appear here.
        </p>
        <Link className="mt-5 inline-flex rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition duration-150 shadow-none" href={`/${locale}/ai`}>
          Open AI Studio
        </Link>
      </section>
    );
  }

  if (!config) {
    return (
      <section className="rounded-lg border border-danger/25 bg-danger/5 p-8">
        <h1 className="text-xl font-bold text-danger">Runtime config unavailable</h1>
        <p className="mt-2 text-xs text-danger/80 leading-relaxed font-mono">{runtimeError ?? "Start the API server and refresh this page."}</p>
      </section>
    );
  }

  if (!page) {
    return (
      <section className="rounded-lg border border-line/45 bg-panel/85 p-8 text-center">
        <h1 className="text-xl font-bold text-white">No pages configured</h1>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">No config.ui.pages entry matches route "{route}".</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">Config-rendered page</p>
          <h1 className="mt-1.5 text-2xl font-bold text-zinc-100">{page.name}</h1>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-elevated/20 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-elevated/50 hover:text-zinc-100 transition duration-150"
          onClick={() => dataSources.forEach((source) => void loadTable(source))}
          type="button"
        >
          <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
          Refresh
        </button>
      </div>

      {runtimeError ? (
        <div className="rounded-lg border border-danger/25 bg-danger/5 p-4 text-xs text-danger">{runtimeError}</div>
      ) : null}

      {page.components.length === 0 ? (
        <div className="rounded-lg border border-line/45 bg-panel p-8 text-center text-zinc-500 text-xs">{t("empty_state")}</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {page.components.map((component, index) => {
            const Renderer = getComponentRenderer(component.type);
            const source = componentSource(component);
            const table = findTable(config, source);
            const isLoading = source ? loadingTables[source] : false;
            const rendererProps = {
              config: component,
              data: source ? dataByTable[source] ?? [] : [],
              ...(source ? { sourceName: source } : {}),
              ...(table ? { tableSchema: table.fields } : {}),
              ...(source ? { onDataChange: (payload: DataRecord) => createRecord(source, payload) } : {}),
              ...(source ? { onDeleteRecord: (id: string) => deleteRecord(source, id) } : {}),
              ...(source ? { onUpdateRecord: (id: string, payload: DataRecord) => updateRecord(source, id, payload) } : {})
            };

            return (
              <div key={`${component.type}-${source ?? "static"}-${index}`} className={component.type === "table" || component.type === "chart" ? "xl:col-span-2" : ""}>
                {isLoading ? (
                  <div className="h-40 animate-pulse rounded-lg border border-line bg-panel" />
                ) : (
                  <Renderer {...rendererProps} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
