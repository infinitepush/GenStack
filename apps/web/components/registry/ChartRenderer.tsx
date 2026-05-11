"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComponentRendererProps } from "./index";
import { humanizeIdentifier, humanizeTableName } from "@/lib/labels";

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

interface ChartBucket {
  category: string;
  count: number;
  sum: number;
  metric: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const ChartRenderer = ({ config, data = [], sourceName }: ComponentRendererProps): JSX.Element => {
  const t = useTranslations();
  const groupBy = getString(config.groupBy, "category");
  const field = getString(config.field, "value");
  const aggregation = getString(config.aggregation, "count");
  const grouped = new Map<string, Omit<ChartBucket, "metric">>();
  data.forEach((row) => {
    const key = getString(row[groupBy], "Other");
    const previous = grouped.get(key) ?? { category: key, count: 0, sum: 0 };
    grouped.set(key, {
      category: key,
      count: previous.count + 1,
      sum: previous.sum + (toNumber(row[field]) ?? 0)
    });
  });
  const chartData: ChartBucket[] = Array.from(grouped.values()).map((bucket) => ({
    ...bucket,
    metric:
      aggregation === "sum"
        ? bucket.sum
        : aggregation === "avg"
          ? bucket.count > 0 ? bucket.sum / bucket.count : 0
          : bucket.count
  }));
  const metricLabel =
    aggregation === "sum"
      ? `Sum of ${humanizeIdentifier(field)}`
      : aggregation === "avg"
        ? `Average ${humanizeIdentifier(field)}`
        : "Record Count";

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-panel p-8 text-center">
        <p className="text-lg font-medium text-zinc-200">No chart data yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          {t("empty_state")}. Add {sourceName ? humanizeTableName(sourceName).toLowerCase() : "records"} to populate this chart.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <div className="mb-4">
        <p className="text-sm font-medium text-zinc-200">{metricLabel} by {humanizeIdentifier(groupBy)}</p>
        <p className="mt-1 text-xs text-zinc-500">{chartData.length} group(s)</p>
      </div>
      <div className="h-72 min-w-0 overflow-hidden rounded-md bg-black/20 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="category" stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
          <YAxis stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
            formatter={(value) => [Number(value).toLocaleString(), metricLabel]}
            contentStyle={{ backgroundColor: "#111113", border: "1px solid #27272a", borderRadius: 8, color: "#f4f4f5" }}
            itemStyle={{ color: "#c7d2fe" }}
            labelStyle={{ color: "#f4f4f5" }}
          />
          <Bar dataKey="metric" fill="#6366f1" name={metricLabel} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartRenderer;
