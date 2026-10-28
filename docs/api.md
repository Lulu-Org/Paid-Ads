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
| GET | `/campaigns` | List with totals (spend, leads, CPL, progress = spend ÷ budget). Filters `platform`, `status` | campaigns.view |
| POST | `/campaigns` | Create a draft | campaigns.create |
| GET | `/campaigns/:id` | Detail: metrics, plan steps, creatives, rationale, next step | campaigns.view |
| PATCH | `/campaigns/:id` | Edit a draft or its details. A budget change above the policy threshold returns `202` with an `ApprovalRequest` | campaigns.edit |
| POST | `/campaigns/:id/launch` | Runs the launch checklist, then queues `ads.push` | campaigns.edit (+ approval if required) |
| POST | `/campaigns/:id/pause`, `/resume` | Queues `ads.push` with the new status | campaigns.edit |
| GET | `/campaigns/:id/checklist` | The launch checklist items and which pass | campaigns.view |
| GET/PUT | `/campaigns/:id/plan` | Plan steps | campaigns.view / edit |

## Overview, planning and reports

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET | `/overview` | KPIs (spend, attributed revenue, leads, CPL, ROAS with change vs. last period), spend by platform, top campaigns | campaigns.view |
| GET | `/planning` | Planned spend per platform, targets, forecast | budgets.view |
| POST | `/planning/scenarios` | Saves a budget scenario | budgets.edit |
| GET/POST | `/reports`, GET/PATCH/DELETE `/reports/:id` | Saved and scheduled reports | reports.* |
| GET | `/reports/:id/run` | The report's numbers for a date range | reports.view |

## Audiences, creatives, tracking

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET/POST | `/audiences`, GET/PATCH/DELETE `/audiences/:id` | Audience library | audiences.* |
| POST | `/audiences/:id/sync` | Queues the audience sync to its platforms | audiences.edit |
| GET/POST | `/creatives`, GET/PATCH/DELETE `/creatives/:id` | Creative library (upload via `multipart/form-data`) | creatives.* |
| POST | `/creatives/:id/approve` | Approves a creative | creatives.approve |
| GET/POST | `/conversion-events`, PATCH/DELETE `/conversion-events/:id` | Event mapping | tracking.* |
| GET | `/tracking/health` | Events today, health per platform | tracking.view |
| GET | `/attribution` | Revenue by platform and campaign from CRM and accounting outcomes | reports.view |

## Automations, billing, approvals, team, operations

| Method | Path | What | Permission |
| --- | --- | --- | --- |
| GET/POST | `/automations`, PATCH/DELETE `/automations/:id` | Rules | automations.* |
| GET/PUT | `/spend-limit` | Workspace monthly limit and alert | billing.view / edit |
| GET/PUT | `/approval-policy` | Threshold and approver role | billing.view / edit |
| GET | `/approvals`, POST `/approvals/:id/approve`, `/reject` | Approval requests | billing.approve |
| GET/PUT | `/settings/permissions` | Role permissions | settings.edit |
| GET | `/operations` | Sync health, jobs today, recent `SyncRun`s and failures | integrations.view |

## Events

Paid Ads publishes `<entity>.created/.updated/.deleted` through the outbox (`campaign.updated`, …) and consumes `crm.*` events (qualified lead, won deal) for attribution.

## Background jobs

| Queue | Payload | Does |
| --- | --- | --- |
| `ads.sync` | `{ workspaceId, adAccountId }` | Pulls campaigns and daily metrics from the provider, writes `CampaignMetricDay`, records a `SyncRun`. Runs on connect, on demand and every 6 hours. |
| `ads.push` | `{ workspaceId, campaignId, requestedById }` | Sends a launch, status or budget change to the provider. Only after confirmation and any required approval. |
