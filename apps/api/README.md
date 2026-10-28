# @lulu/api

Express API for the Lulu CRM module. PostgreSQL through Prisma 7 (driver adapter: `pg`) and Redis with BullMQ for background jobs.

## Setup

Fastest: run `npm run docker:up` from the repo root — it builds this API and starts Postgres, Redis, migrations and the seed in one command (see the root `README.md`). For a host run:

1. `npm install` at the repo root.
2. Copy `.env.example` names into `apps/api/.env` and fill real values (needs a reachable PostgreSQL).
3. `npm run db:generate -w @lulu/api` — generates the Prisma client into `src/generated/` (gitignored; `db:migrate` also regenerates).
4. `npm run db:migrate -w @lulu/api` — applies migrations.

## Scripts

| Script                | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Runs `src/server.ts` in watch mode with tsx                          |
| `npm run build`       | Compiles TypeScript to `dist/` (CommonJS)                            |
| `npm start`           | Runs the compiled server (`node dist/server.js`)                     |
| `npm run typecheck`   | Type-checks everything, no emit                                      |
| `npm run lint`        | ESLint (type-checked rules, floating promises, any)                  |
| `npm run format`      | Prettier write                                                       |
| `npm test`            | Vitest run (unit tests, `*.int.test.ts` excluded)                    |
| `npm run test:watch`  | Vitest in watch mode                                                 |
| `npm run test:int`    | Integration tests (`*.int.test.ts`, needs a real database and Redis) |
| `npm run db:migrate`  | `prisma migrate dev` (creates and applies migrations)                |
| `npm run db:deploy`   | `prisma migrate deploy` (applies committed migrations only)          |
| `npm run db:generate` | Regenerates the Prisma client into `src/generated/`                  |
| `npm run db:studio`   | Prisma Studio (database browser)                                     |
| `npm run seed`        | Runs `prisma/seed.ts` (idempotent design sample data)                |

## Folders

| Folder           | Purpose                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/`        | Schema (`schema.prisma`), committed migrations and the idempotent `seed.ts`                                                       |
| `src/config`     | Env loading and parsing (`env.ts` is the only source of config)                                                                   |
| `src/routes`     | Express routers, mounted under `/api/v1` by `routes/index.ts`                                                                     |
| `src/services`   | Business logic used by routes                                                                                                     |
| `src/middleware` | Express middleware (auth, errors, etc.)                                                                                           |
| `src/jobs`       | BullMQ queues (`queues.ts`: import.process, ai.analyze, segments.refresh, notifications.send) and enqueue helpers; no workers yet |
| `src/lib`        | Small shared helpers, including `redis.ts` (`createRedisConnection()` for health ping and queue connections)                      |
| `src/db`         | Prisma client (`prisma.ts`) and workspace-scoped client (`scoped.ts`)                                                             |
| `src/generated`  | Generated Prisma client, gitignored, rebuilt by `db:generate`                                                                     |

## Conventions

- Never read `process.env` outside `src/config/env.ts`; import `env` from there.
- **All application queries go through `scopedDb(workspaceId)`** (`src/db/scoped.ts`) — it enforces workspace scoping and soft delete. The base client (`src/db/prisma.ts`) is only for the `Workspace` table, migrations, and infrastructure. To scope a new model, add its delegate name to `SCOPED_MODELS` in `src/db/scoped.ts`.
- Health endpoints: `GET /health`, `GET /api/v1/health` return `{ data: { status: 'ok'|'degraded', checks: { database: 'ok'|'down', redis: 'ok'|'down' } } }`; `GET /health/live` returns `{ data: { status: 'ok' } }` without touching dependencies.

- Unit-test env vars are injected by `vitest.config.mts` (`test.env`); unit tests need no `.env`. Integration tests (`test:int`) read `DATABASE_URL` from `.env` and need a migrated database and a reachable Redis.
