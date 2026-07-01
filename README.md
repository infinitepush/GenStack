<div align="center">

# GenStack

**Turn a plain English description into a running full-stack business application.**

GenStack is a configuration-driven application generation platform. Describe what you need, and the AI pipeline produces a validated `AppConfig` that a runtime engine immediately renders as a working application — complete with database-backed CRUD, analytics, authentication, and integrations.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Express.js-Backend-000000?logo=express&logoColor=white)](https://expressjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![Neon](https://img.shields.io/badge/Neon-PostgreSQL-00E5BF?logo=postgresql&logoColor=white)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Render](https://img.shields.io/badge/Render-Backend-46E3B7?logo=render&logoColor=white)](https://render.com)

</div>

---

## Table of Contents

- [What is GenStack?](#what-is-genstack)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Storage Architecture](#storage-architecture)
- [Authentication & Workspace Isolation](#authentication--workspace-isolation)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Models](#database-models)
- [Feature Status](#feature-status)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## What is GenStack?

GenStack converts a natural language description like `"An inventory tracker for a hardware store with item name, quantity, category, and restock threshold"` into a fully operational internal application:

- **Database tables** with typed fields are auto-created
- **CRUD pages** render dynamically without writing a single component
- **REST endpoints** are generated and served from the backend in real-time
- **Dashboard and analytics pages** are composed from the configuration
- **Translations** are automatically generated for all configured locales

The configuration (`AppConfig`) is the single source of truth. The entire application — UI, API, database schema, i18n — derives from it.

---

## Core Features

### AI Studio
- Generate `AppConfig` from a natural language prompt via Google Gemini
- Automatic fallback to a local heuristic provider when the API rate-limits
- Post-generation validation and automatic repair pipeline
- Evaluation scoring: prompt coverage, validation grade (A–F), repair action count
- Generation history with per-entry metrics stored across sessions
- Recent prompts list (last 20, synced to database)

### Runtime Engine
- Dynamic routing via `[...runtime]` catch-all with path matching against the active config
- Pages composed from component types: `table`, `form`, `stat_card`, `chart`
- Full CRUD against `GeneratedRecord` — create, list, update, delete — all user-scoped
- Config changes take effect immediately without a server restart

### Configuration System
- Live Monaco-editor-based JSON config editor
- Config validation and normalization via Zod schemas (`@genstack/config-types`)
- Full version history stored in PostgreSQL (`AppState`), with one-click restore
- Diff engine shows field-level changes between config versions
- Config Reviewer: side-by-side diff view between generated and active config

### Analytics
- Dedicated analytics pages rendered from `chart` components in the config
- Chart types: bar, line, pie (via Recharts)
- Aggregations: `sum`, `count`, `avg` — computed at query time from `GeneratedRecord`

### Runtime Summary
- Aggregated view of system events: config applied, CSV imported, generation completed, etc.
- Activity feed sourced from the backend `runtime/activities` endpoint
- Per-user, persisted to PostgreSQL

### Translation Manager
- Generates i18n message files from the active `AppConfig` automatically
- Supports multiple locales (e.g. `en`, `hi`)
- Custom translation overrides stored inside the `AppConfig` under `translations`
- Edits persist across logins via the config itself

### Export System
- **GitHub Export**: Scaffolds a complete Next.js + Express project and pushes it to a new GitHub repository using a personal access token. Runs as an async job with status polling.
- **ZIP Export**: Generates the same project structure as a downloadable `.zip` archive
- **JSON Export**: Direct download of the raw `AppConfig` JSON

### CSV Import
- Upload a `.csv` file (up to 5 MB)
- Field mapping UI: map CSV columns to config-defined table fields
- Preview mapped rows before committing
- Bulk-ingest into `GeneratedRecord` for the target table

### Integrations
- **Webhook**: POST runtime activity events to a custom HTTP endpoint
- **Slack**: Send notifications to a Slack incoming webhook URL
- **Google Sheets**: Connect via Google Service Account credentials, read/write data to a spreadsheet
- Per-user integration settings persisted to PostgreSQL

### Authentication
- Email + password credentials with bcrypt password hashing
- GitHub OAuth via NextAuth
- JWT session strategy (cookies, no database sessions)
- Protected routes enforced by Next.js middleware

### Workspace Isolation
- Every database query (config, records, integrations, activities) is scoped to `userId`
- localStorage keys are prefixed with `userId` to prevent data leakage on shared browsers
- Anonymous fallback scope (`_anonymous`) for unauthenticated access

---

## Architecture

### System Flow

```
Browser
  │
  ▼
Next.js (Vercel)
  │  – Serves the frontend application
  │  – Enforces auth via middleware
  │  – Proxies /api/backend/* to Express
  │
  ▼
NextAuth
  │  – Validates JWT session cookie
  │  – Attaches userId to each request
  │
  ▼
Express API (Render)
  │  – auth-middleware extracts userId from JWT
  │  – Scopes every query to that userId
  │
  ▼
Prisma ORM
  │
  ▼
Neon PostgreSQL
```

### AI Generation Pipeline

```
Natural Language Prompt
  │
  ▼
PipelineEngine (pipeline-engine.ts)
  │  – Calls Google Gemini via OpenAI-compatible endpoint
  │  – Falls back to LocalHeuristicProvider on rate-limit (429)
  │
  ▼
RepairEngine (repair-engine.ts)
  │  – Parses raw model output
  │  – Validates against Zod AppConfig schema
  │  – Auto-repairs common issues
  │
  ▼
EvaluationEngine (evaluation-engine.ts)
  │  – Scores prompt coverage, validation, repair actions
  │  – Assigns grade A–F
  │
  ▼
AppConfig
  │
  ▼
Runtime Engine → Generated Application
```

---

## Storage Architecture

GenStack uses a three-layer storage model:

### PostgreSQL — AppState

A key-value store in Postgres. All keys are user-scoped:

| Key Pattern | Contents |
|---|---|
| `user:{id}:active_config` | Currently active `AppConfig` |
| `user:{id}:config_history` | Array of config revisions with diffs |
| `user:{id}:runtime_activities` | Timeline of system events |
| `user:{id}:runtime_history` | Previously generated app configs |
| `user:{id}:generation_history` | AI Studio pipeline results with metrics |
| `user:{id}:recent_prompts` | Last 20 prompts entered by the user |
| `user:{id}:preferences` | UI preferences (theme, language, etc.) |
| `user:{id}:system:integrations` | Webhook / Slack / Google Sheets settings |

### PostgreSQL — GeneratedRecord

Stores all dynamic data created through runtime CRUD operations. Every record is associated with:
- `userId` — ensures cross-user isolation
- `appKey` — ties records to a specific generated application
- `tableName` — the config-defined table the record belongs to
- `data` — the JSON payload matching the table's field schema

### Browser localStorage (Cache Layer)

Used as an immediate rendering cache to avoid loading spinners. Data is synced to and from the database on app startup and on every write. Keys are always prefixed with `userId`.

---

## Authentication & Workspace Isolation

### How Authentication Works

1. User signs in via email/password or GitHub OAuth through NextAuth
2. NextAuth creates a signed JWT stored as an HTTP-only session cookie
3. Every request to the Express backend carries this cookie
4. The `authMiddleware` decodes the JWT and attaches `request.userId`
5. All database queries and in-memory config state is keyed by `userId`

### Prisma Models and Auth Strategy

The session strategy is `jwt`. The `Session` and `VerificationToken` Prisma models are retained in the schema to satisfy the NextAuth PrismaAdapter initializer but are not actively queried at runtime.

| Model | Status | Purpose |
|---|---|---|
| `User` | Active | Stores user identity, email, image, password hash |
| `Account` | Active | Links GitHub OAuth provider tokens to a User |
| `Session` | Schema-only | Present for adapter compatibility; JWT strategy is used |
| `VerificationToken` | Schema-only | Present for adapter compatibility; not queried |

---

## Project Structure

```
GenStack/
├── apps/
│   ├── api/                    # Express backend
│   │   └── src/
│   │       ├── engine/         # AI pipeline, CRUD, export, integrations
│   │       ├── lib/            # Config store, auth middleware, logger, Prisma
│   │       ├── routes/         # Express route handlers
│   │       └── server.ts       # App entry point, route registration
│   └── web/                    # Next.js frontend
│       ├── app/
│       │   ├── [locale]/       # All locale-aware pages
│       │   │   ├── [...runtime]/   # Dynamic runtime renderer
│       │   │   ├── ai/             # AI Studio
│       │   │   ├── analytics/      # Analytics dashboard
│       │   │   ├── config/         # Config editor + reviewer
│       │   │   ├── export/         # Export manager
│       │   │   ├── import/         # CSV import
│       │   │   ├── integrations/   # Webhook / Slack / Sheets
│       │   │   ├── reviewer/       # Config diff viewer
│       │   │   ├── summary/        # Runtime activity summary
│       │   │   └── translations/   # Translation manager
│       │   └── api/            # NextAuth route handler
│       ├── components/
│       │   ├── ai/             # AiStudio component
│       │   ├── shell/          # Sidebar, layout wrapper
│       │   ├── registry/       # Dynamic component registry
│       │   └── ui/             # Shared UI primitives
│       └── lib/                # Auth, runtime history, generation history, preferences
├── packages/
│   └── config-types/           # Shared Zod schemas and TypeScript types (AppConfig)
├── prisma/
│   └── schema.prisma           # Database schema
├── ARCHITECTURE.md
├── STORAGE.md
├── MIGRATION.md
└── package.json                # Monorepo root (npm workspaces)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router) |
| **UI Language** | TypeScript + React 18 |
| **Styling** | Tailwind CSS |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **Code Editor** | Monaco Editor |
| **Authentication** | NextAuth.js v4 |
| **Backend Framework** | Express.js |
| **ORM** | Prisma v5 |
| **Database** | PostgreSQL (Neon) |
| **Schema Validation** | Zod |
| **AI Provider** | Google Gemini (OpenAI-compatible endpoint) |
| **File Upload** | Multer |
| **Logging** | Pino |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- A PostgreSQL database (local or [Neon](https://neon.tech))
- A Google Gemini API key

### 1. Clone

```bash
git clone https://github.com/infinitepush/GenStack.git
cd GenStack
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) for a full description of each variable.

### 4. Set Up the Database

Push the schema to your PostgreSQL database:

```bash
npx prisma db push
```

### 5. Run Locally

Start the Express API:

```bash
npm run dev:api
```

Start the Next.js frontend (in a second terminal):

```bash
npm run dev:web
```

The frontend runs on `http://localhost:3001` and the API on `http://localhost:4000` by default.

---

## Environment Variables

All variables are required unless marked optional.

### Root / Web (`/.env`)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `NEXTAUTH_SECRET` | Random secret for signing JWTs | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of the frontend | `http://localhost:3001` |
| `NEXT_PUBLIC_API_URL` | Public URL of the Express API | `http://localhost:4000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | *(optional — enables GitHub login)* |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | *(optional — enables GitHub login)* |
| `AI_PROVIDER` | AI provider identifier | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSy...` |
| `AI_MODEL` | Model name to use | `gemini-2.5-flash` |
| `AI_BASE_URL` | OpenAI-compatible endpoint base URL | `https://generativelanguage.googleapis.com/v1beta/openai/` |

### API (`/apps/api/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Must match the frontend secret exactly |
| `API_PORT` | Port the Express server listens on (default: `4000`) |
| `WEB_ORIGINS` | Comma-separated list of allowed CORS origins |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `AI_MODEL` | Model name |
| `AI_BASE_URL` | OpenAI-compatible endpoint base URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *(optional)* For Google Sheets integration |
| `GOOGLE_PRIVATE_KEY` | *(optional)* For Google Sheets integration |

---

## API Reference

All endpoints are prefixed with `/api/backend` when called from the frontend proxy.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns database and AI provider status |

### Configuration

| Method | Path | Description |
|---|---|---|
| `GET` | `/config` | Get the active config for the current user |
| `POST` | `/config` | Apply a new config (records a versioned history entry) |
| `POST` | `/config/reset` | Reset config to the demo baseline |
| `GET` | `/config/history` | List all config versions for the current user |
| `POST` | `/config/restore` | Restore a specific config version by number |

### Runtime Activities

| Method | Path | Description |
|---|---|---|
| `GET` | `/runtime/activities` | List all system activity events for the current user |
| `POST` | `/runtime/activity` | Log a custom activity event |

### AI Pipeline

| Method | Path | Description |
|---|---|---|
| `GET` | `/ai/capabilities` | Returns the active provider name and model |
| `POST` | `/ai/generate` | Generate an `AppConfig` from a prompt |
| `POST` | `/ai/repair` | Validate and auto-repair a raw config object |
| `POST` | `/ai/evaluate` | Score a config against a prompt (returns grade and metrics) |

### Dynamic CRUD (`/runtime/*`)

These routes are generated from the active config's `api.endpoints` array:

| Method | Pattern | Description |
|---|---|---|
| `GET` | `/runtime/{path}` | List records from a config-defined table |
| `POST` | `/runtime/{path}` | Create a new record |
| `PUT` | `/runtime/{path}/:id` | Update an existing record by ID |
| `DELETE` | `/runtime/{path}/:id` | Delete a record by ID |

### Import (CSV)

| Method | Path | Description |
|---|---|---|
| `POST` | `/import/upload` | Upload a CSV file (max 5 MB), returns `uploadId` |
| `POST` | `/import/map` | Preview field mapping before ingestion |
| `POST` | `/import/ingest` | Commit mapped rows to `GeneratedRecord` |

### Export

| Method | Path | Description |
|---|---|---|
| `POST` | `/export/github` | Start an async GitHub repository export job |
| `GET` | `/export/status/:id` | Poll the status of an export job |
| `POST` | `/export/zip` | Generate and download a ZIP archive |

### Integrations

| Method | Path | Description |
|---|---|---|
| `GET` | `/integrations` | Get integration settings for the current user |
| `POST` | `/integrations` | Save integration settings |
| `POST` | `/integrations/test` | Test a specific integration (webhook, slack, sheets) |
| `GET` | `/integrations/sheets/status` | Check Google Sheets connection status |

### Internationalization

| Method | Path | Description |
|---|---|---|
| `POST` | `/i18n/generate` | Generate i18n message files from a config |

### User Data

| Method | Path | Description |
|---|---|---|
| `GET` | `/user-data/:key` | Read a user-scoped value from AppState |
| `POST` | `/user-data/:key` | Write a user-scoped value to AppState |

---

## Database Models

```
User
  ├── id, email, name, image
  ├── passwordHash         — bcrypt hash for credentials login
  ├── accounts[]           — linked OAuth providers (e.g. GitHub)
  └── records[]            → GeneratedRecord

Account
  └── Stores OAuth tokens from GitHub; linked to User

Session
  └── Present in schema for NextAuth adapter; not queried at runtime (JWT strategy is used)

VerificationToken
  └── Present in schema for NextAuth adapter; not queried at runtime

AppState
  ├── key    — namespaced string (e.g. user:{id}:active_config)
  └── value  — JSON blob (config, history array, preferences, integration settings)

GeneratedRecord
  ├── appKey     — name of the generated application
  ├── tableName  — config-defined table (e.g. "expenses")
  ├── data       — JSON row matching the table's field schema
  └── userId     — foreign key; all queries are user-scoped
```

---

## Feature Status

| Feature | Status |
|---|---|
| AI Application Generation | ✅ Implemented |
| Local Heuristic Fallback Provider | ✅ Implemented |
| Config Validation & Repair | ✅ Implemented |
| Config Evaluation & Grading | ✅ Implemented |
| Dynamic Routing & Page Rendering | ✅ Implemented |
| Dynamic CRUD (list, create, update, delete) | ✅ Implemented |
| Analytics (charts, aggregations) | ✅ Implemented |
| Runtime Activity Summary | ✅ Implemented |
| Config Version History & Restore | ✅ Implemented |
| Config Reviewer (Diff View) | ✅ Implemented |
| Translation Manager | ✅ Implemented |
| Translation Overrides Persisted in Config | ✅ Implemented |
| GitHub Repository Export | ✅ Implemented |
| ZIP Export | ✅ Implemented |
| CSV Import with Field Mapping | ✅ Implemented |
| Webhook Integration | ✅ Implemented |
| Slack Integration | ✅ Implemented |
| Google Sheets Integration | ✅ Implemented |
| Email + Password Authentication | ✅ Implemented |
| GitHub OAuth | ✅ Implemented |
| Per-User Workspace Isolation | ✅ Implemented |
| Runtime History (synced to PostgreSQL) | ✅ Implemented |
| Generation History (synced to PostgreSQL) | ✅ Implemented |
| User Preferences (synced to PostgreSQL) | ✅ Implemented |
| Runtime Theme Builder | 🔲 Planned |
| Plugin SDK | 🔲 Planned |
| Docker Export | 🔲 Planned |
| Multi-tenant Team Workspaces | 🔲 Idea |
| Workflow Automation | 🔲 Idea |

---

## Deployment

### Frontend → Vercel

1. Import the repository in Vercel
2. Set the root directory to `apps/web`
3. Add all frontend environment variables (see [Environment Variables](#environment-variables))
4. Deploy

### Backend → Render

1. Create a new **Web Service** in Render
2. Set the root directory to `apps/api`
3. Build command: `npm run build --workspace @genstack/config-types && tsc -p tsconfig.json`
4. Start command: `node dist/server.js`
5. Add all API environment variables
6. Ensure `WEB_ORIGINS` includes your Vercel deployment URL

### Database → Neon PostgreSQL

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string into `DATABASE_URL`
3. Run `npx prisma db push` to push the schema

---

## Roadmap

### Completed
- AI application generation with validation, repair, and evaluation
- Full configuration-driven runtime engine
- Database-backed multi-tenant workspace isolation
- GitHub and ZIP export
- CSV import with field mapping
- Webhook, Slack, and Google Sheets integrations
- Translation manager with per-config override storage
- Config version history with diff viewer
- PostgreSQL-backed runtime and generation history

### Planned
- Docker export (generate a Docker-ready project)
- Plugin SDK for custom component types

### Ideas
- Multi-tenant team workspaces with shared configs
- Visual drag-and-drop config builder (no JSON required)
- Workflow automation (trigger webhooks on record events)
- Template marketplace for common app types

---

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System flow diagrams and pipeline architecture
- [STORAGE.md](./STORAGE.md) — AppState key namespaces, caching strategy
- [MIGRATION.md](./MIGRATION.md) — Legacy storage migration and environment rename guide

---

<div align="center">

Built with Next.js, Express, Prisma, and Google Gemini

</div>
