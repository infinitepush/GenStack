"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { FieldConfig } from "@genstack/config-types";
import type { ComponentRendererProps, DataRecord } from "./index";
import { humanizeIdentifier, humanizeTableName } from "@/lib/labels";

interface FormFieldConfig extends FieldConfig {
  label: string;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function resolveField(fieldName: string, tableSchema: FieldConfig[] | undefined): FormFieldConfig {
  const fieldDef = tableSchema?.find((field) => field.name === fieldName);
  return {
    name: fieldName,
    type: fieldDef?.type ?? "string",
    required: fieldDef?.required ?? true,
    options: fieldDef?.options,
    label: humanizeIdentifier(fieldDef?.name ?? fieldName)
  };
}

const FormRenderer = ({ config, onDataChange, sourceName, tableSchema }: ComponentRendererProps): JSX.Element => {
  const t = useTranslations();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fields = useMemo(
    () => getStringArray(config.fields).map((fieldName) => resolveField(fieldName, tableSchema)),
    [config.fields, tableSchema]
  );
  const translateField = (field: FormFieldConfig): string => {
    const key = `field_${field.name}`;
    try {
      const translated = t(key);
      return translated === key ? field.label : translated;
    } catch {
      return field.label;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const payload: DataRecord = {};
    setSubmitError(null);

    fields.forEach((field) => {
      const value = field.type === "boolean" ? formData[field.name] : formData[field.name]?.trim();
      if (field.required && !value) {
        nextErrors[field.name] = `${field.label} is required`;
        return;
      }
      if (!value) return;
      if (field.type === "number") {
        const numberValue = Number(value);
        if (Number.isNaN(numberValue)) {
          nextErrors[field.name] = `${field.label} must be a number`;
          return;
        }
        payload[field.name] = numberValue;
        return;
      }
      if (field.type === "boolean") {
        payload[field.name] = value === "true";
        return;
      }
      payload[field.name] = value;
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await onDataChange?.(payload);
      setFormData({});
      toast.success(`${sourceName ? humanizeTableName(sourceName) : "Record"} saved`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save record.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const target = event.target;
    const { name, value } = target;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      setFormData((previous) => ({ ...previous, [name]: target.checked ? "true" : "false" }));
      return;
    }
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <div className="rounded-lg border border-line/45 bg-panel p-6 md:p-8 shadow-sm">
      <h2 className="mb-6 text-sm font-semibold text-zinc-200">{getString(config.label, `Add ${sourceName ? humanizeTableName(sourceName) : "Record"}`)}</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">{translateField(field)}</label>
              {field.type === "boolean" ? (
                <label className="flex h-9 items-center gap-2.5 rounded-md border border-line/50 bg-[#121212] px-3 text-xs text-zinc-300 cursor-pointer select-none">
                  <input
                    checked={formData[field.name] === "true"}
                    className="h-3.5 w-3.5 rounded border-line/50 bg-elevated text-accent accent-accent focus:ring-0 focus:ring-offset-0"
                    name={field.name}
                    onChange={handleChange}
                    type="checkbox"
                  />
                  Enabled
                </label>
              ) : field.type === "enum" && field.options ? (
                <select name={field.name} value={formData[field.name] ?? ""} onChange={handleChange} className="h-9 w-full rounded-md border border-line/50 bg-[#121212] px-3 text-xs text-zinc-200 outline-none transition focus:border-accent focus:ring-0">
                  <option value="" className="bg-[#181818]">Select {field.label}</option>
                  {field.options.map((option) => <option key={option} value={option} className="bg-[#181818]">{humanizeIdentifier(option)}</option>)}
                </select>
              ) : field.type === "text" ? (
                <textarea name={field.name} value={formData[field.name] ?? ""} onChange={handleChange} className="min-h-20 w-full rounded-md border border-line/50 bg-[#121212] px-3 py-2 text-xs text-zinc-200 outline-none transition focus:border-accent focus:ring-0" />
              ) : (
                <input
                  name={field.name}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={formData[field.name] ?? ""}
                  onChange={handleChange}
                  className="h-9 w-full rounded-md border border-line/50 bg-[#121212] px-3 text-xs text-zinc-200 outline-none transition focus:border-accent focus:ring-0"
                />
              )}
              {errors[field.name] ? <p className="mt-1 text-[10px] text-red-400 font-mono">{errors[field.name]}</p> : null}
            </div>
          ))}
        </div>
        {submitError ? <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{submitError}</p> : null}
        <button disabled={isSubmitting} className="w-full rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-none">
          {isSubmitting ? "Saving..." : t("btn_save")}
        </button>
      </form>
    </div>
  );
};

export default FormRenderer;
