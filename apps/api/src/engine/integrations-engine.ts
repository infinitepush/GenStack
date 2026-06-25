import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { addRuntimeActivity } from "../lib/config-store.js";

export interface IntegrationSettings {
  webhook?: { enabled: boolean; url: string };
  slack?: { enabled: boolean; url: string };
  sheets?: { enabled: boolean; spreadsheetId: string; sheetName: string };
}

const INTEGRATION_DB_KEY = "system:integrations";

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  try {
    const record = await prisma.appState.findUnique({
      where: { key: INTEGRATION_DB_KEY }
    });
    if (record && typeof record.value === "object" && record.value !== null) {
      return record.value as unknown as IntegrationSettings;
    }
  } catch (error: unknown) {
    logger.error({ error }, "Failed to load integration settings");
  }
  return {
    webhook: { enabled: false, url: "" },
    slack: { enabled: false, url: "" },
    sheets: { enabled: false, spreadsheetId: "", sheetName: "" }
  };
}

export async function saveIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings> {
  try {
    await prisma.appState.upsert({
      where: { key: INTEGRATION_DB_KEY },
      update: { value: settings as any },
      create: { key: INTEGRATION_DB_KEY, value: settings as any }
    });
    logger.info("Saved integration settings to database");
  } catch (error: unknown) {
    logger.error({ error }, "Failed to save integration settings");
  }
  return settings;
}

async function resolveGoogleCredentials(): Promise<{ email: string; privateKey: string } | null> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }

  const rootCredsPath = path.join(process.cwd(), "google-sheets-credentials.json");
  if (fs.existsSync(rootCredsPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(rootCredsPath, "utf8"));
      if (content.client_email && content.private_key) {
        return {
          email: content.client_email,
          privateKey: content.private_key
        };
      }
    } catch (e) {
      logger.error({ error: e }, "Failed to parse google-sheets-credentials.json");
    }
  }
  return null;
}

async function appendToGoogleSheet(
  spreadsheetId: string,
  sheetName: string,
  email: string,
  privateKey: string,
  record: unknown
): Promise<void> {
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = typeof record === "object" && record !== null ? Object.values(record) : [record];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values]
    }
  });

  if (response.status !== 200) {
    throw new Error(`Google Sheets append returned status code ${response.status}`);
  }
}

export async function checkSheetsConnection(): Promise<{ connected: boolean; message: string; lastSync: string; rowsSynced: number }> {
  try {
    const settings = await getIntegrationSettings();
    if (!settings.sheets?.enabled || !settings.sheets.spreadsheetId) {
      return { connected: false, message: "Not configured or disabled", lastSync: "Never", rowsSynced: 0 };
    }

    const creds = await resolveGoogleCredentials();
    if (!creds) {
      return { connected: false, message: "Missing Google Service Account credentials", lastSync: "Never", rowsSynced: 0 };
    }

    const auth = new google.auth.JWT({
      email: creds.email,
      key: creds.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    
    await sheets.spreadsheets.get({
      spreadsheetId: settings.sheets.spreadsheetId
    });

    const activitiesRecord = await prisma.appState.findUnique({ where: { key: "runtime_activities" } });
    let rowsSynced = 0;
    let lastSync = "Never";
    if (activitiesRecord && Array.isArray(activitiesRecord.value)) {
      const list = activitiesRecord.value as any[];
      const sheetActs = list.filter((act: any) => act && typeof act === "object" && act.type === "GOOGLE_SHEETS_SYNC");
      rowsSynced = sheetActs.length;
      if (sheetActs.length > 0) {
        const lastAct = sheetActs[sheetActs.length - 1];
        if (lastAct && lastAct.timestamp) {
          lastSync = new Date(String(lastAct.timestamp)).toLocaleTimeString();
        }
      }
    }

    return { connected: true, message: "Connected", lastSync, rowsSynced };
  } catch (err: any) {
    return { connected: false, message: `Authentication Failed: ${err.message || String(err)}`, lastSync: "Never", rowsSynced: 0 };
  }
}

export async function testIntegration(
  type: "webhook" | "slack" | "sheets",
  settings: IntegrationSettings
): Promise<{ success: boolean; message: string }> {
  const payload = {
    type: "TEST",
    message: "GenStack integration working",
    timestamp: new Date().toISOString()
  };

  try {
    if (type === "webhook") {
      const url = settings.webhook?.url;
      if (!url) throw new Error("Webhook URL is empty");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status}: ${detail}`);
      }
      return { success: true, message: "Webhook test successful!" };
    }

    if (type === "slack") {
      const url = settings.slack?.url;
      if (!url) throw new Error("Slack URL is empty");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "GenStack integration working" })
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status}: ${detail}`);
      }
      return { success: true, message: "Slack notification test successful!" };
    }

    if (type === "sheets") {
      const spreadsheetId = settings.sheets?.spreadsheetId;
      if (!spreadsheetId) throw new Error("Spreadsheet ID is empty");
      const sheetName = settings.sheets?.sheetName || "Sheet1";

      const creds = await resolveGoogleCredentials();
      if (!creds) {
        return {
          success: false,
          message: [
            `❌ Credentials Missing`,
            `Missing Google Service Account credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL & GOOGLE_PRIVATE_KEY in .env or place google-sheets-credentials.json at root.`,
            ``,
            `Verify:`,
            `✓ Spreadsheet ID`,
            `✓ Sheet Name`,
            `✗ Credentials`
          ].join("\n")
        };
      }

      try {
        await appendToGoogleSheet(spreadsheetId, sheetName, creds.email, creds.privateKey, {
          test: "TEST",
          message: "GenStack integration working",
          timestamp: new Date().toLocaleString()
        });

        return { success: true, message: "Google Sheets test successful! Appended a test row." };
      } catch (err: any) {
        let credentialsOk = false;
        let spreadsheetIdOk = false;
        let sheetNameOk = false;
        let statusCode = err.status || err.code || 500;
        let errorMessage = err.message || "Unknown error";

        try {
          const auth = new google.auth.JWT({
            email: creds.email,
            key: creds.privateKey,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
          });
          const sheets = google.sheets({ version: "v4", auth });
          await sheets.spreadsheets.get({ spreadsheetId });
          credentialsOk = true;
          spreadsheetIdOk = true;
        } catch (diagErr: any) {
          const diagCode = diagErr.status || diagErr.code || 500;
          if (diagCode === 401 || diagCode === 403 || String(diagErr.message).includes("auth") || String(diagErr.message).includes("credential") || String(diagErr.message).includes("key")) {
            credentialsOk = false;
            spreadsheetIdOk = false;
          } else if (diagCode === 404 || String(diagErr.message).toLowerCase().includes("not found")) {
            credentialsOk = true;
            spreadsheetIdOk = false;
          } else {
            credentialsOk = false;
          }
        }

        if (credentialsOk && spreadsheetIdOk) {
          sheetNameOk = false;
          statusCode = 404;
          errorMessage = `Sheet "${sheetName}" was not found.`;
        }

        const verifyBlock = [
          `Verify:`,
          `${spreadsheetIdOk ? "✓" : "✗"} Spreadsheet ID`,
          `${sheetNameOk ? "✓" : "✗"} Sheet Name`,
          `${credentialsOk ? "✓" : "✗"} Credentials`
        ].join("\n");

        return {
          success: false,
          message: `❌ HTTP ${statusCode}\n${errorMessage}\n\n${verifyBlock}`
        };
      }
    }
    throw new Error("Unknown integration type");
  } catch (err: any) {
    return { success: false, message: err.message || "Unknown error occurred" };
  }
}

export async function triggerIntegrations(
  tableName: string,
  action: "insert" | "update" | "delete",
  record: unknown
): Promise<void> {
  const settings = await getIntegrationSettings();

  const payload = {
    event: `record.${action}`,
    timestamp: new Date().toISOString(),
    tableName,
    record
  };

  // 1. Webhook Integration
  if (settings.webhook?.enabled && settings.webhook.url) {
    const url = settings.webhook.url;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          logger.error({ status: res.status, url, detail }, "Webhook integration failed with non-OK status");
        } else {
          logger.info({ url }, "Webhook integration triggered successfully");
        }
      })
      .catch((error: unknown) => {
        logger.error({ error: error instanceof Error ? error.message : String(error), url }, "Webhook integration request failed");
      });
  }

  // 2. Slack Integration
  if (settings.slack?.enabled && settings.slack.url) {
    const url = settings.slack.url;
    const text = `*GenStack Notification*\n*Event:* \`record.${action}\` on table \`${tableName}\`\n*Payload:*\n\`\`\`${JSON.stringify(record, null, 2)}\`\`\``;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    })
      .then(async (res) => {
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          logger.error({ status: res.status, url, detail }, "Slack webhook failed with non-OK status");
        } else {
          logger.info({ url }, "Slack integration triggered successfully");
        }
      })
      .catch((error: unknown) => {
        logger.error({ error: error instanceof Error ? error.message : String(error), url }, "Slack integration request failed");
      });
  }

  // 3. Google Sheets Integration
  if (settings.sheets?.enabled && settings.sheets.spreadsheetId) {
    const { spreadsheetId, sheetName } = settings.sheets;
    const resolvedName = sheetName || "Sheet1";

    (async () => {
      try {
        const creds = await resolveGoogleCredentials();
        if (!creds) {
          throw new Error("Missing Google Service Account credentials");
        }
        await appendToGoogleSheet(spreadsheetId, resolvedName, creds.email, creds.privateKey, record);
        await addRuntimeActivity("GOOGLE_SHEETS_SYNC", `Successfully synced record update to Google Sheets (Tab: ${resolvedName}).`);
        logger.info({ spreadsheetId, resolvedName }, "Google Sheets row appended successfully");
      } catch (err: any) {
        logger.error({ error: err.message || String(err), spreadsheetId }, "Google Sheets integration failed");
      }
    })();
  }
}
