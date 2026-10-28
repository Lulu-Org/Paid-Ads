# Tasks

The PM (Sudais) keeps the Owner and Status columns up to date. To pick up or swap a task, say so in the group and the PM updates this file.

Every task: one pull request, one review before merge, no hardcoded text (i18n), tests on risky parts. Read `AGENTS.md` and `docs/` before you start. What each task covers, in detail: `docs/tasks-guide.md`.

Status values: `open`, `in progress`, `in review`, `done`.

Team: Sudais (PM), Abdul (Samteck), Franklin, theLady.

## Phase 0: foundation (start now)

| ID | Task | Owner | Status | Waits for |
| --- | --- | --- | --- | --- |
| PM | Repo, invites, task board, daily status for Dave | Sudais | in progress | |
| P0 | Repo from the CRM base: platform kept, CRM removed, 15 view routes, translations, docs | Sudais | done | |
| P1 | Contract: shared Zod schemas for every table in `docs/data-model.md`, mock fixtures from the design | Sudais | open | |
| B1 | Database: Prisma tables and migration from `docs/data-model.md`, seed with the design's sample data | Franklin | open | P1 |
| B2 | Campaigns API (list, detail, create, edit, plan, checklist), Overview API, metric maths (CTR, CPL, ROAS) with tests | Franklin | open | B1 |
| B3 | Audiences, Creatives, Conversion events, Tracking health, Attribution API | theLady | open | B1 |
| B4 | Reports, Automations, Spend limit, Approval policy and approvals, Operations, Team permissions API | theLady | open | B1 |
| F1 | App shell to match the design (rail, top bar, page heading, Create campaign pop-up), Overview, Campaigns + campaign drawer | Abdul | open | P1 |
| F2 | Planning, Audiences, Creatives, Reports views with their pop-ups | Abdul | open | F1 |
| F3 | Tracking, Attribution & Data, Automations, Integrations, Platform Setup views | Sudais | open | P1 |
| F4 | Launch Checklist, Operations, Billing & Controls, Team & Permissions views | Sudais | open | F3 |

## Phases 1–4: the ad platforms, in Dave's order

| ID | Task | Owner | Status | Waits for |
| --- | --- | --- | --- | --- |
| C0 | `AdsProvider` interface, simulated provider, `ads.sync` and `ads.push` workers, OAuth connect flow, encrypted tokens | Franklin | open | B2 |
| C1 | Google LSA provider (Google Ads API, Local Services) | Franklin | open | C0, Dave's Google Ads developer token |
| C2 | Google Ads provider | Franklin | open | C1 |
| C3 | Meta Ads provider | theLady | open | C0, Dave's Meta app |
| C4 | LinkedIn Ads provider | Sudais | open | C0, Dave's LinkedIn access |
| R | Each phase: deploy, test with Dave, fix his review | Sudais | open | |

Pages move from mock to the real API one area at a time with `NEXT_PUBLIC_REAL_API` (`apps/web/src/lib/api/index.ts`), as in the CRM.
