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
      <div className="rounded-xl border border-line bg-panel p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-zinc-200">No chart data yet</p>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
          {t("empty_state")}. Add {sourceName ? humanizeTableName(sourceName).toLowerCase() : "records"} to populate this chart.
        </p>
        <p className="mt-3.5 text-[10px] uppercase tracking-wider text-zinc-600 font-mono">Responsive chart · legend · cleaner labels</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line/45 bg-panel p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-200">
            {metricLabel} by {humanizeIdentifier(groupBy)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">{chartData.length} group(s)</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-500 font-mono">
          <span className="rounded-full border border-line/55 bg-elevated/20 px-2 py-0.5 text-zinc-400">Legend enabled</span>
          <span className="rounded-full border border-line/55 bg-elevated/20 px-2 py-0.5 text-zinc-400">Responsive</span>
          <span className="rounded-full border border-line/55 bg-elevated/20 px-2 py-0.5 text-zinc-400">Runtime-safe</span>
        </div>
      </div>
      <div className="h-80 min-w-0 overflow-hidden rounded-md border border-line/45 bg-elevated/5 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 12, left: 0 }}>
            <defs>
              <linearGradient id="chartBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5E6AD2" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#3E4AA2" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="category"
              stroke="#737373"
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.04)" }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              stroke="#737373"
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(94, 106, 210, 0.04)" }}
              formatter={(value) => [Number(value).toLocaleString(), metricLabel]}
              labelFormatter={(label) => `${humanizeIdentifier(String(label))}`}
              contentStyle={{ backgroundColor: "#181818", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 6, color: "#f5f5f5" }}
              itemStyle={{ color: "#5E6AD2", fontSize: 11 }}
              labelStyle={{ color: "#f5f5f5", fontSize: 11 }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 8, color: "#a3a3a3", fontSize: 10 }}
              formatter={() => metricLabel}
            />
            <Bar dataKey="metric" fill="url(#chartBarGradient)" name={metricLabel} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartRenderer;
