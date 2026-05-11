"use client";

import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, Table2 } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { appConfig } from "@/lib/app-config";

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
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestField(header: string, fields: string[]): string {
  const normalized = normalize(header);
  const synonyms: Record<string, string> = {
    amt: "amount",
    total: "amount",
    expensetitle: "title",
    name: "title",
    day: "date"
  };
  const synonym = synonyms[normalized];
  if (synonym && fields.includes(synonym)) return synonym;
  return fields.find((field) => normalize(field) === normalized || normalized.includes(normalize(field))) ?? "ignore";
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }
  return payload.data;
}

export default function ImportPage(): JSX.Element {
  const t = useTranslations();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isBusy, setIsBusy] = useState(false);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [tableName, setTableName] = useState(appConfig.database.tables[0]?.name ?? "");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  const table = appConfig.database.tables.find((candidate) => candidate.name === tableName);
  const fieldNames = useMemo(() => table?.fields.map((field) => field.name) ?? [], [table]);

  const applySuggestedMappings = (nextUpload: UploadResult, nextTableName = tableName): void => {
    const nextTable = appConfig.database.tables.find((candidate) => candidate.name === nextTableName);
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
      const nextUpload = await readApi<UploadResult>(
        await fetch(`${apiBase()}/import/upload`, { method: "POST", body })
      );
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
      const nextPreview = await readApi<PreviewResult>(
        await fetch(`${apiBase()}/import/map`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: upload.uploadId, tableName, mappings })
        })
      );
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
      const nextResult = await readApi<IngestResult>(
        await fetch(`${apiBase()}/import/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: upload.uploadId, tableName, mappings })
        })
      );
      setResult(nextResult);
      setStep(3);
      toast.success(`${nextResult.inserted} rows imported`);
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

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-electric">Phase 3</p>
        <h1 className="mt-3 text-3xl font-semibold">{t("nav_import")}</h1>
        <p className="mt-2 text-sm text-zinc-400">Upload, map, validate, and ingest CSV rows against the active AppConfig.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {["Upload", "Map Columns", "Result"].map((label, index) => (
          <div key={label} className={`rounded-lg border p-4 ${step === index + 1 ? "border-indigo-electric bg-indigo-electric/10" : "border-line bg-panel"}`}>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-zinc-500">Step {index + 1}</p>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <section className="rounded-lg border border-line bg-panel p-6">
          <label
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="grid cursor-pointer place-items-center rounded-lg border border-dashed border-zinc-700 bg-black/30 p-12 text-center hover:border-indigo-electric"
          >
            <FileUp className="h-10 w-10 text-indigo-300" />
            <p className="mt-4 text-lg font-medium">{t("upload_csv")}</p>
            <p className="mt-2 text-sm text-zinc-500">Drop a .csv file here or click to browse. Max size 5MB.</p>
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
          {isBusy ? <p className="mt-4 text-sm text-zinc-400">{t("loading")}</p> : null}
        </section>
      ) : null}

      {step === 2 && upload ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-line bg-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{upload.fileName}</h2>
                <p className="text-sm text-zinc-500">{upload.rowCount} data rows</p>
              </div>
              <select
                value={tableName}
                onChange={(event) => {
                  setTableName(event.target.value);
                  applySuggestedMappings(upload, event.target.value);
                }}
                className="rounded-md border border-line bg-black/40 px-3 py-2 text-sm"
              >
                {appConfig.database.tables.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>

            {upload.warnings.map((warning) => (
              <div key={warning} className="mt-4 flex gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                <AlertTriangle className="h-4 w-4" />
                {warning}
              </div>
            ))}

            <div className="mt-6 space-y-3">
              {upload.headers.map((header) => (
                <div key={header} className="grid gap-3 rounded-lg border border-line bg-black/20 p-3 md:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="text-sm font-medium">{header}</p>
                    <p className="text-xs text-zinc-500">CSV column</p>
                  </div>
                  <select
                    value={mappings[header] ?? "ignore"}
                    onChange={(event) => setMappings((previous) => ({ ...previous, [header]: event.target.value }))}
                    className="rounded-md border border-line bg-black/40 px-3 py-2 text-sm"
                  >
                    <option value="ignore">Ignore</option>
                    {table?.fields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => void validateMapping()} disabled={isBusy} className="rounded-md border border-line bg-black/30 px-4 py-2 text-sm">
                Validate preview
              </button>
              <button onClick={() => void ingest()} disabled={isBusy || !preview} className="rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {t("btn_import")}
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-line bg-panel p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Table2 className="h-4 w-4" />
              Preview
            </h2>
            <pre className="mt-4 max-h-72 overflow-auto rounded-md bg-black/50 p-3 font-mono text-xs text-zinc-300">
              {JSON.stringify(preview?.preview ?? upload.preview.slice(0, 3), null, 2)}
            </pre>
            {preview ? (
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-emerald-300">{preview.valid} valid rows</p>
                <p className="text-yellow-300">{preview.skipped} skipped rows</p>
                {preview.errors.slice(0, 5).map((error) => (
                  <p key={`${error.row}-${error.reason}`} className="text-xs text-red-300">
                    Row {error.row}: {error.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </aside>
        </section>
      ) : null}

      {step === 3 && result ? (
        <section className="rounded-lg border border-line bg-panel p-6">
          <div className="flex items-center gap-3 text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
            <h2 className="text-xl font-semibold">{result.inserted} rows imported successfully</h2>
          </div>
          <p className="mt-3 text-sm text-zinc-400">{result.skipped} rows skipped</p>
          {result.errors.length > 0 ? (
            <details className="mt-4 rounded-lg border border-line bg-black/20 p-4">
              <summary className="cursor-pointer text-sm text-zinc-200">View error list</summary>
              <div className="mt-3 max-h-72 overflow-auto space-y-2">
                {result.errors.map((error) => (
                  <p key={`${error.row}-${error.reason}`} className="text-sm text-red-300">
                    Row {error.row}: {error.reason}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-line bg-black/30 px-4 py-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              Import another file
            </button>
            <Link href={`/${appConfig.app.locale}/dashboard`} className="rounded-md bg-indigo-electric px-4 py-2 text-sm font-medium text-white">
              View in Dashboard
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
