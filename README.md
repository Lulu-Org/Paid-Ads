# Lulu Paid Ads

The Paid Ads module of Lulu: plan, launch and measure campaigns on Google LSA, Google Ads, Meta Ads and LinkedIn Ads from one workspace. Start with `AGENTS.md`, then `docs/`.

## Run it

```bash
npm install
npm run dev:web          # http://localhost:3000, mock mode with the design's sample data
```

With the API:

```bash
cp .env.example .env     # fill in the values
docker compose up -d postgres redis
npm run dev:api          # http://localhost:4000/api/v1/health
```

`npm run check` runs types, lint, tests and the build. Deploying: `docs/deploy.md`.
