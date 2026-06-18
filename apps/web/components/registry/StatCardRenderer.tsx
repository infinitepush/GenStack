"use client";

import type { ComponentRendererProps } from "./index";
import { applyComponentFilter } from "./filters";
import { humanizeIdentifier } from "@/lib/labels";

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

const StatCardRenderer = ({ config, data = [] }: ComponentRendererProps): JSX.Element => {
  const filteredData = applyComponentFilter(data, config);
  const field = getString(config.field, "");
  const aggregation = getString(config.aggregation, "sum");
  const values = filteredData.map((row) => Number(row[field]) || 0);
  const sum = values.reduce((total, item) => total + item, 0);
  const value = aggregation === "count" ? filteredData.length : aggregation === "avg" ? (filteredData.length > 0 ? sum / filteredData.length : 0) : sum;
  const label = getString(config.label, aggregation === "count" ? "Total Records" : `${humanizeIdentifier(aggregation)} ${humanizeIdentifier(field)}`);

  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-indigo-300">{value.toLocaleString()}</p>
    </div>
  );
};

export default StatCardRenderer;
