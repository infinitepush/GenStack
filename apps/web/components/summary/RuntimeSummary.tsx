"use client";

import { 
  Activity, 
  ArrowRight, 
  Database, 
  Download, 
  Gauge, 
  RefreshCw, 
  Sparkles, 
  History, 
  Wand2,
  Server,
  Globe,
  Brain,
  Layers,
  ChevronRight,
  Terminal,
  Clock,
  Settings,
  ShieldCheck,
  Cpu,
  FileText
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { buildConfigDownloadName, downloadJson } from "@/lib/download-json";
import { loadReviewerDemoData } from "@/lib/demo-data";
import type { AppConfig } from "@genstack/config-types";

interface RuntimeSummaryProps {
  locale: string;
}

interface ActivityItem {
  type: string;
  message: string;
  timestamp: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

function apiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function RuntimeSummary({ locale }: RuntimeSummaryProps): JSX.Element {
  const t = useTranslations();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [health, setHealth] = useState<{
    frontend: "healthy" | "unhealthy" | "unknown";
    backend: "healthy" | "unhealthy" | "unknown";
    database: "healthy" | "unhealthy" | "unknown";
    ai: "healthy" | "unhealthy" | "unknown";
  }>({
    frontend: "healthy",
    backend: "unknown",
    database: "unknown",
    ai: "unknown"
  });

  const [sheetsStatus, setSheetsStatus] = useState<{
    connected: boolean;
    message: string;
    lastSync: string;
    rowsSynced: number;
  }>({
    connected: false,
    message: "Not loaded",
    lastSync: "Never",
    rowsSynced: 0
  });

  const checkHealth = async () => {
    try {
      const res = await fetch(`${apiBase()}/health`, { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        setHealth(prev => ({
          ...prev,
          backend: "unhealthy",
          database: "unhealthy",
          ai: "unknown"
        }));
        return;
      }
      const body = await res.json();
      if (body.success && body.data) {
        setHealth({
          frontend: "healthy",
          backend: body.data.status === "ok" ? "healthy" : "unhealthy",
          database: body.data.database === "healthy" ? "healthy" : "unhealthy",
          ai: body.data.ai === "available" ? "healthy" : "unhealthy"
        });
      } else {
        setHealth({
          frontend: "healthy",
          backend: "unhealthy",
          database: "unhealthy",
          ai: "unknown"
        });
      }
    } catch (err) {
      setHealth({
        frontend: "healthy",
        backend: "unhealthy",
        database: "unhealthy",
        ai: "unknown"
      });
    }
  };

  const loadConfigAndStats = async () => {
    try {
      const response = await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" });
      const body = await response.json();
      if (body.success && body.data?.config) {
        const loadedConfig = body.data.config as AppConfig;
        setConfig(loadedConfig);
        
        // Fetch record counts
        const counts: Record<string, number> = {};
        await Promise.all(
          loadedConfig.database.tables.map(async (table) => {
            try {
              const res = await fetch(`${apiBase()}/runtime/${encodeURIComponent(table.name)}`, { cache: "no-store", credentials: "include" });
              if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                  counts[table.name] = data.data.length;
                }
              }
            } catch (err) {
              console.error(`Failed to fetch count for table ${table.name}:`, err);
            }
          })
        );
        setTableCounts(counts);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const fetchHistoryAndActivities = async () => {
    try {
      const historyRes = await fetch(`${apiBase()}/config/history`, { cache: "no-store", credentials: "include" });
      const historyBody = await historyRes.json();
      if (historyBody.success && Array.isArray(historyBody.data)) {
        setHistory(historyBody.data);
      }

      const activitiesRes = await fetch(`${apiBase()}/runtime/activities`, { cache: "no-store", credentials: "include" });
      const activitiesBody = await activitiesRes.json();
      if (activitiesBody.success && Array.isArray(activitiesBody.data)) {
        setActivities(activitiesBody.data);
      }
    } catch (err) {
      console.error("Failed to load history or activities:", err);
    }
  };

  const loadSheetsStatus = async () => {
    try {
      const res = await fetch(`${apiBase()}/integrations/sheets/status`, { cache: "no-store", credentials: "include" });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.data) {
          setSheetsStatus(body.data);
        }
      }
    } catch (err) {
      console.error("Failed to load sheets status:", err);
    }
  };

  const loadAllData = async () => {
    setIsRefreshing(true);
    await Promise.all([
      checkHealth(),
      loadConfigAndStats(),
      fetchHistoryAndActivities(),
      loadSheetsStatus()
    ]);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    void loadAllData();

    const handleConfigApplied = () => {
      void loadAllData();
    };
    window.addEventListener("genstack:config-applied", handleConfigApplied);

    // Auto-refresh operational status every 5 seconds
    const timer = setInterval(() => {
      void loadAllData();
    }, 5000);

    return () => {
      window.removeEventListener("genstack:config-applied", handleConfigApplied);
      clearInterval(timer);
    };
  }, []);

  const handleLoadDemoData = (): void => {
    loadReviewerDemoData(userId);
    window.dispatchEvent(new CustomEvent("genstack:config-applied"));
    toast.success("Reviewer demo data loaded");
  };

  const handleDownloadConfig = (): void => {
    if (config) {
      downloadJson(buildConfigDownloadName(config), config);
      toast.success("Config downloaded");
    }
  };

  const apiCounts = useMemo(() => {
    const counts = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
    if (config?.api.endpoints) {
      config.api.endpoints.forEach((ep) => {
        const method = ep.method.toUpperCase() as keyof typeof counts;
        if (counts[method] !== undefined) {
          counts[method]++;
        }
      });
    }
    return counts;
  }, [config]);

  const activeVersion = useMemo(() => {
    return history.length ? `v1.0.${history.length}` : "v1.0.1";
  }, [history]);

  const lastUpdated = useMemo(() => {
    if (history.length) {
      const latest = history[history.length - 1];
      return new Date(latest.timestamp).toLocaleString();
    }
    return "Never";
  }, [history]);

  // Color mappings for health status
  const getHealthBadge = (status: "healthy" | "unhealthy" | "unknown") => {
    if (status === "healthy") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Active
        </span>
      );
    }
    if (status === "unhealthy") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          Degraded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Unknown
      </span>
    );
  };

  const getHealthIcon = (key: string) => {
    switch (key) {
      case "frontend": return <Globe className="h-4 w-4 text-zinc-400" />;
      case "backend": return <Server className="h-4 w-4 text-zinc-400" />;
      case "database": return <Database className="h-4 w-4 text-zinc-400" />;
      case "ai": return <Brain className="h-4 w-4 text-zinc-400" />;
      default: return <Settings className="h-4 w-4 text-zinc-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-line bg-panel p-6">
          <div className="h-8 w-64 animate-pulse rounded bg-white/5" />
          <div className="mt-3 h-4 w-96 animate-pulse rounded bg-white/5" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-line bg-panel" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-96 animate-pulse rounded-lg border border-line bg-panel" />
          <div className="h-96 animate-pulse rounded-lg border border-line bg-panel" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header Panel */}
      <section className="rounded-lg border border-line bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
                Runtime Dashboard
              </span>
              {config && (
                <span className="font-mono text-[10px] text-zinc-500">
                  {activeVersion}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {config ? config.app.name : "No active runtime"}
            </h1>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Operational overview of your compiled SaaS application, table records, endpoint bindings, and persistent system activity logs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void loadAllData()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-black/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 transition duration-150"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-zinc-400 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Status
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-black/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 transition duration-150"
              onClick={handleLoadDemoData}
              type="button"
            >
              <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
              Demo Workspace
            </button>
            {config && (
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-black/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 transition duration-150"
                onClick={handleDownloadConfig}
                type="button"
              >
                <Download className="h-3.5 w-3.5 text-zinc-400" />
                Download JSON
              </button>
            )}
            <Link
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover transition shadow-none"
              href={`/${locale}/ai`}
            >
              Open AI Studio
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Health Checks Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(health) as Array<keyof typeof health>).map((key) => (
          <div key={key} className="rounded-lg border border-line bg-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-elevated/20 p-2 border border-line/40">
                {getHealthIcon(key)}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                  {key === "ai" ? "AI Provider" : key}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-200 capitalize">
                  {key === "frontend" ? "Client Loaded" : key === "database" ? "Prisma Query" : key === "ai" ? "Gemini Key" : "HTTP Server"}
                </p>
              </div>
            </div>
            {getHealthBadge(health[key])}
          </div>
        ))}
      </section>

      {/* Main Stats and Operational Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Database View - Tables & Live Record Counts */}
        <section className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/40">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-zinc-200">Database Engine Schema</h2>
            </div>
            <span className="rounded bg-elevated border border-line px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              {config?.database.tables.length ?? 0} Table(s)
            </span>
          </div>

          {config && config.database.tables.length > 0 ? (
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {config.database.tables.map((table) => (
                <div key={table.name} className="rounded-md border border-line/65 bg-elevated/10 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 font-mono">{table.name}</h3>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {table.fields.length} columns defined
                      </p>
                    </div>
                    <span className="rounded-md bg-accent/5 border border-accent/20 px-2.5 py-1 text-xs font-mono font-semibold text-accent">
                      {tableCounts[table.name] ?? 0} row(s)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {table.fields.map((field) => (
                      <span
                        key={field.name}
                        className="inline-flex items-center gap-1 rounded bg-elevated border border-line/40 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400"
                      >
                        {field.name}
                        <span className="text-zinc-600 text-[8px]">({field.type})</span>
                        {field.required && <span className="text-accent text-[8px] font-bold">*</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-line/40 bg-elevated/5 p-8 text-center text-xs text-zinc-500 font-mono">
              No database tables defined in the active configuration.
            </div>
          )}
        </section>

        {/* API Endpoint Binding Overview */}
        <section className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/40">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-zinc-200">Active API Routing</h2>
            </div>
            <span className="rounded bg-elevated border border-line px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              {config?.api.endpoints.length ?? 0} Route(s)
            </span>
          </div>

          {/* Grouped counts indicators */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="rounded border border-line bg-elevated/15 py-1.5">
              <span className="block text-[10px] text-zinc-500 uppercase">GET</span>
              <span className="mt-0.5 text-sm font-bold text-emerald-400">{apiCounts.GET}</span>
            </div>
            <div className="rounded border border-line bg-elevated/15 py-1.5">
              <span className="block text-[10px] text-zinc-500 uppercase">POST</span>
              <span className="mt-0.5 text-sm font-bold text-accent">{apiCounts.POST}</span>
            </div>
            <div className="rounded border border-line bg-elevated/15 py-1.5">
              <span className="block text-[10px] text-zinc-500 uppercase">PUT</span>
              <span className="mt-0.5 text-sm font-bold text-yellow-400">{apiCounts.PUT}</span>
            </div>
            <div className="rounded border border-line bg-elevated/15 py-1.5">
              <span className="block text-[10px] text-zinc-500 uppercase">DELETE</span>
              <span className="mt-0.5 text-sm font-bold text-rose-400">{apiCounts.DELETE}</span>
            </div>
          </div>

          {config && config.api.endpoints.length > 0 ? (
            <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
              {config.api.endpoints.map((endpoint, idx) => {
                const methodColor = 
                  endpoint.method.toUpperCase() === "GET" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" :
                  endpoint.method.toUpperCase() === "POST" ? "text-accent border-accent/20 bg-accent/5" :
                  endpoint.method.toUpperCase() === "PUT" ? "text-yellow-400 border-yellow-500/20 bg-yellow-500/5" :
                  "text-rose-400 border-rose-500/20 bg-rose-500/5";
                
                return (
                  <div key={idx} className="flex items-center justify-between rounded-md border border-line/40 bg-elevated/5 p-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`w-14 text-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${methodColor}`}>
                        {endpoint.method.toUpperCase()}
                      </span>
                      <span className="font-mono text-zinc-300 text-[11px] truncate max-w-[240px] xl:max-w-[320px]">
                        /api/runtime{endpoint.path}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-line/40 bg-elevated/5 p-8 text-center text-xs text-zinc-500 font-mono">
              No API routes bound.
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Runtime Activity Timeline */}
        <section className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/40">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-zinc-200">Runtime Activity Timeline</h2>
            </div>
            <span className="rounded bg-elevated border border-line px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              {activities.length} Recorded
            </span>
          </div>

          {activities.length > 0 ? (
            <div className="relative pl-4 space-y-5 max-h-[380px] overflow-y-auto pr-1">
              {/* Vertical timeline connector */}
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[1px] bg-line/80" />

              {activities.slice().reverse().map((act, idx) => {
                let badgeColor = "bg-zinc-500";
                if (act.type.includes("CONFIG")) badgeColor = "bg-accent";
                else if (act.type.includes("CSV")) badgeColor = "bg-emerald-500";
                else if (act.type.includes("GITHUB") || act.type.includes("ZIP")) badgeColor = "bg-indigo-500";
                else if (act.type.includes("TRANSLATIONS")) badgeColor = "bg-amber-500";

                return (
                  <div key={idx} className="relative flex items-start gap-4 text-xs">
                    {/* Circle dot marker */}
                    <span className={`absolute -left-[13px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-panel ${badgeColor}`} />
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-300 font-mono text-[10px] tracking-wider uppercase">
                          {act.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(act.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[11px]">{act.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-line/40 bg-elevated/5 p-8 text-center text-xs text-zinc-500 font-mono">
              No persistent activities recorded yet. Actions like config changes or imports will be logged here.
            </div>
          )}
        </section>

        {/* Workspace Storage & Metadata Details */}
        <section className="rounded-lg border border-line bg-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/40">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-zinc-200">Runtime Inspector Details</h2>
            </div>
            <Settings className="h-4 w-4 text-zinc-500" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Runtime ID</span>
              <span className="font-semibold text-zinc-200 font-mono">
                rt_{config?.app.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "genstack"}_prod
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Generator model</span>
              <span className="font-semibold text-zinc-200 font-mono">Gemini 1.5 Pro</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Database SQLite</span>
              <span className="font-semibold text-zinc-200 font-mono">Local Prisma Storage</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Schema version</span>
              <span className="font-semibold text-accent font-mono">{activeVersion}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Active Locale</span>
              <span className="font-semibold text-zinc-200 uppercase font-mono">{config?.app.locale ?? locale}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Theme Mode</span>
              <span className="font-semibold text-zinc-200 font-mono">Editorial Premium Dark</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/30">
              <span className="text-zinc-500 font-mono">Google Sheets Sync</span>
              <span className={`font-semibold font-mono ${sheetsStatus.connected ? "text-emerald-400" : sheetsStatus.message === "Not configured or disabled" ? "text-zinc-500" : "text-rose-400"}`}>
                {sheetsStatus.connected ? "🟢 Connected" : sheetsStatus.message === "Not configured or disabled" ? "⚪ Disabled" : "🔴 Authentication Failed"}
              </span>
            </div>
            <div className="flex justify-between py-2 last:border-0">
              <span className="text-zinc-500 font-mono">Last Generated / Restored</span>
              <span className="font-semibold text-zinc-200 font-mono">{lastUpdated}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
