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
    <div className="rounded-lg border border-line bg-panel p-5">
      <h2 className="mb-4 text-base font-semibold">{getString(config.label, `Add ${sourceName ? humanizeTableName(sourceName) : "Record"}`)}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="mb-1 block text-sm text-zinc-300">{translateField(field)}</label>
            {field.type === "boolean" ? (
              <label className="flex h-10 items-center gap-3 rounded-md border border-line bg-black/40 px-3 text-sm text-zinc-300">
                <input
                  checked={formData[field.name] === "true"}
                  className="h-4 w-4 rounded border-line bg-black accent-indigo-electric"
                  name={field.name}
                  onChange={handleChange}
                  type="checkbox"
                />
                Enabled
              </label>
            ) : field.type === "enum" && field.options ? (
              <select name={field.name} value={formData[field.name] ?? ""} onChange={handleChange} className="h-10 w-full rounded-md border border-line bg-black/40 px-3 text-sm">
                <option value="">Select {field.label}</option>
                {field.options.map((option) => <option key={option} value={option}>{humanizeIdentifier(option)}</option>)}
              </select>
            ) : field.type === "text" ? (
              <textarea name={field.name} value={formData[field.name] ?? ""} onChange={handleChange} className="min-h-20 w-full rounded-md border border-line bg-black/40 px-3 py-2 text-sm" />
            ) : (
              <input
                name={field.name}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                value={formData[field.name] ?? ""}
                onChange={handleChange}
                className="h-10 w-full rounded-md border border-line bg-black/40 px-3 text-sm"
              />
            )}
            {errors[field.name] ? <p className="mt-1 text-sm text-red-400">{errors[field.name]}</p> : null}
          </div>
        ))}
        </div>
        {submitError ? <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{submitError}</p> : null}
        <button disabled={isSubmitting} className="w-full rounded-md bg-indigo-electric px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? "Saving..." : t("btn_save")}
        </button>
      </form>
    </div>
  );
};

export default FormRenderer;
