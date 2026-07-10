"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link2, Loader2, Save, Slack, Globe, Table2, Play, CheckCircle2, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { getActiveRuntime } from "@/lib/runtime-history";
import { EmptyState } from "@/components/onboarding/EmptyState";

interface IntegrationSettings {
  webhook?: { enabled: boolean; url: string };
  slack?: { enabled: boolean; url: string };
  sheets?: { enabled: boolean; spreadsheetId: string; sheetName: string };
}

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

export default function IntegrationsPage(): JSX.Element {
  const t = useTranslations();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "_anonymous";

  const [settings, setSettings] = useState<IntegrationSettings>({
    webhook: { enabled: false, url: "" },
    slack: { enabled: false, url: "" },
    sheets: { enabled: false, spreadsheetId: "", sheetName: "" }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingStatus, setTestingStatus] = useState<Record<string, { success?: boolean; message?: string; loading?: boolean }>>({});
  const [sheetsStatus, setSheetsStatus] = useState<{ connected: boolean; message: string; lastSync: string; rowsSynced: number } | null>(null);
  const [hasRuntime, setHasRuntime] = useState<boolean | null>(null);

  const fetchSheetsStatus = async () => {
    try {
      const response = await fetch(`${apiBase()}/integrations/sheets/status`, { credentials: "include" });
      if (response.ok) {
        const body = await response.json();
        if (body.success && body.data) {
          setSheetsStatus(body.data);
        }
      }
    } catch (err) {
      console.error("Failed to load Sheets status:", err);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch(`${apiBase()}/integrations`, { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to fetch integration settings");
        }
        const body = (await response.json()) as ApiResponse<IntegrationSettings>;
        if (body.success && body.data) {
          setSettings({
            webhook: body.data.webhook ?? { enabled: false, url: "" },
            slack: body.data.slack ?? { enabled: false, url: "" },
            sheets: body.data.sheets ?? { enabled: false, spreadsheetId: "", sheetName: "" }
          });
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load integrations");
      } finally {
        setIsLoading(false);
      }
    }
    setHasRuntime(getActiveRuntime(userId) !== null);
    void loadSettings();
  }, [userId]);

  useEffect(() => {
    if (!isLoading) {
      void fetchSheetsStatus();
    }
  }, [isLoading]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${apiBase()}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings)
      });
      if (!response.ok) {
        throw new Error("Failed to save integration settings");
      }
      const body = (await response.json()) as ApiResponse<IntegrationSettings>;
      if (body.success) {
        toast.success("Integrations saved successfully!");
        void fetchSheetsStatus();
      } else {
        throw new Error(body.error?.message ?? "Failed to save settings");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save integrations");
    } finally {
      setIsSaving(false);
    }
  };

  const triggerTest = async (type: "webhook" | "slack" | "sheets") => {
    setTestingStatus(prev => ({ ...prev, [type]: { loading: true } }));
    try {
      const response = await fetch(`${apiBase()}/integrations/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, settings })
      });
      if (!response.ok) {
        throw new Error(`Test failed with HTTP status ${response.status}`);
      }
      const body = await response.json();
      if (body.success && body.data) {
        const testRes = body.data as { success: boolean; message: string };
        setTestingStatus(prev => ({
          ...prev,
          [type]: { loading: false, success: testRes.success, message: testRes.message }
        }));
        if (testRes.success) {
          toast.success(testRes.message);
          void fetchSheetsStatus();
        } else {
          toast.error(testRes.message);
        }
      } else {
        throw new Error(body.error?.message ?? "Test failed");
      }
    } catch (err: any) {
      const msg = err.message || "Test failed";
      setTestingStatus(prev => ({
        ...prev,
        [type]: { loading: false, success: false, message: msg }
      }));
      toast.error(msg);
    }
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
        locale="en"
        icon={<Link2 className="h-7 w-7 text-zinc-500" />}
        title="No dynamic integrations configured"
        description="GenStack lets you wire outbound integrations like Webhooks, Slack notifications, and Google Sheets updates automatically on database CRUD events. Generate your app first."
      />
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-fadeIn">
      <div>
        <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
          Phase 6 Integrations
        </span>
        <h1 className="mt-2 text-2xl font-bold flex items-center gap-2 text-zinc-100">
          <Link2 className="h-6 w-6 text-zinc-400" />
          Outbound Integrations
        </h1>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
          Configure, test, and activate webhook callbacks, Slack messages, and Google Sheets sync on database actions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          <p className="text-xs text-zinc-400 font-mono">Loading integrations settings...</p>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {/* Custom Webhook Settings */}
            <section className="premium-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card/60 text-zinc-400">
                    <Globe className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-200">Custom Webhooks</h2>
                    <p className="text-xs text-zinc-400">Receive HTTP POST payloads on database operations.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.webhook?.enabled ?? false}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        webhook: { ...(prev.webhook ?? { url: "" }), enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
                </label>
              </div>

              {settings.webhook?.enabled && (
                <div className="space-y-4 pt-2 border-t border-line animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-500">Webhook Target URL</label>
                    <input
                      type="url"
                      placeholder="https://yourserver.com/endpoint"
                      value={settings.webhook?.url ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          webhook: { ...(prev.webhook ?? { enabled: true }), url: e.target.value }
                        }))
                      }
                      className="w-full premium-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={testingStatus.webhook?.loading || !settings.webhook.url}
                      onClick={() => triggerTest("webhook")}
                      className="premium-btn-secondary px-3 text-xs h-8 flex items-center gap-1"
                    >
                      {testingStatus.webhook?.loading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-accent" />
                          Testing Webhook...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          Test Webhook
                        </>
                      )}
                    </button>
                    {testingStatus.webhook?.success !== undefined && (
                      <span className={`text-[11px] flex items-center gap-1 font-mono ${testingStatus.webhook.success ? "text-emerald-400" : "text-rose-400"}`}>
                        {testingStatus.webhook.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {testingStatus.webhook.success ? "Test Passed" : "Test Failed"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Slack Webhook Settings */}
            <section className="premium-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card/60 text-zinc-400">
                    <Slack className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-200">Slack Notifications</h2>
                    <p className="text-xs text-zinc-400">Post records feed directly to a Slack channel.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.slack?.enabled ?? false}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        slack: { ...(prev.slack ?? { url: "" }), enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
                </label>
              </div>

              {settings.slack?.enabled && (
                <div className="space-y-4 pt-2 border-t border-line animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-500">Incoming Webhook URL</label>
                    <input
                      type="url"
                      placeholder="Paste your Slack Incoming Webhook URL"
                      value={settings.slack?.url ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          slack: { ...(prev.slack ?? { enabled: true }), url: e.target.value }
                        }))
                      }
                      className="w-full premium-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={testingStatus.slack?.loading || !settings.slack.url}
                      onClick={() => triggerTest("slack")}
                      className="premium-btn-secondary px-3 text-xs h-8 flex items-center gap-1"
                    >
                      {testingStatus.slack?.loading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-accent" />
                          Testing Slack...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          Test Slack
                        </>
                      )}
                    </button>
                    {testingStatus.slack?.success !== undefined && (
                      <span className={`text-[11px] flex items-center gap-1 font-mono ${testingStatus.slack.success ? "text-emerald-400" : "text-rose-400"}`}>
                        {testingStatus.slack.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {testingStatus.slack.success ? "Test Passed" : "Test Failed"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Google Sheets Settings */}
            <section className="premium-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card/60 text-zinc-400">
                    <Table2 className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-200">Google Sheets Feed</h2>
                    <p className="text-xs text-zinc-400">Sync and append runtime database rows to a spreadsheet.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sheets?.enabled ?? false}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sheets: { ...(prev.sheets ?? { spreadsheetId: "", sheetName: "" }), enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
                </label>
              </div>

              {settings.sheets?.enabled && (
                <div className="space-y-4 pt-2 border-t border-line animate-fadeIn">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-500">Spreadsheet ID</label>
                      <input
                        type="text"
                        placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                        value={settings.sheets?.spreadsheetId ?? ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sheets: { ...(prev.sheets ?? { enabled: true, sheetName: "" }), spreadsheetId: e.target.value }
                          }))
                        }
                        className="w-full premium-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-500">Sheet Name</label>
                      <input
                        type="text"
                        placeholder="Sheet1"
                        value={settings.sheets?.sheetName ?? ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sheets: { ...(prev.sheets ?? { enabled: true, spreadsheetId: "" }), sheetName: e.target.value }
                          }))
                        }
                        className="w-full premium-input"
                      />
                    </div>
                  </div>

                  {sheetsStatus && (
                    <div className="text-xs font-mono border border-line bg-card/20 p-3 rounded-xl space-y-1.5 animate-fadeIn">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Google Sheets Sync:</span>
                        <span className={sheetsStatus.connected ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                          {sheetsStatus.connected ? "Connected" : `Disconnected (${sheetsStatus.message})`}
                        </span>
                      </div>
                      {sheetsStatus.connected && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Last Synced:</span>
                            <span className="text-zinc-300">{sheetsStatus.lastSync}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Total Synced Rows:</span>
                            <span className="text-zinc-300 font-semibold">{sheetsStatus.rowsSynced}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={testingStatus.sheets?.loading || !settings.sheets.spreadsheetId}
                      onClick={() => triggerTest("sheets")}
                      className="premium-btn-secondary px-3 text-xs h-8 flex items-center gap-1"
                    >
                      {testingStatus.sheets?.loading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-accent" />
                          Testing Sheets...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          Test Google Sheets
                        </>
                      )}
                    </button>
                    {testingStatus.sheets?.success !== undefined && (
                      <span className={`text-[11px] flex items-center gap-1 font-mono ${testingStatus.sheets.success ? "text-emerald-400" : "text-rose-400"}`}>
                        {testingStatus.sheets.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {testingStatus.sheets.success ? "Test Passed" : "Test Failed"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            <button
              onClick={() => void saveSettings()}
              disabled={isSaving}
              className="premium-btn-primary px-5 text-xs h-10 flex items-center gap-2 shadow-none"
              type="button"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Saving Settings...
                </>
              ) : (
                "Save Integrations"
              )}
            </button>
          </div>

          <aside className="space-y-8">
            <div className="premium-card p-5 space-y-3 shadow-sm text-xs">
              <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">How it works</h2>
              <p className="text-zinc-400 leading-relaxed">
                When integrations are active, database modifications (insert, update, delete) made by users will generate asynchronous HTTP requests to your defined endpoints.
              </p>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                Google Sheets logs triggers on standard API append operations. Slack updates utilize standard incoming webhook payloads.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
