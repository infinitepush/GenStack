"use client";

import type { ComponentType } from "react";
import type { ComponentConfig, FieldConfig } from "@genstack/config-types";
import ChartRenderer from "./ChartRenderer";
import FormRenderer from "./FormRenderer";
import StatCardRenderer from "./StatCardRenderer";
import TableRenderer from "./TableRenderer";

export type DataRecord = Record<string, unknown>;

export interface ComponentRendererProps {
  config: ComponentConfig;
  data?: DataRecord[];
  onDataChange?: (data: DataRecord) => Promise<void> | void;
  onDeleteRecord?: (id: string) => Promise<void> | void;
  onUpdateRecord?: (id: string, data: DataRecord) => Promise<void> | void;
  sourceName?: string;
  tableSchema?: FieldConfig[] | undefined;
}

export type ComponentRegistry = Record<string, ComponentType<ComponentRendererProps>>;

export const componentRegistry: ComponentRegistry = {
  form: FormRenderer,
  table: TableRenderer,
  stat_card: StatCardRenderer,
  chart: ChartRenderer
};

export function getComponentRenderer(type: string): ComponentType<ComponentRendererProps> {
  return componentRegistry[type] ?? UnknownComponentFallback;
}

function UnknownComponentFallback({ config }: ComponentRendererProps): JSX.Element {
  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
      <p className="text-xs font-semibold text-yellow-200">Unknown component: {config.type}</p>
      <p className="mt-1 text-xs text-yellow-300/80 leading-relaxed">This component type is not registered yet.</p>
    </div>
  );
}

export default componentRegistry;
