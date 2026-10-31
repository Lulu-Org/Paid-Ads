
# API: Lulu Paid Ads

Base path `/api/v1`. Request and response shapes are the Zod schemas in `packages/shared/src/` (`campaign.ts`, `library.ts`, `controls.ts`, `metrics.ts`); money travels as `{ amount, currency }`. JSON in and out, in the format from `AGENTS.md`. Every route except `POST /auth/login` and `GET /health` needs a bearer token, and every route checks the role's permission (`packages/shared/src/permissions.ts`). Lists take `page`, `pageSize` (max 100), `sort` (`field` or `-field`) and `q`.

## Platform (done, same as the CRM)

| Method | Path               | What                                      |
| ------ | ------------------ | ----------------------------------------- |
| GET    | `/health`        | API, database and Redis status            |
| POST   | `/auth/login`    | Email + password, returns a token         |
| POST   | `/auth/logout`   | Ends the token                            |
| GET    | `/me`            | The signed-in user                        |
| GET    | `/users`         | People in the workspace                   |
| GET    | `/audit-log`     | Who changed what (owners and admins)      |
| GET    | `/manifest.json` | The bundle manifest for the Lulu platform |

## Ad accounts and providers

| Method | Path                                | What                                                            | Permission          |
| ------ | ----------------------------------- | --------------------------------------------------------------- | ------------------- |
| --- | --- | --- | --- |
| GET | `/ad-accounts` | Connected accounts with status and last sync (the token is never returned) | integrations.view |
| POST | `/ad-accounts/connect` | `{ platform }` → `{ authorizeUrl }` to start OAuth, with a signed single-use state | integrations.create |
| GET | `/ad-accounts/callback/:platform` | Public OAuth return; verifies and consumes the state, stores the encrypted token, queues the first sync, registers the 6-hour scheduler, then redirects to `CORS_ORIGIN/ads/integrations?connected=<platform>` | (state check) |
| POST | `/ad-accounts/:id/sync` | Creates a queued `SyncRun` and adds `ads.sync` for it | integrations.edit |
| DELETE | `/ad-accounts/:id` | Disconnects: marks it `disconnected`, clears the token, scopes and error, removes its scheduler, keeps the row and history | integrations.delete |

**`AdsProvider` interface** (`apps/api/src/providers/`), one implementation per platform plus `SimulatedAdsProvider`, which returns the design's sample data. `ADS_PROVIDER_<PLATFORM>=simulated|live` chooses per platform. Google LSA has a live connector (C1); `live` for the other platforms fails fast until C2–C4. `ProviderAccount` is the stored account metadata plus the decrypted token — only the provider layer sees the token.

```ts
interface ProviderAccount {
  id: string;
  workspaceId: string;
  platform: AdPlatform;
  externalId: string;
  name: string;
  currency: string;
  scopes: string[];
  token: string;
  tokenExpiresAt: Date | null;
}

interface AdsProvider {
  platform: AdPlatform;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ token: string; expiresAt: Date | null; accounts: ExternalAccount[] }>;
  listCampaigns(account: ProviderAccount): Promise<ExternalCampaign[]>;
  metrics(account: ProviderAccount, from: Date, to: Date): Promise<ExternalMetricDay[]>;
  pushCampaign(account: ProviderAccount, campaign: Campaign): Promise<{ externalId: string }>;
  setStatus(account: ProviderAccount, externalId: string, status: "live" | "paused"): Promise<void>;
  setBudget(account: ProviderAccount, externalId: string, budget: Money): Promise<void>;
}
```

The simulated provider has one account per platform with the seed's external ids (`account_google_ads_ext`, `account_google_lsa_ext`, `account_meta_ext`, `account_linkedin_ext`), the seed's campaigns (`g_1001`, `lsa_2001`, `m_3001`; LinkedIn has none), deterministic 30-day metrics for each campaign, and a deterministic external id (`sim-<platform>-<campaignId>`) for pushed campaigns, so a retry never duplicates one.

Tokens are encrypted with AES-256-GCM (`ADS_TOKEN_ENCRYPTION_KEY`, required in production). OAuth state is a short-lived signed JWT whose `jti` is stored in Redis and consumed with `GETDEL`, so a callback cannot be replayed.

### Google LSA (live, C1)

`ADS_PROVIDER_GOOGLE_LSA=live` uses the Google Ads API **v26 REST** endpoints through `GoogleAdsClient` (`providers/googleLsaClient.ts`) and `GoogleLsaProvider` (`providers/googleLsa.ts`). It needs `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, and optionally `GOOGLE_ADS_LOGIN_CUSTOMER_ID` and `GOOGLE_ADS_API_VERSION` (default `v26`). OAuth requests the `https://www.googleapis.com/auth/adwords` scope with offline access. The refresh token is stored encrypted; access tokens are cached in memory and refreshed on expiry or a `401`.

The connector reads standalone `LOCAL_SERVICES` campaigns and Local Services Performance Max campaigns (`PERFORMANCE_MAX` with `pmax_campaign_settings.local_services_enabled = true`). On connect it lists accessible customers and keeps non-manager accounts that already have at least one such campaign. An account with LSA set up but no existing campaign is not discovered yet (C1 limitation).

Google budgets are average daily. Synced LSA campaigns get `budgetPeriod: monthly`, read as `daily micros × 30.4`; `setBudget` writes a monthly budget as `monthly ÷ 30.4` in micros, a daily one as is, and refuses a `total` budget without changing anything. Spend comes from campaign cost, leads from charged `local_services_lead` rows, and calls are charged `PHONE_CALL` leads, so spend, CPL and call counts reconcile. Revenue is `0` because LSA revenue is not in this module. Pause/resume and budget changes mutate existing campaigns only. The Google Ads API cannot create standalone LSA campaigns, so `pushCampaign` fails and launching a live LSA draft without an `externalId` returns `409 CONFLICT` with `details.reason = campaign_creation_unsupported`; the campaign stays `draft`.

### Budget periods

Every campaign has `budgetPeriod`: `monthly`, `daily` or `total` (the whole run). The amount means what the period says, and it is how the platform reads it, so a sync stores the provider's period with the amount and `ads.push` passes it to `setBudget`. A provider refuses a period it cannot hold. New campaigns default to `monthly`. The period can change only while the campaign is a draft that is not on the platform yet; after that a PATCH with another period returns `409 CONFLICT` with `details.reason = budget_period_locked`. Progress compares the spend in the period with the budget, counted from the newest day with metrics: that day's month, that day, or every day (`campaignTotals` in `packages/shared/src/metrics.ts`).

### LinkedIn Ads (task C4)

`apps/api/src/providers/linkedin.ts`, live with `ADS_PROVIDER_LINKEDIN_ADS=live` plus `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` and `LINKEDIN_API_VERSION` (YYYYMM; the API refuses to start in live mode without them). Redirect URI to register in the LinkedIn app: `<API_PUBLIC_URL>/api/v1/ad-accounts/callback/linkedin_ads`. Scopes `r_ads`, `r_ads_reporting`, `rw_ads`; LinkedIn must have granted the app the Advertising API product.

| Operation | LinkedIn call | Notes |
| --- | --- | --- |
| Sign-in | OAuth 2.0 authorization code | Tokens last about 60 days; then the account shows "needs attention" and is connected again. |
| Ad accounts | `GET /rest/adAccounts?q=search` (active) | |
| Campaigns | `GET /rest/adAccounts/{id}/adCampaigns?q=search` (paged) | `ACTIVE`→live, `PAUSED`→paused, `DRAFT`→draft, `COMPLETED`/`ARCHIVED`/`CANCELED`→ended, removed ones left out. Budget: `totalBudget`, else `dailyBudget` (known gap: Lulu has one budget type). |
| Metrics | `GET /rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY` | leads = `oneClickLeads`; conversions = website conversions + leads; spend and revenue in the account currency. |
| Pause / resume | `PARTIAL_UPDATE` of `status` | |
| Budget | `PARTIAL_UPDATE` of `totalBudget` | Refused when the currency differs from the account's. Budget meaning differs from LSA (monthly): to be unified with a budget type before C2. |
| Create campaign | — | Not supported yet (needs a campaign group, targeting and creatives). `campaignCreationSupported` blocks launching a live LinkedIn draft without a LinkedIn campaign, like LSA; create it in LinkedIn Campaign Manager and sync it. |

Errors become `LinkedInApiError`; rate limits (429) and server errors are retried by the job, the rest fail the sync run with LinkedIn's message.

## Campaigns

| Method  | Path                                  | What                                                                                                                                                                                                                                                                        | Permission                              |
| ------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| GET     | `/campaigns`                        | List with totals (spend, leads, CPL, progress = spend in the budget period ÷ budget). Filters `platform`, `status`; `q` matches name or objective; sort `name` (default), `createdAt`, `startAt` or `budget`, with `-` for descending                                           | campaigns.view                          |
| POST    | `/campaigns`                        | Create a draft; the owner defaults to the current user and an `adAccountId` must exist in the workspace and match the platform                                                                                                                                            | campaigns.create                        |
| GET     | `/campaigns/:id`                    | Detail: metrics, plan steps, creatives, rationale, next step                                                                                                                                                                                                                | campaigns.view                          |
| PATCH   | `/campaigns/:id`                    | Edit a draft or its details. A budget change whose absolute amount is above the policy threshold holds the whole PATCH: the campaign is unchanged and the response is `202` with the open `budget_change` `ApprovalRequest`. `budgetPeriod` changes only on a draft not yet pushed, otherwise `409` with `reason = budget_period_locked` | campaigns.edit                          |
| POST    | `/campaigns/:id/launch`             | Runs the launch checklist. A required approval returns `202` with the open `launch` `ApprovalRequest` and keeps the campaign in draft; a failed checklist returns `409` with it in `details`; a live Google LSA draft without an `externalId` returns `409` with `reason = campaign_creation_unsupported`; on success the status becomes `live`, then `ads.push` is queued | campaigns.edit (+ approval if required) |
| POST    | `/campaigns/:id/pause`, `/resume` | Only `live → paused` and `paused → live`; the status changes locally, then `ads.push` is queued. Any other status returns `409`                                                                                                                                   | campaigns.edit                          |
| GET     | `/campaigns/:id/checklist`          | The launch checklist items and which pass                                                                                                                                                                                                                                   | campaigns.view                          |
| GET/PUT | `/campaigns/:id/plan`               | `{ steps: [...] }`, ordered; PUT replaces all active steps (at most 20)                                                                                                                                                                                                   | campaigns.view / edit                   |

## Overview, planning and reports

| Method   | Path                                            | What                                                                                                                                                                                                                                                                                                                                                                         | Permission     |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| GET      | `/overview`                                   | KPIs (spend, attributed revenue, leads, CPL, ROAS with change vs. the preceding range of the same length and a daily trend), spend by platform. Built by `buildOverview` (`packages/shared/src/overview-logic.ts`). The range ends on `endDate`, the newest day with synced metrics, so an old last sync still shows numbers. Query `rangeDays` (1–366, default 30) | campaigns.view |
| GET      | `/planning`                                   | The month's `BudgetPlan` with what `buildPlanning` (`packages/shared/src/planning-logic.ts`) computes: allocated against the monthly spend limit, share per channel, target leads, forecast leads and revenue from each channel's last 30 days (`planningSchema`)                                                                                                    | budgets.view   |
| POST     | `/planning/scenarios`                         | Saves a draft scenario with other channel amounts (`planScenarioCreateSchema`); returns the `planningSchema` for it                                                                                                                                                                                                                                                      | budgets.edit   |
| GET/POST | `/reports`, GET/PATCH/DELETE `/reports/:id` | Saved and scheduled reports                                                                                                                                                                                                                                                                                                                                                  | reports.*      |
| GET      | `/reports/:id/run`                            | The report's numbers for a date range                                                                                                                                                                                                                                                                                                                                        | reports.view   |
| GET      | `/reports/run`                                | Ad hoc numbers: `from`, `to` (dates), `platforms` (comma separated, empty = all). KPIs with change vs. the period before, and spend, leads, conversions, revenue and ROAS per channel (`reportRunSchema`, built by `buildReport`)                                                                                                                                  | reports.view   |

## Audiences, creatives, tracking

Sort: `name` (default) or `createdAt`, with `-` for descending; any other sort is `400`.

| Method   | Path                                                            | What                                                                                                                                                                                                                                                                                                                                   | Permission        |
| -------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| GET/POST | `/audiences`, GET/PATCH/DELETE `/audiences/:id`             | Audience library. The list returns `audienceListItemSchema`: description, match rate, exclusions, campaign count, `syncing`                                                                                                                                                                                                        | audiences.*       |
| POST     | `/audiences/:id/sync`                                         | Queues the audience sync to its platforms. Not implemented until C0 (needs `ads.sync` workers for the `audiences` scope)                                                                                                                                                                                                           | audiences.edit    |
| GET/POST | `/creatives`, GET/PATCH/DELETE `/creatives/:id`             | Creative library. `POST` accepts JSON or `multipart/form-data` (`file`, plus `name` and `type`); files up to 25 MB, `png`, `jpeg`, `webp`, `gif`, `mp4` or `pdf`; a wrong type or size is `400`. The list returns `creativeListItemSchema`: campaign count and `winning`                                   | creatives.*       |
| GET      | `/creative-tests`                                             | Campaigns running two or more creative variants, with spend, leads and CPL per variant (`creativeTestSchema`)                                                                                                                                                                                                                        | creatives.view    |
| POST     | `/creatives/:id/approve`                                      | Approves a creative                                                                                                                                                                                                                                                                                                                    | creatives.approve |
| GET/POST | `/conversion-events`, PATCH/DELETE `/conversion-events/:id` | Event mapping. New events start as `needs_attention`                                                                                                                                                                                                                                                                                 | tracking.*        |
| GET      | `/tracking/health`                                            | Events today, change vs. yesterday, events needing attention                                                                                                                                                                                                                                                                           | tracking.view     |
| GET      | `/attribution`                                                | Data quality, attributed revenue by platform, unmapped events. `model` = `data_driven` (default), `last_touch`, `first_touch`, `linear`. Until a CRM outcome table exists, revenue is the last 30 days of `CampaignMetricDay.revenueAmount` per platform; `model` is accepted and echoed but does not change the numbers | reports.view      |

## Automations, billing, approvals, team, operations

| Method   | Path                                                         | What                                                                                                                                         | Permission           |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| GET/POST | `/automations`, PATCH/DELETE `/automations/:id`          | Rules                                                                                                                                        | automations.*        |
| GET      | `/automations/activity`                                    | What the rules did, newest first                                                                                                             | automations.view     |
| GET/PUT  | `/campaign-defaults`                                       | Guardrails for new campaigns: consent required, auto-tag links, policy validation                                                            | settings.view / edit |
| GET/PUT  | `/spend-limit`                                             | Monthly limit, alert share (0.7 / 0.8 / 0.9), `notifyBeforeLimit`; GET adds `used` this month                                            | billing.view / edit  |
| GET/PUT  | `/approval-policy`                                         | `scope` (`budget_and_launch`, `all_changes`, `creative_only`, `none`), `threshold`, `approverRole` (a Paid Ads role)           | billing.view / edit  |
| GET      | `/billing/payment-method`                                  | Card brand, last four digits and status only. Card details are entered at the payment provider (Lulu billing / Stripe), never in this module | billing.view         |
| GET      | `/billing/statements`                                      | Monthly charges per platform                                                                                                                 | billing.view         |
| GET      | `/approvals`, POST `/approvals/:id/approve`, `/reject` | Approval requests; a person cannot approve their own                                                                                         | billing.approve      |
| POST     | `/approvals`                                               | Ask for an approval: `{ kind, campaignId, payload }`. An open request for the same kind and campaign is returned instead of a second one   | campaigns.edit       |
| GET/PUT  | `/settings/permissions`                                    | Role permissions                                                                                                                             | settings.edit        |
| GET      | `/team`                                                    | Teammates with their Paid Ads role (`owner`, `editor`, `reviewer`, `analyst`), channel scope and creative approval right             | settings.view        |
| POST     | `/team/invitations`                                        | Invite by email with a role (not owner); `CONFLICT` if already in the team                                                                 | settings.edit        |
| PATCH    | `/team/:userId`                                            | Change role, scope or creative approval; the owner cannot be changed (`FORBIDDEN`)                                                         | settings.edit        |
| GET      | `/operations`                                              | Sync health, providers, last sync, jobs today, success rate, incidents, webhook events, reconciled share                                     | integrations.view    |
| POST     | `/operations/incidents/:id/retry`                          | Queues the failed job again                                                                                                                  | integrations.edit    |
| POST     | `/operations/reconcile`                                    | Compares spend, conversions and status with each platform; returns the updated summary                                                       | integrations.edit    |
| GET      | `/operations/sync-runs`                                    | Sync history, newest first (`SyncRun`)                                                                                                     | integrations.view    |

## Events

Paid Ads publishes `<entity>.created/.updated/.deleted` through the outbox (`campaign.updated`, …) and consumes `crm.*` events (qualified lead, won deal) for attribution.

## Background jobs
| Queue        | Payload                                        | Does                                                                                                                                                    |
| ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ads.sync` | `{ workspaceId, adAccountId, syncRunId? }` | Pulls campaigns and daily metrics from the provider, upserts them by external id and `(campaign, date)`, updates `lastSyncAt`, and finishes the `SyncRun` (the one from `syncRunId` when the endpoint created it). Runs on connect, on demand and every 6 hours. Concurrency 1. |
| `ads.push` | `{ workspaceId, campaignId, requestedById }` | Sends a launch, status or budget change to the provider. Creates the remote campaign only while `externalId` is null, then applies status and budget. Records a `kind: push` `SyncRun`. Retries never duplicate a campaign. Only after confirmation and any required approval. |

