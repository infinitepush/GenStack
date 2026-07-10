"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Languages, Search, Save, Download, Loader2, Globe, FileCode, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { getActiveRuntime } from "@/lib/runtime-history";
import { EmptyState } from "@/components/onboarding/EmptyState";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string } | null;
}

function apiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export default function TranslationsPage(): JSX.Element {
  const t = useTranslations();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";

  const [messages, setMessages] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<string>("en");
  const [exportFormat, setExportFormat] = useState<"json" | "yaml" | "csv">("json");
  const [previewLocale, setPreviewLocale] = useState<string>("en");
  const [hasRuntime, setHasRuntime] = useState<boolean | null>(null);

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
          headers: { "Content-Type": "application/json" },
          credentials: "include"
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
    setHasRuntime(getActiveRuntime(userId) !== null);
    void fetchTranslations();
  }, [selectedLocale, userId]);

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
    try {
      const configRes = await fetch(`${apiBase()}/config`, { cache: "no-store", credentials: "include" });
      const configBody = await configRes.json();
      if (!configBody.success || !configBody.data?.config) {
        throw new Error(configBody.error?.message ?? "Failed to fetch configuration.");
      }
      
      const config = configBody.data.config;
      config.translations = messages;

      const saveRes = await fetch(`${apiBase()}/config?origin=translations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config)
      });
      const saveBody = await saveRes.json();
      if (!saveRes.ok || !saveBody.success) {
        throw new Error(saveBody.error?.message ?? "Failed to save configuration translations.");
      }

      window.dispatchEvent(new CustomEvent("genstack:config-applied"));

      await fetch(`${apiBase()}/runtime/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "TRANSLATIONS_CHANGED",
          message: `Saved changes to translation keys for locale "${selectedLocale}".`
        })
      });

      toast.success("Translations saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save translations");
    } finally {
      setIsSaving(false);
    }
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

    fetch(`${apiBase()}/runtime/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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

  if (hasRuntime === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!hasRuntime) {
    return (
      <EmptyState
        locale={selectedLocale}
        icon={<Languages className="h-7 w-7 text-zinc-500" />}
        title="No localization configs"
        description="GenStack provides automatic multi-language support. Generate your application first to configure translated static headers and dynamic values."
      />
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-fadeIn">
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
        <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="premium-card p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
              <div className="flex flex-wrap gap-1.5">
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => setSelectedLocale(locale)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition ${
                      selectedLocale === locale
                        ? "bg-accent text-white"
                        : "text-zinc-400 hover:text-zinc-200 bg-card/40 border border-line hover:bg-hover"
                    }`}
                    type="button"
                  >
                    {localeDisplayNames[locale] ?? locale.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search keys or values..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 premium-input"
                />
              </div>
            </div>

            <div className="border border-line rounded-xl overflow-hidden bg-card/10">
              <div className="max-h-[500px] overflow-y-auto divide-y divide-line">
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
                          className="w-full premium-input"
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
                className="premium-btn-primary px-5 text-xs h-10 shadow-none"
                type="button"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-1.5 text-white" />
                    Saving Changes...
                  </>
                ) : (
                  "Save Translations"
                )}
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            {/* Format Selection & Downloads */}
            <div className="premium-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-line">
                <Globe className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                  Export Options
                </h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Choose a format and download translation files.
              </p>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Format</label>
                <div className="grid grid-cols-3 gap-1 bg-card/30 p-1 rounded-xl border border-line">
                  {(["json", "yaml", "csv"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition ${
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

              <div className="space-y-2 pt-2 border-t border-line">
                <label className="block text-[10px] uppercase font-bold text-zinc-500 font-mono">Download Bundle</label>
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => downloadTranslation(locale)}
                    className="w-full premium-btn-secondary px-3.5 h-9 text-xs flex items-center justify-between gap-2"
                    type="button"
                  >
                    <span className="flex items-center gap-2 uppercase font-mono text-[9px]">
                      <FileCode className="h-3.5 w-3.5 text-zinc-500" />
                      {locale}.{exportFormat}
                    </span>
                    <span className="text-[10px] text-accent font-semibold font-mono">
                      Download
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Translation Preview Panel */}
            <div className="premium-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-line">
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
                    className="rounded-xl border border-line bg-[#121214] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-accent"
                  >
                    {locales.map((loc) => (
                      <option key={loc} value={loc} className="bg-[#18181D]">
                        {localeDisplayNames[loc] ? localeDisplayNames[loc].split(" ")[1] : loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <pre className="max-h-60 overflow-auto rounded-xl bg-card/10 p-3 font-mono text-[10px] text-zinc-400 border border-line whitespace-pre-wrap">
                    {serializedPreview}
                  </pre>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
