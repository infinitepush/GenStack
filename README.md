# GenStack

GenStack is a config-driven AI app generator runtime. A normalized JSON config describes the app shell, auth methods,
database tables, API endpoints, and UI pages. Runtime layers consume only the normalized `AppConfig`.

## Architecture

```text
JSON config
   |
   v
ConfigEngine + Zod schemas
   |
   +--> Next.js app shell and auth middleware
   +--> Express API runtime
   +--> Prisma schema and migration engine
   +--> Dynamic component registry

Natural language prompt
   |
   v
AI provider -> JSON parser/repair -> ConfigEngine -> semantic repair -> evaluator
   |
   +--> /ai/generate API response
   +--> AI Studio config editor
```

## Phase 1 Status

- npm workspaces monorepo
- shared `@genstack/config-types` package
- crash-safe `ConfigEngine` with defaults, warnings, and tests
- Prisma PostgreSQL schema for NextAuth and runtime records
- Express API shell with pino logging and consistent response shape
- Next.js 14 App Router shell with config-driven auth provider wiring

## Phase 2 Status

- Provider-agnostic AI pipeline engine in `apps/api/src/engine`
- Deterministic local provider for offline development and repeatable tests
- Optional OpenAI-compatible HTTP provider via `AI_PROVIDER=openai`, `AI_API_KEY` or `OPENAI_API_KEY`
- Broken JSON extraction and repair using `jsonrepair`
- Config validation and semantic repair for endpoints, fields, auth methods, and component references
- Evaluation framework with scored metrics, blockers, grades, and recommendations
- Express routes: `GET /ai/capabilities`, `POST /ai/generate`, `POST /ai/repair`, `POST /ai/evaluate`
- Frontend AI Studio at `/{locale}/ai`

## Running Locally

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` and `NEXTAUTH_SECRET`.
3. Run `npm install`.
4. Run `npm run prisma:generate`.
5. Run `npm run dev:web` or `npm run dev:api`.

## Adding A Component Type

1. Add the renderer under `apps/web/components/registry`.
2. Add its key to the registry map.
3. Add a config node with that `type` to `config.ui.pages[].components`.
4. Unknown component types are intentionally preserved by the config engine so the UI can render a visible fallback.

## Writing A New Config

Create a JSON file with `app`, `auth`, `database`, `ui`, and `api` blocks. Missing blocks are defaulted safely by
`ConfigEngine`; duplicate routes keep the last page and emit a warning. Deploy the frontend to Vercel and the API plus
PostgreSQL database to Railway.
