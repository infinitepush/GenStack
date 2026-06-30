# Upgrade & Storage Migration Guide (Release Candidate)

This document provides technical instructions for upgrading to GenStack Release Candidate (RC) and details database, storage, and configuration changes.

## 1. Summary of Changes

* **Database-Backed Scopes**: Workspace history, recent prompts, and generation statistics have been moved out of client-only localStorage and are now persisted in PostgreSQL AppState.
* **Unified Environment Variable Config**: Environment variable naming has been standardized to target Gemini correctly (`GEMINI_API_KEY`, `AI_PROVIDER=gemini`).
* **Cleaned Dead Code**: Diagnostic file `check-db.ts` was permanently deleted.
* **Option A Translation Persistence**: Translation customization modifications are now persisted directly inside the unified `AppConfig` under `translations`.

---

## 2. Storage Migration Details

The Release Candidate introduces automatic, transparent **first-access migrations** from legacy global keys to user-scoped cached keys:

| Legacy Key | Scoped Local Key | Backend Database Suffix |
| :--- | :--- | :--- |
| `genstack.runtime.history` | `genstack.runtime.history.${userId}` | `runtime_history` |
| `genstack.runtime.active` | `genstack.runtime.active.${userId}` | `runtime_active` |
| `genstack.generation.history` | `genstack.generation.history.${userId}` | `generation_history` |
| `genstack:recent-prompts` | `genstack:recent-prompts.${userId}` | `recent_prompts` |

### How It Works:
1. When a user logs in, the client checks if legacy keys exist in localStorage.
2. If the legacy key exists and the scoped key does not, it clones the data under the scoped key and removes the legacy key.
3. The client then synchronizes the local cache with the remote PostgreSQL database.

---

## 3. Environment Key Renaming

Legacy configuration keys have been standardized. Make sure your `.env` and deployment targets are updated:

```diff
- OPENAI_API_KEY="AIzaSyBZO_..."
+ GEMINI_API_KEY="AIzaSyBZO_..."

- AI_PROVIDER="openai"
+ AI_PROVIDER="gemini"
```

> [!NOTE]
> The internal `OpenAiCompatibleProvider` is retained to connect to Gemini via Google's OpenAI-compatible beta endpoint. No changes to the underlying model completion logic were introduced.

---

## 4. Backwards Compatibility

* **Zero Regressions**: Existing users will retain their generated runtime configurations and histories.
* **Automatic Database Seeding**: Missing workspace histories, preferences, or prompts are initialized with standard demo presets on their first database load.
* **Fallback Mode**: If a user is not authenticated or a network failure occurs, the frontend falls back to the safe `_anonymous` scope in localStorage to prevent blocking the user interface.
