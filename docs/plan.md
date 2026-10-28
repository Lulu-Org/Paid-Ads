# Plan: Lulu Paid Ads

## Phases

| Phase | What | Done when |
| --- | --- | --- |
| 0. Foundation | Repo, contract (shared schemas + `docs/api.md`), sample data from the design, all 15 views built against the mock | Every view matches the design in mock mode, in en/de/zh, on desktop and phone |
| 1. Google LSA | Real API for campaigns, metrics, ad accounts; `AdsProvider` with the simulated provider; Google LSA live (via the Google Ads API) | A real LSA account connects, syncs leads and spend, and shows on Overview and Campaigns |
| 2. Google Ads | Google Ads provider: search/display campaigns, metrics, pause/resume, budget changes with approval | Same, for Google Ads |
| 3. Meta Ads | Meta Marketing API provider: campaigns, metrics, audiences, creatives | Same, for Meta |
| 4. LinkedIn Ads | LinkedIn Marketing API provider | Same, for LinkedIn |

Dave pays per platform step (chat, Oct 27, 2026), so each phase is merged, deployed and shown to him on its own.

## Access Dave must request now (approval can take days or weeks)

- **Google Ads API developer token** (covers Google Ads and Local Services Ads), a Google Cloud OAuth client, and a manager (MCC) account.
- **Meta**: a Meta app with Marketing API access and a Business Manager.
- **LinkedIn**: Marketing Developer Platform access for a LinkedIn app.

Until each arrives, its platform runs on the simulated provider, so no work waits.

## The views (design: "Lulu Paid Ads")

| View | Route | What it shows |
| --- | --- | --- |
| Overview | `/ads/overview` | KPI cards with sparklines, platform cards, campaign table, Create campaign |
| Campaigns | `/ads/campaigns` | Summary cards, campaign table with platform filter, campaign drawer (metrics, plan, assets, pause/resume) |
| Planning | `/ads/planning` | Planned spend, targets, forecast, spend per platform, planning steps, scenario |
| Audiences | `/ads/audiences` | Audience library and Create audience |
| Creatives | `/ads/creatives` | Creative library, variant test results, Add creative |
| Tracking | `/ads/tracking` | Tracking health, events today, event list |
| Attribution & Data | `/ads/attribution` | Data quality, attributed revenue by platform, event mapping |
| Reports | `/ads/reports` | Date range, KPIs, saved reports, Schedule report |
| Automations | `/ads/automations` | Rules and alerts, Create rule |
| Integrations | `/ads/integrations` | One card per platform: connection, permissions, last sync |
| Platform Setup | `/ads/platform-setup` | Per-platform account, bidding, tracking and policy settings |
| Launch Checklist | `/ads/launch-checklist` | Pre-launch checks with a score |
| Operations | `/ads/operations` | Sync health, jobs processed, incidents |
| Billing & Controls | `/ads/billing` | Spend limit, approval threshold, payment methods |
| Team & Permissions | `/ads/team` | Members, roles, Invite teammate |

The design's utility pop-ups (audience, creative, event, automation, connection, report, spend limit, member, policy, payment, scenario) belong to the view that opens them.
