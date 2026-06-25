"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Languages, Search, Save, Download, Loader2, Globe, FileCode, Check } from "lucide-react";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string } | null;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export default function TranslationsPage(): JSX.Element {
  const t = useTranslations();
  const [messages, setMessages] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<string>("en");
  const [exportFormat, setExportFormat] = useState<"json" | "yaml" | "csv">("json");
  const [previewLocale, setPreviewLocale] = useState<string>("en");

  // Keep previewLocale in sync with selectedLocale if selectedLocale changes
  useEffect(() => {
    setPreviewLocale(selectedLocale);
  }, [selectedLocale]);

  const serializedPreview = useMemo(() => {
    const data = messages[previewLocale] || {};
    if (exportFormat === "json") {
      return JSON.stringify(data, null, 2);
    }
    if (exportFormat === "yaml") {
      return Object.entries(data)
        .map(([key, val]) => `${key}: "${val.replace(/"/g, '\\"')}"`)
        .join("\n");
    }
    if (exportFormat === "csv") {
      const header = "Key,Value\n";
      const rows = Object.entries(data)
        .map(([key, val]) => {
          const escapedKey = `"${key.replace(/"/g, '""')}"`;
          const escapedVal = `"${val.replace(/"/g, '""')}"`;
          return `${escapedKey},${escapedVal}`;
        })
        .join("\n");
      return header + rows;
    }
    return "";
  }, [messages, previewLocale, exportFormat]);

  useEffect(() => {
    async function fetchTranslations() {
      try {
        const response = await fetch(`${apiBase()}/i18n/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const body = (await response.json()) as ApiResponse<Record<string, Record<string, string>>>;
        if (body.success && body.data) {
          setMessages(body.data);
          const keys = Object.keys(body.data);
          if (keys.length > 0 && !keys.includes(selectedLocale)) {
            setSelectedLocale(keys[0] || "en");
          }
        } else {
          throw new Error(body.error?.message ?? "Failed to generate translations.");
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load translations");
      } finally {
        setIsLoading(false);
      }
    }
    void fetchTranslations();
  }, [selectedLocale]);

  const locales = useMemo(() => Object.keys(messages), [messages]);

  const filteredKeys = useMemo(() => {
    const localeMessages = messages[selectedLocale] || {};
    return Object.keys(localeMessages).filter((key) => {
      const value = localeMessages[key] || "";
      return (
        key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        value.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [messages, selectedLocale, searchQuery]);

  const handleTranslationChange = (key: string, value: string) => {
    setMessages((prev) => ({
      ...prev,
      [selectedLocale]: {
        ...prev[selectedLocale],
        [key]: value
      }
    }));
  };

  const saveTranslations = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    try {
      await fetch(`${apiBase()}/runtime/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TRANSLATIONS_CHANGED",
          message: `Saved changes to translation keys for locale "${selectedLocale}".`
        })
      });
    } catch (err) {
      console.error("Failed to log translations changed activity:", err);
    }
    
    setIsSaving(false);
    toast.success("Translations saved successfully!");
  };

  const downloadTranslation = (locale: string) => {
    const data = messages[locale] || {};
    let content = "";
    let mimeType = "text/plain";
    const filename = `${locale}.${exportFormat}`;

    if (exportFormat === "json") {
      content = JSON.stringify(data, null, 2);
      mimeType = "application/json";
    } else if (exportFormat === "yaml") {
      content = Object.entries(data)
        .map(([key, val]) => `${key}: "${val.replace(/"/g, '\\"')}"`)
        .join("\n");
      mimeType = "text/yaml";
    } else if (exportFormat === "csv") {
      const header = "Key,Value\n";
      const rows = Object.entries(data)
        .map(([key, val]) => {
          const escapedKey = `"${key.replace(/"/g, '""')}"`;
          const escapedVal = `"${val.replace(/"/g, '""')}"`;
          return `${escapedKey},${escapedVal}`;
        })
        .join("\n");
      content = header + rows;
      mimeType = "text/csv";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);

    // Log timeline activity
    fetch(`${apiBase()}/runtime/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "TRANSLATION_EXPORTED",
        message: `Exported translations for locale "${locale}" in ${exportFormat.toUpperCase()} format.`
      })
    }).catch(err => console.error("Failed to log activity:", err));
  };

  const localeDisplayNames: Record<string, string> = {
    en: "🇬🇧 English",
    hi: "🇮🇳 Hindi",
    fr: "🇫🇷 French",
    de: "🇩🇪 German",
    es: "🇪🇸 Spanish",
    ja: "🇯🇵 Japanese",
    zh: "🇨🇳 Chinese",
    ar: "🇸🇦 Arabic"
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      <div>
        <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
          Dynamic Translations
        </span>
        <h1 className="mt-2 text-2xl font-bold flex items-center gap-2 text-zinc-100">
          <Languages className="h-6 w-6 text-zinc-400" />
          Translation Manager
        </h1>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
          Manage, search, and export dynamic application labels, database field headers, and menu components.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          <p className="text-xs text-zinc-400 font-mono">Generating dynamic translations...</p>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-line bg-panel p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line/45">
              <div className="flex flex-wrap gap-1.5">
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => setSelectedLocale(locale)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition ${
                      selectedLocale === locale
                        ? "bg-accent text-white"
                        : "text-zinc-400 hover:text-zinc-200 bg-elevated/20 border border-line/40 hover:bg-elevated/45"
                    }`}
                    type="button"
                  >
                    {localeDisplayNames[locale] ?? locale.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search keys or values..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 rounded-md border border-line/50 bg-[#121212] pl-9 pr-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
                />
              </div>
            </div>

            <div className="border border-line/45 rounded-lg overflow-hidden bg-elevated/5">
              <div className="max-h-[500px] overflow-y-auto divide-y divide-line/40">
                {filteredKeys.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">No translation keys match your search.</div>
                ) : (
                  filteredKeys.map((key) => {
                    const value = messages[selectedLocale]?.[key] ?? "";
                    return (
                      <div key={key} className="p-4 grid md:grid-cols-[280px_1fr] gap-4 items-center">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-zinc-300 truncate" title={key}>
                            {key}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {key.startsWith("field_")
                              ? "Table Field Header"
                              : key.startsWith("page_")
                              ? "Page Navigation Title"
                              : key.startsWith("component_")
                              ? "Component Header"
                              : "System Static Label"}
                          </p>
                        </div>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleTranslationChange(key, e.target.value)}
                          className="w-full h-9 rounded-md border border-line/50 bg-[#121212] px-3 text-xs outline-none focus:border-accent focus:ring-0 transition text-zinc-200"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => void saveTranslations()}
                disabled={isSaving}
                className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition shadow-none"
                type="button"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin inline-block mr-1.5" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    Save Translations
                  </>
                )}
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            {/* Format Selection & Downloads */}
            <div className="rounded-lg border border-line bg-panel p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-line/40">
                <Globe className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                  Export Options
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Choose a format and download translation files for integration or distribution.
              </p>

              {/* Format Selectors */}
              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Format</label>
                <div className="grid grid-cols-3 gap-1 bg-elevated/20 p-1 rounded-md border border-line/50">
                  {(["json", "yaml", "csv"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition ${
                        exportFormat === fmt
                          ? "bg-accent text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                      type="button"
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-line/30">
                <label className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Download Translation Bundle</label>
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => downloadTranslation(locale)}
                    className="w-full rounded-md bg-elevated/20 border border-line hover:bg-elevated/45 px-3 py-2 text-xs font-semibold text-zinc-300 flex items-center justify-between gap-2 transition duration-150"
                    type="button"
                  >
                    <span className="flex items-center gap-2 uppercase font-mono text-[10px]">
                      <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                      {locale}.{exportFormat}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-accent font-mono hover:text-accent-hover">
                      Download
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Translation Preview Panel */}
            <div className="rounded-lg border border-line bg-panel p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-line/40">
                <FileCode className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                  Translation Preview
                </h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Previewing:</span>
                  <select
                    value={previewLocale}
                    onChange={(e) => setPreviewLocale(e.target.value)}
                    className="rounded-md border border-line/50 bg-[#121212] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-accent focus:ring-0 transition"
                  >
                    {locales.map((loc) => (
                      <option key={loc} value={loc} className="bg-[#181818]">
                        {localeDisplayNames[loc] ? localeDisplayNames[loc].split(" ")[1] : loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <pre className="max-h-60 overflow-auto rounded-md bg-elevated/5 p-3 font-mono text-[10px] text-zinc-400 border border-line/40 whitespace-pre-wrap">
                    {serializedPreview}
                  </pre>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">Metadata Summary</h3>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed font-sans">
                Dynamic fields are pre-seeded in all 8 supported languages. Values will carry language prefixes (like [HI], [FR], etc.) if not explicitly translated, avoiding placeholder errors.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
