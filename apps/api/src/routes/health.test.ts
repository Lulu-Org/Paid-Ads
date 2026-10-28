import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createHealthHandler, liveHandler } from './health';

describe('health routes (unit)', () => {
  it('GET /health returns 200 with status ok and checks', async () => {
    const app = express();
    const checks = {
      database: vi.fn().mockResolvedValue(undefined),
      redis: vi.fn().mockResolvedValue(undefined),
    };
    app.get('/health', createHealthHandler(checks));
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } } });
    expect(checks.database).toHaveBeenCalled();
    expect(checks.redis).toHaveBeenCalled();
  });

  it('GET /health returns 503 when database is down', async () => {
    const app = express();
    const checks = {
      database: vi.fn().mockRejectedValue(new Error('db down')),
      redis: vi.fn().mockResolvedValue(undefined),
    };
    app.get('/health', createHealthHandler(checks));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
    });
  });

  it('GET /health returns 503 when redis is down', async () => {
    const app = express();
    const checks = {
      database: vi.fn().mockResolvedValue(undefined),
      redis: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    app.get('/health', createHealthHandler(checks));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      data: { status: 'degraded', checks: { database: 'ok', redis: 'down' } },
    });
  });

  it('GET /health returns 503 when a check times out', async () => {
    const app = express();
    const checks = {
      database: vi.fn().mockResolvedValue(undefined),
      redis: vi.fn(() => new Promise<never>(() => {})), // never resolves
    };
    app.get('/health', createHealthHandler(checks, 10));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    const body = res.body as { data: { checks: { redis: string } } };
    expect(body.data.checks.redis).toBe('down');
  });

  it('GET /health/live returns 200 without running checks', async () => {
    const app = express();
    const dbCheck = vi.fn().mockResolvedValue(undefined);
    const redisCheck = vi.fn().mockResolvedValue(undefined);
    app.get('/health/live', liveHandler);
    app.get('/health', createHealthHandler({ database: dbCheck, redis: redisCheck }));
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
    expect(dbCheck).not.toHaveBeenCalled();
    expect(redisCheck).not.toHaveBeenCalled();
  });
});
