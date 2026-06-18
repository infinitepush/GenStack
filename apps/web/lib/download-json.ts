import type { AppConfig } from "@genstack/config-types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim() || "genstack";
}

export function buildConfigDownloadName(config: AppConfig): string {
  return `${slugify(config.app.name)}-config.json`;
}

export function downloadJson(filename: string, data: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(data, null, 2);
  const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
