# Storage Architecture & Database Schemas

This document defines the storage layout, AppState key namespaces, and cache synchronization schemas used in GenStack.

## 1. AppState Key Structure

The `AppState` model acts as a key-value store in PostgreSQL. Keys are strictly namespaced to guarantee multi-tenant workspace isolation:

| Key Suffix | Schema / Payload Type | Purpose | Scoping |
| :--- | :--- | :--- | :--- |
| `active_config` | `AppConfig` (JSON) | Currently active workspace configuration (UI, DB, API schemas) | `user:${userId}:active_config` |
| `config_history` | `Array<ConfigHistoryEntry>` | Complete configuration revision history for restoring older states | `user:${userId}:config_history` |
| `runtime_activities` | `Array<ActivityLog>` | Timeline events of user operations (exports, imports, generations) | `user:${userId}:runtime_activities` |
| `runtime_history` | `Array<RuntimeHistoryEntry>` | Compiled apps that the user has previously generated | `user:${userId}:runtime_history` |
| `generation_history` | `Array<GenerationHistoryEntry>` | Full AI Studio pipeline metrics, intent signals, and repairs | `user:${userId}:generation_history` |
| `recent_prompts` | `Array<string>` | Last 20 unique prompts entered by the user in AI Studio | `user:${userId}:recent_prompts` |
| `preferences` | `UserPreferences` | Settings like theme, language switcher state, and export target | `user:${userId}:preferences` |
| `system:integrations` | `IntegrationSettings` | API keys and Webhook URLs for Slack, Google Sheets, etc. | `user:${userId}:system:integrations` |

---

## 2. GeneratedRecord Database Schema

Dynamic database records generated for AI-compiled workspaces are stored in the `GeneratedRecord` table:

```prisma
model GeneratedRecord {
  id        String   @id @default(cuid())
  userId    String
  appKey    String   // Maps to AppConfig.app.name to associate records with an app
  tableName String   // Name of the compiled virtual table
  data      Json     // Dynamic JSON payload representing the table columns
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([appKey, tableName])
}
```

---

## 3. Caching & Syncing Strategy

1. **Write-Through Caching**:
   - Write operations (e.g., adding a prompt, generating an app) are committed to local memory cache (localStorage) for sub-millisecond frontend response.
   - A fire-and-forget background sync pushes the update immediately to the backend database `/user-data` endpoint.
   
2. **Read-On-Startup Hydration**:
   - When the web client initializes, it requests the database truth.
   - It performs a union-merge on history objects (e.g. keeping the newer `createdAt` timestamp) and updates the local cache.
   - This keeps local caching fast while ensuring data is durable and fully portable across devices.
