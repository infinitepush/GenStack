"use client";

import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, Table2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { AppConfig } from "@genstack/config-types";
import { getActiveRuntime } from "@/lib/runtime-history";
import { EmptyState } from "@/components/onboarding/EmptyState";

interface UploadResult {
  uploadId: string;
  fileName: string;
  headers: string[];
  preview: Record<string, string>[];
  rowCount: number;
  warnings: string[];
}

interface CsvRowError {
  row: number;
  reason: string;
}

interface PreviewResult {
  valid: number;
  skipped: number;
  preview: Record<string, unknown>[];
  errors: CsvRowError[];
}

interface IngestResult {
  inserted: number;
  skipped: number;
  errors: CsvRowError[];
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

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestField(header: string, fields: string[]): string {
  const normalizedHeader = normalize(header);
  const exactMatch = fields.find(field => normalize(field) === normalizedHeader);
  if (exactMatch) return exactMatch;

  const synonyms: Record<string, string> = {
    amt: "amount",
    total: "amount",
    expensetitle: "title",
    name: "title",
    day: "date",
    id: "id",
    desc: "description"
  };
  const synonym = synonyms[normalizedHeader];
  if (synonym && fields.includes(synonym)) return synonym;

  const partialMatch = fields.find(field => {
    const normField = normalize(field);
    return normalizedHeader.includes(normField) || normField.includes(normalizedHeader);
  });
  if (partialMatch) return partialMatch;

  return "ignore";
}

export default function ImportPage(): JSX.Element {
  const t = useTranslations();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? "en";
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";

  const [activeConfig, setActiveConfig] = useState<AppConfig | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isBusy, setIsBusy] = useState(false);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [tableName, setTableName] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [hasRuntime, setHasRuntime] = useState<boolean | null>(null);

  // Load the active config from backend on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" });
        const body = await res.json();
        if (body.success && body.data?.config) {
          const config = body.data.config as AppConfig;
          setActiveConfig(config);
          const firstTable = config.database.tables[0];
          if (firstTable) {
            setTableName(firstTable.name);
          }
        }
      } catch (err) {
        console.error("Failed to load active schema config:", err);
        toast.error("Failed to fetch database schema.");
      }
    }
    setHasRuntime(getActiveRuntime(userId) !== null);
    void loadConfig();
  }, [userId]);

  const table = useMemo(() => {
    return activeConfig?.database.tables.find((candidate) => candidate.name === tableName);
  }, [activeConfig, tableName]);

  const fieldNames = useMemo(() => table?.fields.map((field) => field.name) ?? [], [table]);

  const applySuggestedMappings = (nextUpload: UploadResult, nextTableName = tableName): void => {
    if (!activeConfig) return;
    const nextTable = activeConfig.database.tables.find((candidate) => candidate.name === nextTableName);
    const fields = nextTable?.fields.map((field) => field.name) ?? [];
    setMappings(Object.fromEntries(nextUpload.headers.map((header) => [header, suggestField(header, fields)])));
  };

  const uploadFile = async (file: File): Promise<void> => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("CSV file is larger than 5MB.");
      return;
    }

    setIsBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${apiBase()}/import/upload`, { method: "POST", body, credentials: "include" });
      const payload = (await response.json()) as ApiResponse<UploadResult>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Request failed.");
      }
      const nextUpload = payload.data;
      setUpload(nextUpload);
      applySuggestedMappings(nextUpload);
      setStep(2);
      toast.success(`${nextUpload.rowCount} rows detected`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsBusy(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file) void uploadFile(file);
  };

  const validateMapping = async (): Promise<void> => {
    if (!upload) return;
    setIsBusy(true);
    try {
      const response = await fetch(`${apiBase()}/import/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ uploadId: upload.uploadId, tableName, mappings })
      });
      const payload = (await response.json()) as ApiResponse<PreviewResult>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Request failed.");
      }
      const nextPreview = payload.data;
      setPreview(nextPreview);
      toast.success(`${nextPreview.valid} rows are valid`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Mapping failed");
    } finally {
      setIsBusy(false);
    }
  };

  const ingest = async (): Promise<void> => {
    if (!upload) return;
    setIsBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const response = await fetch(`${apiBase()}/import/ingest`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ uploadId: upload.uploadId, tableName, mappings })
      });
      const payload = (await response.json()) as ApiResponse<IngestResult>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Request failed.");
      }
      const nextResult = payload.data;
      setResult(nextResult);
      setStep(3);
      if (nextResult.inserted > 0) {
        toast.success(`${nextResult.inserted} rows imported`);
      } else {
        toast.error("No rows were imported. Check validation warnings.");
      }

      if (nextResult.inserted > 0) {
        await fetch(`${apiBase()}/runtime/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "CSV_IMPORTED",
            message: `Imported CSV data: ${nextResult.inserted} rows ingested successfully into table "${tableName}".`
          })
        }).catch(err => console.error("Failed to log activity:", err));
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsBusy(false);
    }
  };

  const reset = (): void => {
    setStep(1);
    setUpload(null);
    setPreview(null);
    setResult(null);
    setMappings({});
  };

  if (hasRuntime === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!hasRuntime) {
    return (
      <EmptyState
        locale={locale}
        icon={<FileUp className="h-7 w-7 text-zinc-500" />}
        title="No generated tables to import into"
        description="GenStack allows mapping and importing CSV files directly into active database tables. Generate your application first to configure target tables."
      />
    );
  }

  if (!activeConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <p className="text-xs text-zinc-400 font-mono">Loading active database schema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-fadeIn">
      <div>
        <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
          Phase 3 Ingestion
        </span>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">{t("nav_import")}</h1>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">Upload, map, validate, and ingest CSV rows against the active database tables.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Upload CSV File", "Map Column Fields", "Review Results"].map((label, index) => (
          <div key={label} className={`rounded-xl border p-4 transition-all duration-150 ${step === index + 1 ? "border-accent/40 bg-accent/5 text-zinc-100 font-semibold" : "border-line bg-card/45 text-zinc-400"}`}>
            <p className="text-xs">{label}</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Step {index + 1}</p>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <section className="premium-card p-6 md:p-8 shadow-sm">
          <label
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-line bg-card/10 p-12 text-center hover:border-accent/40 transition duration-150"
          >
            <FileUp className="h-10 w-10 text-zinc-500" />
            <p className="mt-4 text-sm font-semibold text-zinc-200">{t("upload_csv")}</p>
            <p className="mt-1.5 text-xs text-zinc-400">Drop a .csv file here or click to browse. Max size 5MB.</p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.item(0);
                if (file) void uploadFile(file);
              }}
            />
          </label>
          {isBusy ? (
            <div className="flex items-center gap-2 mt-4 text-xs text-zinc-400 font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Parsing CSV...
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 && upload ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="premium-card p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">{upload.fileName}</h2>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{upload.rowCount} data rows detected</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-mono">Target Table:</span>
                <select
                  value={tableName}
                  onChange={(event) => {
                    setTableName(event.target.value);
                    applySuggestedMappings(upload, event.target.value);
                  }}
                  className="rounded-xl border border-line bg-[#121214] px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent"
                >
                  {activeConfig.database.tables.map((item) => (
                    <option key={item.name} value={item.name} className="bg-[#18181D]">{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-card/25 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-200">Required Fields Mapping Status</h3>
              <p className="text-[11px] text-zinc-400">All required fields must be mapped to a CSV column to successfully ingest.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {table?.fields.filter(f => f.required).map((field) => {
                  const isMapped = Object.values(mappings).includes(field.name);
                  return (
                    <div key={field.name} className="flex items-center gap-2 text-xs">
                      {isMapped ? (
                        <span className="text-emerald-400">✔</span>
                      ) : (
                        <span className="text-rose-500">❌</span>
                      )}
                      <span className={isMapped ? "text-zinc-300 font-mono font-medium" : "text-zinc-400 font-mono line-through opacity-70"}>
                        {field.name}
                      </span>
                    </div>
                  );
                })}
                {table?.fields.filter(f => f.required).length === 0 && (
                  <p className="text-[11px] text-zinc-500 italic col-span-full">No required fields in this table.</p>
                )}
              </div>
            </div>

            {upload.warnings.map((warning) => (
              <div key={warning} className="mt-4 flex gap-2 rounded-xl border border-warning/25 bg-warning/5 p-3 text-xs text-warning/95">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                {warning}
              </div>
            ))}

            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {upload.headers.map((header) => (
                <div key={header} className="grid gap-3 rounded-xl border border-line bg-card/20 p-3.5 md:grid-cols-[1fr_1fr] items-center">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">{header}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">CSV column</p>
                  </div>
                  <select
                    value={mappings[header] ?? "ignore"}
                    onChange={(event) => setMappings((previous) => ({ ...previous, [header]: event.target.value }))}
                    className="rounded-xl border border-line bg-[#121214] px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent"
                  >
                    <option value="ignore" className="bg-[#18181D]">Ignore</option>
                    {table?.fields.map((field) => (
                      <option key={field.name} value={field.name} className="bg-[#18181D]">
                        {field.name} ({field.type})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-line">
              <button 
                onClick={() => void validateMapping()} 
                disabled={isBusy} 
                className="premium-btn-secondary px-4 text-xs h-9"
              >
                {isBusy ? "Validating..." : "Validate schema mappings"}
              </button>
              <button 
                onClick={() => void ingest()} 
                disabled={isBusy || !preview} 
                className="premium-btn-primary px-5 text-xs h-9 shadow-none"
              >
                {isBusy ? "Importing..." : t("btn_import")}
              </button>
            </div>
          </div>

          <aside className="premium-card p-5 shadow-sm space-y-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Table2 className="h-3.5 w-3.5 text-zinc-500" />
              Ingestion Preview
            </h2>
            <pre className="max-h-72 overflow-auto rounded-xl bg-card/10 p-4 font-mono text-[11px] text-zinc-400 border border-line">
              {JSON.stringify(preview?.preview ?? upload.preview.slice(0, 3), null, 2)}
            </pre>
            {preview ? (
              <div className="space-y-3 pt-3 border-t border-line text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-line/40">
                  <span className="text-zinc-500">Valid Rows</span>
                  <span className="text-emerald-400 font-semibold">{preview.valid}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line/40">
                  <span className="text-zinc-500">Skipped/Degraded Rows</span>
                  <span className="text-warning font-semibold">{preview.skipped}</span>
                </div>
                {preview.errors.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Validation Warnings</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto text-[10px] text-rose-400 bg-rose-500/5 rounded p-2.5 border border-line">
                      {preview.errors.slice(0, 8).map((error, idx) => (
                        <p key={idx}>
                          Row {error.row}: {error.reason}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        </section>
      ) : null}

      {step === 3 && result ? (
        <section className="premium-card p-6 md:p-8 shadow-sm max-w-2xl">
          <div className="flex items-center gap-3 text-zinc-300">
            {result.inserted > 0 ? (
              <>
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                <h2 className="text-lg font-bold text-zinc-100">CSV Data Imported Successfully</h2>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 shrink-0 text-warning" />
                <h2 className="text-lg font-bold text-zinc-100">No Data Imported</h2>
              </>
            )}
          </div>
          
          <div className="mt-6 border border-line rounded-xl bg-card/20 p-4 space-y-3 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-line/40">
              <span className="text-zinc-500">Rows Detected</span>
              <span className="text-zinc-200">{upload?.rowCount ?? 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line/40">
              <span className="text-zinc-500">Rows Imported</span>
              <span className="text-emerald-400 font-bold">{result.inserted}</span>
            </div>
            <div className="flex justify-between py-1.5 last:border-0">
              <span className="text-zinc-500">Rows Skipped</span>
              <span className="text-warning">{result.skipped}</span>
            </div>
          </div>

          {result.errors.length > 0 ? (
            <details className="mt-4 rounded-xl border border-line bg-card/10 p-4">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-200 font-mono">View Ingestion Errors ({result.errors.length})</summary>
              <div className="mt-3 max-h-72 overflow-auto space-y-1.5">
                {result.errors.map((error, idx) => (
                  <p key={idx} className="text-xs text-danger leading-relaxed font-mono">
                    Row {error.row}: {error.reason}
                  </p>
                ))}
              </div>
            </details>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={reset} className="premium-btn-secondary px-4 text-xs h-9 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
              Import another file
            </button>
            <Link href={`/${activeConfig.app.locale}/dashboard`} className="premium-btn-primary px-5 text-xs h-9 flex items-center justify-center">
              View in Dashboard
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
