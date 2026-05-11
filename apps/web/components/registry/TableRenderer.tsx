"use client";

import { Pencil, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ComponentRendererProps } from "./index";
import { humanizeIdentifier, humanizeTableName } from "@/lib/labels";

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function editableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

const TableRenderer = ({ config, data = [], onDeleteRecord, onUpdateRecord, sourceName }: ComponentRendererProps): JSX.Element => {
  const t = useTranslations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const columns = getStringArray(config.columns);
  const hasActions = Boolean(onDeleteRecord || onUpdateRecord);
  const itemLabel = sourceName ? humanizeTableName(sourceName) : "Record";
  const pageSize = 8;

  const filteredData = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = needle
      ? data.filter((row) => columns.some((column) => String(row[column] ?? "").toLowerCase().includes(needle)))
      : data;

    if (!sort) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const left = a[sort.column];
      const right = b[sort.column];
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      const compared = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
        ? leftNumber - rightNumber
        : String(left ?? "").localeCompare(String(right ?? ""));
      return sort.direction === "asc" ? compared : -compared;
    });
  }, [columns, data, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const visibleData = filteredData.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  const toggleSort = (column: string): void => {
    setSort((previous) => {
      if (previous?.column !== column) return { column, direction: "asc" };
      if (previous.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-panel p-8 text-center">
        <p className="text-lg font-medium text-zinc-200">No {sourceName ? humanizeIdentifier(sourceName).toLowerCase() : "records"} yet</p>
        <p className="mt-2 text-sm text-zinc-500">{t("empty_state")}. Add your first {itemLabel.toLowerCase()} using the form on this page.</p>
      </div>
    );
  }

  const startEdit = (row: Record<string, unknown>): void => {
    const id = String(row.id ?? "");
    setEditingId(id);
    setDraft(Object.fromEntries(columns.map((column) => [column, editableValue(row[column])])));
  };

  const saveEdit = async (): Promise<void> => {
    if (!editingId || !onUpdateRecord) return;
    setPendingId(editingId);
    try {
      await onUpdateRecord(editingId, draft);
      setEditingId(null);
      setDraft({});
      toast.success(`${itemLabel} updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to update ${itemLabel.toLowerCase()}`);
    } finally {
      setPendingId(null);
    }
  };

  const deleteRow = async (id: string): Promise<void> => {
    if (!onDeleteRecord) return;
    setPendingId(id);
    try {
      await onDeleteRecord(id);
      toast.success(`${itemLabel} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to delete ${itemLabel.toLowerCase()}`);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
        <input
          className="h-9 min-w-64 rounded-md border border-line bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-indigo-electric"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={`Search ${sourceName ? humanizeIdentifier(sourceName).toLowerCase() : "records"}...`}
          value={search}
        />
        <p className="text-xs text-zinc-500">
          {filteredData.length} of {data.length} record(s)
        </p>
      </div>
      <table className="w-full table-fixed">
        <thead className="bg-white/5">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-sm text-zinc-300">
                <button className="inline-flex items-center gap-1 text-left hover:text-white" onClick={() => toggleSort(column)} type="button">
                  {humanizeIdentifier(column)}
                  <span className="font-mono text-[10px] text-zinc-500">
                    {sort?.column === column ? (sort.direction === "asc" ? "A-Z" : "Z-A") : ""}
                  </span>
                </button>
              </th>
            ))}
            {hasActions ? <th className="w-32 px-4 py-3 text-right text-sm text-zinc-300">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {visibleData.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-t border-line">
              {columns.map((column) => (
                <td key={column} className="px-4 py-3 text-sm text-zinc-400">
                  {editingId === String(row.id ?? "") ? (
                    <input
                      className="h-9 w-full rounded-md border border-line bg-black/40 px-2 text-sm text-zinc-100"
                      onChange={(event) => setDraft((previous) => ({ ...previous, [column]: event.target.value }))}
                      value={draft[column] ?? ""}
                    />
                  ) : (
                    <span className="block truncate">{String(row[column] ?? "-")}</span>
                  )}
                </td>
              ))}
              {hasActions ? (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editingId === String(row.id ?? "") ? (
                      <>
                        <button aria-label="Save row" className="rounded-md border border-line p-2 text-emerald-300 hover:bg-white/5" disabled={pendingId === String(row.id ?? "")} onClick={() => void saveEdit()} type="button">
                          <Save className="h-4 w-4" />
                        </button>
                        <button aria-label="Cancel edit" className="rounded-md border border-line p-2 text-zinc-400 hover:bg-white/5" onClick={() => setEditingId(null)} type="button">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {onUpdateRecord ? (
                          <button aria-label="Edit row" className="rounded-md border border-line p-2 text-zinc-300 hover:bg-white/5" onClick={() => startEdit(row)} type="button">
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {onDeleteRecord ? (
                          <button aria-label="Delete row" className="rounded-md border border-line p-2 text-red-300 hover:bg-red-500/10" disabled={pendingId === String(row.id ?? "")} onClick={() => void deleteRow(String(row.id ?? ""))} type="button">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-line p-3 text-sm text-zinc-400">
        <span>
          Page {Math.min(page, pageCount)} of {pageCount}
        </span>
        <div className="flex gap-2">
          <button className="rounded-md border border-line px-3 py-1.5 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))} type="button">
            Previous
          </button>
          <button className="rounded-md border border-line px-3 py-1.5 disabled:opacity-50" disabled={page >= pageCount} onClick={() => setPage((previous) => Math.min(pageCount, previous + 1))} type="button">
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableRenderer;
