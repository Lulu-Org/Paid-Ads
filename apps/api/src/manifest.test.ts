import { describe, expect, it } from 'vitest';
import { buildManifest } from './manifest';
import { paths } from './openapi/paths';

describe('bundle manifest', () => {
  const manifest = buildManifest();

  it('lists every documented API operation, so it cannot drift from the API', () => {
    const documented = Object.entries(paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
      .flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
      );
    expect([...manifest.apis].sort()).toEqual(documented.sort());
    expect(manifest.apis).toContain('GET /api/v1/audit-log');
    expect(manifest.apis).toContain('GET /api/v1/me');
  });

  it('declares the events it publishes and consumes, and its permissions', () => {
    expect(manifest).toMatchObject({ id: 'lulu.paid_ads', name: 'Lulu Paid Ads' });
    expect(manifest.events.publishes).toContain('user.updated');
    expect(manifest.events.consumes).toEqual(['crm.*']);
    expect(manifest.capabilities.provides).toContain('campaigns.edit');
    expect(manifest.capabilities.provides).toContain('budgets.approve');
    expect(manifest.jobs).toEqual(['ads.sync', 'ads.push']);
  });

  it('includes the database migrations, oldest first', () => {
    expect(manifest.migrations.length).toBeGreaterThan(0);
    expect(manifest.migrations).toContain('20261028120000_init_platform');
    expect([...manifest.migrations].sort()).toEqual(manifest.migrations);
  });
});
