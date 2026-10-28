# Data model: Lulu Paid Ads

Every table has `id` (uuid), `workspaceId`, `createdAt`, `updatedAt` and `deletedAt` (soft delete), unless noted. Money is `amount` (number, in the currency's main unit, two decimals) plus `currency` (ISO 4217, e.g. `EUR`). Rates are numbers (`0.0446`, not `"4.46%"`). Dates are timestamps.

Campaign defaults (consent required, auto-tag links, policy validation) are a `Setting` row with key `campaignDefaults`.

Platform tables (already in `apps/api/prisma/schema.prisma`, same as the CRM): `Workspace`, `User` (`role`: `owner`, `admin`, `member`), `Setting`, `Permission`, `AuditLog`, `OutboxEvent`.

## Enums

| Enum | Values |
| --- | --- |
| `AdPlatform` | `google_lsa`, `google_ads`, `meta_ads`, `linkedin_ads` |
| `ConnectionStatus` | `connected`, `needs_attention`, `disconnected` |
| `CampaignStatus` | `draft`, `live`, `paused`, `ended` |
| `PlanStepStatus` | `done`, `current`, `upcoming` |
| `ApprovalStatus` | `pending`, `approved`, `rejected` |
| `SyncStatus` | `queued`, `running`, `succeeded`, `failed` |

## Tables

| Table | Fields | Notes |
| --- | --- | --- |
| AdAccount | platform, externalId, name, currency, status (`ConnectionStatus`), scopes (string[]), tokenEncrypted, tokenExpiresAt, lastSyncAt, lastError | One per connected ad account. The token never leaves the API. |
| Campaign | adAccountId, platform, externalId (null for drafts), name, status, objective, audienceSummary, startAt, endAt (null = always on), budgetAmount, budgetCurrency, rationale, nextStep, ownerId | `rationale` and `nextStep` are the design's "Why this campaign" and "Next step". |
| CampaignMetricDay | campaignId, date, impressions, clicks, conversions, leads, spendAmount, revenueAmount, currency | One row per campaign per day, written by `ads.sync`. Totals, CTR (clicks ÷ impressions), CPL (spend ÷ leads) and ROAS (revenue ÷ spend) are computed, never stored. No soft delete. |
| CampaignPlanStep | campaignId, order, label, detail, status (`PlanStepStatus`) | The design's campaign plan timeline. |
| Audience | name, source (`crm_segment`, `website_visitors`, `customer_list`, `lookalike`), sizeEstimate, consentBasis, platforms (`AdPlatform`[]), lastSyncedAt | |
| Creative | name, type (`search_ad`, `image`, `video`, `carousel`, `document`, `lead_form`, `landing_page`, `extension`, `profile`), fileUrl, meta (JSON: formats, lengths), approvalStatus, approvedById | |
| CampaignCreative | campaignId, creativeId, variant (`A`, `B`, …) | Which creatives run where. No soft delete. |
| ConversionEvent | name, source (`crm`, `calendar`, `accounting`, `website`, `call`), valueAmount, valueCurrency (both null = dynamic, the value comes with each conversion), platforms (`AdPlatform`[]), health (`mapped`, `needs_attention`), lastReceivedAt | The design's "Event mapping". |
| AutomationRule | name, trigger (JSON: platforms, schedule cron or null), condition (JSON or null for scheduled digests: metric, operator, value, window in hours or days), action (`notify`, `recommend`, `pause_campaign`, `shift_budget`, `send_digest`), enabled | Budget actions always go through an approval. |
| AutomationActivity | ruleId, outcome (`review_requested`, `paused`, `notified`, `digest_sent`, `budget_shifted`), campaignId, at | One row per thing a rule did. No soft delete. |
| SpendLimit | monthlyAmount, currency, alertAt (fraction, e.g. 0.8) | One per workspace. |
| ApprovalPolicy | thresholdAmount, currency, approverRole | Changes above the threshold need approval. |
| ApprovalRequest | kind (`budget_change`, `launch`, `creative`), campaignId, payload (JSON), status (`ApprovalStatus`), requestedById, decidedById, decidedAt | |
| Report | name, view (JSON: filters, comparison), schedule (cron, null = on demand), recipients (string[]) | |
| SyncRun | adAccountId, kind (`sync`, `push`), status (`SyncStatus`), startedAt, finishedAt, recordsProcessed, error | The design's "Operations" view. No soft delete. |

## Indexes

`(workspaceId, platform)` on AdAccount and Campaign, `(workspaceId, status)` on Campaign, `(workspaceId, campaignId, date)` unique on CampaignMetricDay, `(workspaceId, startedAt)` on SyncRun.
