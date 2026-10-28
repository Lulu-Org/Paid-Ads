# Lulu CRM web app

Next.js (App Router) + TypeScript + Tailwind v4 + next-intl.

## Run

From the repository root:

```
npm install
npm run dev:web          # http://localhost:3000 -> /en/crm/overview
npm test -w @lulu/web    # unit tests
```

Copy `.env.example` to `apps/web/.env.local`. `NEXT_PUBLIC_USE_MOCK=true` (the default) serves the design's sample data from `packages/shared`. Set it to `false` and set `NEXT_PUBLIC_API_URL` to use the real API.

### Signing in

As soon as any area uses the real API, the CRM pages ask you to sign in at `/<locale>/login` (`src/features/auth`). Locally, use the seeded owner from `docs/api.md` (`jamie.morgan@lulu.test`). The token is kept in the browser until it expires; when it expires or the API rejects it, you are sent back to sign in. In full mock mode there is no sign-in. Login and logout use the real API automatically whenever any area does, so `auth` never needs listing.

### Moving to the real API one area at a time

Keep `NEXT_PUBLIC_USE_MOCK=true` and list the areas that are ready in `NEXT_PUBLIC_REAL_API`, for example:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_REAL_API=me,users,contacts,companies
```

Everything not listed keeps using sample data (`src/lib/api/index.ts`, `chooseApi`). Restart `npm run dev:web` after changing it.

Switch linked areas **together**, because the real database uses different ids from the sample data and a real deal cannot point at a sample contact:

| Switch together | Needs |
| --- | --- |
| `me`, `users` | login (task 2), and every other area needs these |
| `contacts`, `companies` | task 3 |
| `pipelines`, `deals` | task 4, and contacts/companies already real |
| `tasks`, `notes`, `activities` | task 5, and contacts/companies already real |
| `overview` | every area above |
| `segments`, `imports`, `ai`, `settings` | tasks 6 to 9 |

## Where things are

| Path | What |
| --- | --- |
| `src/app/[locale]/crm/<page>/page.tsx` | One folder per CRM page. Replace `<ComingSoon />` when you build a page |
| `src/components/layout` | App shell: rail, CRM nav, top bar, language switcher, `PageHeader` |
| `src/components/ui` | Shared components: Button, Pill, Avatar, Card, Modal, Drawer, Toast, Table, Pagination, EmptyState, Skeleton |
| `src/lib/api` | `api` client. `mock.ts` and `real.ts` have the same shape; `index.ts` picks one |
| `src/i18n` | Locales, routing, `useFormat()` for money, numbers and dates |
| `messages/*.json` | Translations. Every key must exist in all files (a test checks this) |
| `src/app/globals.css` | Design tokens as CSS variables, exposed to Tailwind (`bg-primary`, `text-text-muted`, ...) |

## Rules

- No text in components. Add a key to `messages/en.json`, `de.json` and `zh.json`.
- Import `Link`, `useRouter` and `usePathname` from `@/i18n/navigation`, not from Next, so the language stays in the URL.
- Show money with `useFormat().money({ amount, currency })`, never by joining strings.
- Show API errors with `useErrorMessage()` from `@/lib/errors`.
- To add a language: add it to `src/i18n/locales.json` and add `messages/<code>.json`. No code change.
