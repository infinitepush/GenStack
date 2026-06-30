export interface UserPreferences {
  sidebarCollapsed: boolean;
  preferredLanguage: string;
  defaultExport: "zip" | "github";
  lastRuntime: string | null;
  theme: "dark" | "light" | "system";
}

const PREFS_CACHE_KEY = "genstack.user.preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsed: false,
  preferredLanguage: "en",
  defaultExport: "github",
  lastRuntime: null,
  theme: "dark"
};

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function apiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function getPreferencesLocal(userId: string): UserPreferences {
  if (!storageAvailable()) return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(`${PREFS_CACHE_KEY}.${userId}`);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferencesLocal(userId: string, preferences: Partial<UserPreferences>): void {
  if (!storageAvailable()) return;
  const current = getPreferencesLocal(userId);
  const next = { ...current, ...preferences };
  window.localStorage.setItem(`${PREFS_CACHE_KEY}.${userId}`, JSON.stringify(next));
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const local = getPreferencesLocal(userId);
  try {
    const response = await fetch(`${apiBase()}/user-data/preferences`, { credentials: "include" });
    if (response.ok) {
      const body = await response.json();
      if (body.success && body.data) {
        const remote = body.data as UserPreferences;
        savePreferencesLocal(userId, remote);
        return { ...DEFAULT_PREFERENCES, ...remote };
      }
    }
  } catch (err) {
    console.error("Failed to fetch preferences from server:", err);
  }
  return local;
}

export async function saveUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
  savePreferencesLocal(userId, preferences);
  const updated = getPreferencesLocal(userId);
  try {
    await fetch(`${apiBase()}/user-data/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ value: updated })
    });
  } catch (err) {
    console.error("Failed to save preferences to server:", err);
  }
  return updated;
}
