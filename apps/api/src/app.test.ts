import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('Swagger docs routes', () => {
  const app = createApp();

  it('GET /docs.json serves the OpenAPI document', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const body = res.body as {
      openapi: string;
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(body.openapi).toBe('3.1.0');
    expect(body.paths).toHaveProperty('/health');
    expect(body.components.schemas).toHaveProperty('HealthStatus');
  });

  it('GET /docs serves the Swagger UI HTML shell with a docs-scoped CSP', async () => {
    const res = await request(app).get('/docs').redirects(1);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
    // Helmet's default CSP (default-src 'none') would block the UI shell;
    // the docs routes relax it without weakening the rest of the API.
    expect(res.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
  });

  it('leaves helmet defaults on non-docs routes', async () => {
    const res = await request(app).get('/health/live');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("frame-ancestors 'self'");
    // The docs-only relaxation (inline scripts allowed) must not leak elsewhere.
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('serves Swagger UI assets under /docs', async () => {
    const res = await request(app).get('/docs/swagger-ui-bundle.js');
    expect(res.status).toBe(200);
  });
});
