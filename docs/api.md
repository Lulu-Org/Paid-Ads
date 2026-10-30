# API: Lulu Paid Ads

Base path `/api/v1`. Request and response shapes are the Zod schemas in `packages/shared/src/` (`campaign.ts`, `library.ts`, `controls.ts`, `metrics.ts`); money travels as `{ amount, currency }`. JSON in and out, in the format from `AGENTS.md`. Every route except `POST /auth/login` and `GET /health` needs a bearer token, and every route checks the role's permission (`packages/shared/src/permissions.ts`). Lists take `page`, `pageSize` (max 100), `sort` (`field` or `-field`) and `q`.

## Platform (done, same as the CRM)

| Method | Path | What |
| --- | --- | --- |
| GET | `/health` | API, database and Redis status |
| POST | `/auth/login` | Email + password, returns a token |
| POST | `/auth/logout` | Ends the token |
| GET | `/me` | The signed-in user |
| GET | `/users` | People in the workspace |
| GET | `/audit-log` | Who changed what (owners and admins) |
| GET | `/manifest.json` | The bundle manifest for the Lulu platform |

## Ad accounts and providers

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET | `/ad-accounts` | Connected accounts with status and last sync | integrations.view |
| POST | `/ad-accounts/connect` | `{ platform }` → `{ authorizeUrl }` to start OAuth | integrations.create |
| GET | `/ad-accounts/callback/:platform` | OAuth return; stores the encrypted token, queues the first sync | (state check) |
| POST | `/ad-accounts/:id/sync` | Queues `ads.sync` now, returns the `SyncRun` | integrations.edit |
| DELETE | `/ad-accounts/:id` | Disconnects (revokes the token) | integrations.delete |

**`AdsProvider` interface** (`apps/api/src/providers/`), one implementation per platform plus `SimulatedProvider`, which returns the design's sample data. `ADS_PROVIDER_<PLATFORM>=simulated|live` chooses per platform.

```ts
interface AdsProvider {
  platform: AdPlatform;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ token: string; expiresAt: Date | null; accounts: ExternalAccount[] }>;
  listCampaigns(account: AdAccount): Promise<ExternalCampaign[]>;
  metrics(account: AdAccount, from: Date, to: Date): Promise<ExternalMetricDay[]>;
  pushCampaign(account: AdAccount, campaign: Campaign): Promise<{ externalId: string }>;
  setStatus(account: AdAccount, externalId: string, status: "live" | "paused"): Promise<void>;
  setBudget(account: AdAccount, externalId: string, budget: Money): Promise<void>;
}
```

## Campaigns

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET | `/campaigns` | List with totals (spend, leads, CPL, progress = spend ÷ budget). Filters `platform`, `status`; `q` matches name or objective; sort `name` (default), `createdAt`, `startAt` or `budget`, with `-` for descending | campaigns.view |
| POST | `/campaigns` | Create a draft; the owner defaults to the current user and an `adAccountId` must exist in the workspace and match the platform | campaigns.create |
| GET | `/campaigns/:id` | Detail: metrics, plan steps, creatives, rationale, next step | campaigns.view |
| PATCH | `/campaigns/:id` | Edit a draft or its details. A budget change whose absolute amount is above the policy threshold holds the whole PATCH: the campaign is unchanged and the response is `202` with the open `budget_change` `ApprovalRequest` | campaigns.edit |
| POST | `/campaigns/:id/launch` | Runs the launch checklist. A required approval returns `202` with the open `launch` `ApprovalRequest` and keeps the campaign in draft; a failed checklist returns `409` with it in `details`; on success the status becomes `live`, then `ads.push` is queued | campaigns.edit (+ approval if required) |
| POST | `/campaigns/:id/pause`, `/resume` | Only `live → paused` and `paused → live`; the status changes locally, then `ads.push` is queued. Any other status returns `409` | campaigns.edit |
| GET | `/campaigns/:id/checklist` | The launch checklist items and which pass | campaigns.view |
| GET/PUT | `/campaigns/:id/plan` | `{ steps: [...] }`, ordered; PUT replaces all active steps (at most 20) | campaigns.view / edit |

## Overview, planning and reports

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET | `/overview` | KPIs (spend, attributed revenue, leads, CPL, ROAS with change vs. the preceding range of the same length and a daily trend), spend by platform. Built by `buildOverview` (`packages/shared/src/overview-logic.ts`). The range ends on `endDate`, the newest day with synced metrics, so an old last sync still shows numbers. Query `rangeDays` (1–366, default 30) | campaigns.view |
| GET | `/planning` | The month's `BudgetPlan` with what `buildPlanning` (`packages/shared/src/planning-logic.ts`) computes: allocated against the monthly spend limit, share per channel, target leads, forecast leads and revenue from each channel's last 30 days (`planningSchema`) | budgets.view |
| POST | `/planning/scenarios` | Saves a draft scenario with other channel amounts (`planScenarioCreateSchema`); returns the `planningSchema` for it | budgets.edit |
| GET/POST | `/reports`, GET/PATCH/DELETE `/reports/:id` | Saved and scheduled reports | reports.* |
| GET | `/reports/:id/run` | The report's numbers for a date range | reports.view |
| GET | `/reports/run` | Ad hoc numbers: `from`, `to` (dates), `platforms` (comma separated, empty = all). KPIs with change vs. the period before, and spend, leads, conversions, revenue and ROAS per channel (`reportRunSchema`, built by `buildReport`) | reports.view |

## Audiences, creatives, tracking

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET/POST | `/audiences`, GET/PATCH/DELETE `/audiences/:id` | Audience library. The list returns `audienceListItemSchema`: description, match rate, exclusions, campaign count, `syncing` | audiences.* |
| POST | `/audiences/:id/sync` | Queues the audience sync to its platforms | audiences.edit |
| GET/POST | `/creatives`, GET/PATCH/DELETE `/creatives/:id` | Creative library (upload via `multipart/form-data`: `file`, plus `name` and `type`). The list returns `creativeListItemSchema`: campaign count and `winning` | creatives.* |
| GET | `/creative-tests` | Campaigns running two or more creative variants, with spend, leads and CPL per variant (`creativeTestSchema`) | creatives.view |
| POST | `/creatives/:id/approve` | Approves a creative | creatives.approve |
| GET/POST | `/conversion-events`, PATCH/DELETE `/conversion-events/:id` | Event mapping | tracking.* |
| GET | `/tracking/health` | Events today, change vs. yesterday, events needing attention | tracking.view |
| GET | `/attribution` | Data quality, attributed revenue by platform, unmapped events. `model` = `data_driven` (default), `last_touch`, `first_touch`, `linear` | reports.view |

## Automations, billing, approvals, team, operations

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET/POST | `/automations`, PATCH/DELETE `/automations/:id` | Rules | automations.* |
| GET | `/automations/activity` | What the rules did, newest first | automations.view |
| GET/PUT | `/campaign-defaults` | Guardrails for new campaigns: consent required, auto-tag links, policy validation | settings.view / edit |
| GET/PUT | `/spend-limit` | Monthly limit, alert share (0.7 / 0.8 / 0.9), `notifyBeforeLimit`; GET adds `used` this month | billing.view / edit |
| GET/PUT | `/approval-policy` | `scope` (`budget_and_launch`, `all_changes`, `creative_only`, `none`), `threshold`, `approverRole` (a Paid Ads role) | billing.view / edit |
| GET | `/billing/payment-method` | Card brand, last four digits and status only. Card details are entered at the payment provider (Lulu billing / Stripe), never in this module | billing.view |
| GET | `/billing/statements` | Monthly charges per platform | billing.view |
| GET | `/approvals`, POST `/approvals/:id/approve`, `/reject` | Approval requests; a person cannot approve their own | billing.approve |
| POST | `/approvals` | Ask for an approval: `{ kind, campaignId, payload }`. An open request for the same kind and campaign is returned instead of a second one | campaigns.edit |
| GET/PUT | `/settings/permissions` | Role permissions | settings.edit |
| GET | `/team` | Teammates with their Paid Ads role (`owner`, `editor`, `reviewer`, `analyst`), channel scope and creative approval right | settings.view |
| POST | `/team/invitations` | Invite by email with a role (not owner); `CONFLICT` if already in the team | settings.edit |
| PATCH | `/team/:userId` | Change role, scope or creative approval; the owner cannot be changed (`FORBIDDEN`) | settings.edit |
| GET | `/operations` | Sync health, providers, last sync, jobs today, success rate, incidents, webhook events, reconciled share | integrations.view |
| POST | `/operations/incidents/:id/retry` | Queues the failed job again | integrations.edit |
| POST | `/operations/reconcile` | Compares spend, conversions and status with each platform; returns the updated summary | integrations.edit |
| GET | `/operations/sync-runs` | Sync history, newest first (`SyncRun`) | integrations.view |

## Events

Paid Ads publishes `<entity>.created/.updated/.deleted` through the outbox (`campaign.updated`, …) and consumes `crm.*` events (qualified lead, won deal) for attribution.

## Background jobs

| Queue | Payload | Does |
| --- | --- | --- |
| `ads.sync` | `{ workspaceId, adAccountId }` | Pulls campaigns and daily metrics from the provider, writes `CampaignMetricDay`, records a `SyncRun`. Runs on connect, on demand and every 6 hours. |
| `ads.push` | `{ workspaceId, campaignId, requestedById }` | Sends a launch, status or budget change to the provider. Only after confirmation and any required approval. |
