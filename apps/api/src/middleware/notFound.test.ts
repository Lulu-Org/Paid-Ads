import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from './errorHandler';
import { notFound } from './notFound';
import { requestId } from './requestId';

const app = express();
app.use(requestId);
app.get('/known', (_req, res) => {
  res.status(200).json({ data: 'ok' });
});
app.use(notFound);
app.use(errorHandler);

describe('notFound middleware', () => {
  it('returns the standard error envelope for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'errors.NOT_FOUND', details: null },
    });
  });

  it('does not affect known routes', async () => {
    const res = await request(app).get('/known');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: 'ok' });
  });

  it('echoes the X-Request-Id header on error responses', async () => {
    const res = await request(app).get('/nope').set('X-Request-Id', 'test-req-123');
    expect(res.headers['x-request-id']).toBe('test-req-123');
  });
});

describe('requestId middleware', () => {
  it('generates a UUID when no incoming header', async () => {
    const res = await request(app).get('/known');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('preserves an incoming X-Request-Id', async () => {
    const res = await request(app).get('/known').set('X-Request-Id', 'from-client-1');
    expect(res.headers['x-request-id']).toBe('from-client-1');
  });
});
