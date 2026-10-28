import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('health routes (int)', () => {
  const app = createApp();

  beforeAll(async () => {
    // Ensure services are reachable
  });

  afterAll(async () => {
    // App lifecycle managed by server in other contexts; tests just use supertest
  });

  it('GET /health returns 200 with both checks ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } } });
  });

  it('GET /health/live returns 200 with status ok', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('GET /api/v1/health returns 200 with both checks ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } } });
  });
});
