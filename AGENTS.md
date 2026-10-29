# AGENTS.md: Lulu Paid Ads

Read this file first, then the files in `docs/`. Every dev and every AI tool on this project works from them, so we do not drift apart.

## What we are building

The Paid Ads module of Lulu, a SaaS where a business runs itself. A business plans, launches and measures its paid campaigns on **Google Local Services Ads, Google Ads, Meta Ads and LinkedIn Ads** from one place, with spend controls, approvals and CRM attribution.

We build the UI and the backend for the Paid Ads module only. The other modules (CRM, Online Presence, Accounting, Email, Calendar, Marketplace) are other teams' work.

The design is the MagicPath component "Lulu Paid Ads" (`design/LuluPaidAds.tsx`, from the project "Lulu AI"). It is a clickable prototype with sample data. Use it for how things look and flow. Do not copy its single 490-line file: split it into components.

This repo started from the Lulu CRM repo (Oct 28, 2026): the platform parts (sign-in, workspaces, roles, audit log, outbox events, job queue, i18n, mock mode, Docker, Render and Vercel setup) are the same, so both modules plug into Lulu the same way.

David's functional catalog (360 proposed functions, Oct 29, 2026) is in `docs/reference/`. Read `docs/reference/README.md`: it is guidance for how we build, not this bundle's task list.

## The 15 views

Overview, Campaigns, Planning, Audiences, Creatives, Tracking, Attribution & Data, Reports, Automations, Integrations, Platform Setup, Launch Checklist, Operations, Billing & Controls, Team & Permissions. Each has a route under `/ads/<slug>` (`apps/web/src/config/navigation.ts`). Details are in `docs/plan.md`.

## Order of the ad platforms (Dave, Oct 27, 2026)

1. Google LSA
2. Google Ads
3. Meta Ads
4. LinkedIn Ads

Every view works for all four from the start with sample data. Real connections are built in this order.

## Repository layout

```
apps/web         Next.js frontend
apps/api         TypeScript API (Express)
packages/shared  Zod schemas and types used by both
docs/            plan, data model, API
design/          MagicPath export, reference only, never edit
```

## Stack

TypeScript everywhere. Next.js, an Express API, PostgreSQL with Prisma, Zod, Redis with BullMQ for background jobs, Vitest, Docker. Same as the CRM.

## Rules for every change

1. **No hardcoded text.** Every label, message and error comes from a translation file (i18n). English, German and Chinese from day one. Dates, numbers and money follow the user's language. Adding a language must not need a code change.
2. **Workspace id on every record.** Every table has `workspaceId`, and every query filters by it. The server checks permissions on every request.
3. **Money is a number plus a currency.** Never store `'€4,280'` as text. Rates (CTR, ROAS) are numbers, formatted in the UI. Dates are timestamps. Links between records are ids.
4. **Contract first.** Zod schemas in `packages/shared` and the endpoints in `docs/api.md` come before the screens. If you change one, change the other in the same pull request.
5. **Mock mode.** The web app runs against a mock API with the design's sample data (`apps/web/src/lib/api/mock.ts`, `fixtures.ts`), so the frontend never waits for the backend.
6. **Background jobs.** Pulling data from an ad platform and pushing a change to it run through the queue (`ads.sync`, `ads.push`), never inside a request.
7. **Providers behind one interface.** Every ad platform sits behind the `AdsProvider` interface (`docs/api.md`). A simulated provider answers until we have each platform's developer access. Nothing changes a live campaign or its budget without the user's confirmation, and changes above the approval threshold need an approval.
8. **Secrets.** Read every key and token from environment variables; ad account tokens are stored encrypted. Commit `.env.example` with names only. Never commit `.env`.
9. **Tests.** Add Vitest tests for API endpoints, money and metric calculations, and every provider. Dave has the code reviewed, so no code without tests on the risky parts.

## API response format

Success:

```json
{ "data": { }, "meta": { "page": 1, "pageSize": 25, "total": 120 } }
```

Error:

```json
{ "error": { "code": "CAMPAIGN_NOT_FOUND", "message": "Campaign not found", "details": null } }
```

`message` is a translation key or a code the frontend translates. The server never sends user-facing text in one language only.

## Git rules

- One branch per person and task, named `name/short-task` (for example `abdul/campaigns-page`).
- Never push to `main`.
- Open a pull request when a task is done. One review before merge.
- Do not edit files in `design/`.

## Done for a task

Merged by pull request after one review, works against the mock and the real API, all text comes from translation files, tests pass, and docs are updated.

## Working with AI tools

Read this file and `docs/` before generating code. Stay inside your task. Follow the rules above even when a quicker way exists. Do not invent endpoints or fields: add them to `docs/api.md` and `docs/data-model.md` first. Do not just paste output: Dave has the code reviewed.
