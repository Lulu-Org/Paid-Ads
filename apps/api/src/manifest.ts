import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { permissionActionSchema, permissionResourceSchema } from '@lulu/shared';
import { AUDITED_ENTITIES, PUBLISHED_EVENT_TYPES } from './db/audit';
import { paths } from './openapi/paths';

// The Paid Ads bundle manifest (Lulu Autonomous Bundle Platform, "4.1 Bundle manifest"): what the bundle
// is, what it needs and what it offers, for the platform's resolver and installer. Built from the code
// (API paths, events, permissions, migrations), not written by hand, so it cannot drift. Served at
// GET /manifest.json. The platform has not published its manifest schema yet; field names follow the
// architecture document and will be mapped when it does.

const VERSION = '0.1.0';

// UI routes of apps/web: one per Paid Ads view from the MagicPath design.
const UI_ROUTES = [
  '/ads/overview',
  '/ads/campaigns',
  '/ads/planning',
  '/ads/audiences',
  '/ads/creatives',
  '/ads/tracking',
  '/ads/attribution',
  '/ads/reports',
  '/ads/automations',
  '/ads/integrations',
  '/ads/platform-setup',
  '/ads/launch-checklist',
  '/ads/operations',
  '/ads/billing',
  '/ads/team',
];

function migrationNames(): string[] {
  try {
    return readdirSync(resolve(process.cwd(), 'prisma/migrations'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return []; // Not shipped with this build; the platform reads them from the release instead.
  }
}

export function buildManifest() {
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
  return {
    id: 'lulu.paid_ads',
    name: 'Lulu Paid Ads',
    version: VERSION,
    platformRange: '>=1.0.0 <2.0.0',
    dependencies: [],
    capabilities: {
      // Server-side permissions the bundle checks: <resource>.<action>, e.g. campaigns.edit.
      provides: permissionResourceSchema.options.flatMap((resource) =>
        permissionActionSchema.options.map((action) => `${resource}.${action}`),
      ),
    },
    routes: UI_ROUTES,
    apis: Object.entries(paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
      .flatMap(([path, item]) =>
        methods
          .filter((method) => method in item)
          .map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort(),
    openapi: '/docs.json',
    events: {
      publishes: PUBLISHED_EVENT_TYPES,
      // CRM outcomes (qualified lead, won deal) feed attribution (docs/api.md).
      consumes: ['crm.*'],
    },
    entities: Object.values(AUDITED_ENTITIES).concat(['audit_log']),
    // Added with the AI recommendations (budget shifts, creative tests); none yet.
    aiTools: [],
    jobs: ['ads.sync', 'ads.push'],
    migrations: migrationNames(),
    healthChecks: { live: '/health/live', ready: '/health' },
    entitlements: { plan: 'any', limits: {} },
  };
}
