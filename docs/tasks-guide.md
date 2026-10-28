# Task details: Lulu Paid Ads

The reference for every task on the board (`tasks.md`): what to build, what it covers in the design, and when it is done. Read `AGENTS.md`, `docs/plan.md`, `docs/data-model.md` and `docs/api.md` first.

Team: **Sudais** (PM), **Abdul** (Samteck), **Franklin**, **theLady**.

Every task:

- One branch (`name/task`, e.g. `franklin/database`), one pull request, one review before merge.
- No hardcoded text: every label in `apps/web/messages/en.json`, `de.json` and `zh.json`.
- `workspaceId` on every table and query; money as amount + currency; rates as numbers.
- Tests on the risky parts. `npm run check` passes before you ask for review.
- If you need a field or endpoint that is not in the docs, add it to `docs/data-model.md` / `docs/api.md` in the same PR.

The design is `design/LuluPaidAds.tsx` (MagicPath "Lulu Paid Ads"). Never edit it; split what you need into components under `apps/web/src/features/<area>/`.

---

## Phase 0: foundation

### PM: organisation (Sudais)

Repo, invites, branch protection, this board, a daily status in the group, and updates to David.

### P0: repo from the CRM base (Sudais), done

Platform kept from the CRM (sign-in, workspaces, roles, audit log, outbox, queue, i18n, mock mode, Docker, Render/Vercel), CRM features removed, 15 view routes with placeholders, translations, docs.

### P1: contract (Sudais), first, everyone waits for it

- **Build:** Zod schemas in `packages/shared/src/` for every table in `docs/data-model.md` (ad account, campaign, metric day, plan step, audience, creative, conversion event, automation rule, spend limit, approval policy, approval request, report, sync run), plus the create/update inputs and list queries from `docs/api.md`.
- **Shared maths** in `packages/shared/src/metrics.ts`: CTR, CPL, ROAS, progress (spend ÷ budget), totals from metric days, in whole cents. With tests.
- **Sample data** from the design in `apps/web/src/lib/api/fixtures.ts`: the 4 campaigns (Spring launch · Berlin, Local service calls, Studio awareness, B2B pipeline · Q4) with their metrics, plan steps and assets; the 4 platform cards; audiences, creatives, rules and team from the other views.
- **Done when:** schemas and fixtures merged, `docs/data-model.md` matches them, shared tests pass.

### B1: database (Franklin), waits for P1

- **Build:** the Prisma tables and enums from `docs/data-model.md` in `apps/api/prisma/schema.prisma`, one migration, indexes as listed. Add each new model to `AUDITED_ENTITIES` in `apps/api/src/db/audit.ts`.
- **Seed:** the design's sample data in `apps/api/prisma/seed.ts` with fixed ids in `seed-ids.ts` (same numbers as the web fixtures).
- **Done when:** `prisma migrate deploy` and `npm run seed` work on an empty database, the seed runs twice without duplicates, and the integration tests pass.

### B2: Campaigns and Overview API (Franklin), waits for B1

- **Endpoints** (`docs/api.md`): `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `POST /campaigns/:id/launch|pause|resume`, `GET /campaigns/:id/checklist`, `GET/PUT /campaigns/:id/plan`, `GET /overview`.
- **Rules:** list totals and Overview KPIs come from `CampaignMetricDay` using the P1 maths; "vs. last month" compares the same number of days. A budget change above the approval threshold returns `202` with an `ApprovalRequest`. Launch, pause and resume only queue `ads.push`.
- **Done when:** every endpoint is in `docs/api.md` and the OpenAPI paths, with integration tests (including another workspace getting 404).

### B3: Audiences, Creatives, Tracking, Attribution API (theLady), waits for B1

- **Endpoints:** `/audiences` (+ `/sync`), `/creatives` (+ upload, `/approve`), `/conversion-events`, `GET /tracking/health`, `GET /attribution`.
- **Rules:** creative upload by `multipart/form-data`, size and type checked; approve needs `creatives.approve`. Attribution reads CRM outcomes (`crm.*` events) and conversion events.
- **Done when:** endpoints documented and tested, permissions checked.

### B4: Reports, Automations, Billing, Operations, Team API (theLady), waits for B1

- **Endpoints:** `/reports` (+ `/run`), `/automations`, `/spend-limit`, `/approval-policy`, `/approvals` (+ approve / reject), `/operations`, `/settings/permissions`.
- **Rules:** an automation that changes budget creates an approval request instead of acting. Approve / reject needs `billing.approve`, and a person cannot approve their own request.
- **Done when:** endpoints documented and tested.

### F1: app shell, Overview, Campaigns (Abdul), waits for P1 (shell can start now)

- **Shell** (`apps/web/src/components/layout/`): rail, top bar ("Lulu / Paid Ads / <view>"), page heading with "View insights" and "+ Create campaign", toasts, matching the design on desktop and phone.
- **Overview** (`/ads/overview`): KPI cards with sparklines, platform cards, campaign table.
- **Campaigns** (`/ads/campaigns`): summary cards, table with platform filter (All / Google Ads / Meta Ads / …), campaign drawer (objective, audience, schedule, metrics, plan timeline, assets, rationale, next step, pause/resume with confirmation).
- **Create campaign pop-up:** channel, name, objective, budget, schedule; saves a draft.
- **Done when:** matches the design in mock mode, in en/de/zh, at phone width, with tests for the table filter, the drawer and the create pop-up.

### F2: Planning, Audiences, Creatives, Reports (Abdul), waits for F1

- **Planning:** KPI cards, spend per platform bars, planning steps timeline, scenario pop-up.
- **Audiences:** audience cards, Create audience pop-up.
- **Creatives:** creative grid, variant results, Add creative pop-up (upload).
- **Reports:** date range, filters, KPIs, saved reports, Schedule report and custom report pop-ups.
- **Done when:** as F1.

### F3: Tracking, Attribution & Data, Automations, Integrations, Platform Setup (Sudais), waits for P1

- **Tracking:** health cards, events today, event list.
- **Attribution & Data:** data quality, revenue by platform, event mapping table, Add event pop-up.
- **Automations:** rule cards, Create rule pop-up (trigger, condition, action; budget actions need approval).
- **Integrations:** one card per platform with connection, permissions, last sync; Connect provider pop-up.
- **Platform Setup:** per-platform settings cards.
- **Done when:** as F1.

### F4: Launch Checklist, Operations, Billing & Controls, Team & Permissions (Sudais), waits for F3

- **Launch Checklist:** score (e.g. 8 / 10) and the checks list.
- **Operations:** sync health, jobs processed, needs attention, sync history.
- **Billing & Controls:** spend limit bar, approval threshold, payment methods, with their pop-ups.
- **Team & Permissions:** members, roles, Invite teammate pop-up.
- **Done when:** as F1.

---

## Phases 1–4: the ad platforms (David's order)

Each phase is merged, deployed and shown to David on its own.

### C0: provider layer (Franklin), waits for B2

- `AdsProvider` interface and `SimulatedProvider` in `apps/api/src/providers/` (`docs/api.md`), chosen per platform by `ADS_PROVIDER_<PLATFORM>=simulated|live`.
- OAuth connect flow: `POST /ad-accounts/connect`, `GET /ad-accounts/callback/:platform`, `GET /ad-accounts`, `POST /ad-accounts/:id/sync`, `DELETE /ad-accounts/:id`. Tokens stored encrypted (key from env).
- Workers for `ads.sync` (on connect, on demand, every 6 hours) and `ads.push` in `apps/api/src/jobs/workers.ts`, each writing a `SyncRun`.
- **Done when:** a simulated account connects, syncs and fills the Overview, with tests for the workers and token encryption.

### C1: Google LSA (Franklin), waits for C0 and David's Google Ads developer token

Local Services through the Google Ads API: leads, calls, spend, budget, pause/resume. Tested against the simulated provider's contract.

### C2: Google Ads (Franklin), waits for C1

Search, Display and YouTube campaigns, metrics, status and budget changes.

### C3: Meta Ads (theLady), waits for C0 and David's Meta app

Meta Marketing API: campaigns, metrics, audiences, creatives.

### C4: LinkedIn Ads (Sudais), waits for C0 and David's LinkedIn access

LinkedIn Marketing API: campaigns, metrics, lead gen forms.

### R: release each phase (Sudais)

Deploy (Vercel + Render), test with David, collect and fix his review.
