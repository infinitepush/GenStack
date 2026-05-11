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
    <div className="rounded-lg border border-yellow-500/60 bg-yellow-500/10 p-4">
      <p className="font-semibold text-yellow-100">Unknown component: {config.type}</p>
      <p className="mt-1 text-sm text-yellow-200">This component type is not registered yet.</p>
    </div>
  );
}

export default componentRegistry;
