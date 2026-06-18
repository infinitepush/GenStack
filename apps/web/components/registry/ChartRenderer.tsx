"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
      <div className="rounded-xl border border-line bg-panel p-8 text-center">
        <p className="text-lg font-medium text-zinc-100">No chart data yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          {t("empty_state")}. Add {sourceName ? humanizeTableName(sourceName).toLowerCase() : "records"} to populate this chart.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-600">Responsive chart · legend · cleaner labels</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {metricLabel} by {humanizeIdentifier(groupBy)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{chartData.length} group(s)</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
          <span className="rounded-full border border-line bg-black/25 px-2.5 py-1">Legend enabled</span>
          <span className="rounded-full border border-line bg-black/25 px-2.5 py-1">Responsive</span>
          <span className="rounded-full border border-line bg-black/25 px-2.5 py-1">Runtime-safe</span>
        </div>
      </div>
      <div className="h-80 min-w-0 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 12, left: 0 }}>
            <defs>
              <linearGradient id="chartBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.98} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.72} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="category"
              stroke="#a1a1aa"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              stroke="#a1a1aa"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
              formatter={(value) => [Number(value).toLocaleString(), metricLabel]}
              labelFormatter={(label) => `${humanizeIdentifier(String(label))}`}
              contentStyle={{ backgroundColor: "#111113", border: "1px solid #27272a", borderRadius: 10, color: "#f4f4f5" }}
              itemStyle={{ color: "#c7d2fe" }}
              labelStyle={{ color: "#f4f4f5" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 8, color: "#d4d4d8", fontSize: 12 }}
              formatter={() => metricLabel}
            />
            <Bar dataKey="metric" fill="url(#chartBarGradient)" name={metricLabel} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartRenderer;
