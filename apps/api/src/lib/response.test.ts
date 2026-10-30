import { Decimal } from '@prisma/client/runtime/client';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { accepted, created, noContent, ok, paginated } from './response';

const app = express();

app.get('/ok', (_req, res) => {
  ok(res, { hello: 'world' });
});
app.get('/ok-meta', (_req, res) => {
  ok(res, [1, 2], { page: 2, pageSize: 25, total: 100 });
});
app.get('/created', (_req, res) => {
  created(res, { id: '1' });
});
app.get('/accepted', (_req, res) => {
  accepted(res, { status: 'pending' });
});
app.get('/no-content', (_req, res) => {
  noContent(res);
});
app.get('/paginated', (_req, res) => {
  paginated(res, [{ id: '1' }], { page: 1, pageSize: 10, total: 1 });
});
app.get('/decimals', (_req, res) => {
  ok(res, {
    value: new Decimal('24000.00'),
    probability: new Decimal('0.7000'),
    deals: [{ value: new Decimal('0.10'), stage: 'open' }],
  });
});
app.get('/decimals-paginated', (_req, res) => {
  paginated(res, [{ value: new Decimal('12.50') }], { page: 1, pageSize: 10, total: 1 });
});

describe('response helpers', () => {
  it('ok sends 200 with data and omits meta when undefined', async () => {
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { hello: 'world' } });
    expect('meta' in res.body).toBe(false);
  });

  it('ok includes meta when given', async () => {
    const res = await request(app).get('/ok-meta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [1, 2], meta: { page: 2, pageSize: 25, total: 100 } });
  });

  it('created sends 201 with data', async () => {
    const res = await request(app).get('/created');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { id: '1' } });
  });

  it('accepted sends 202 with data', async () => {
    const res = await request(app).get('/accepted');
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ data: { status: 'pending' } });
  });

  it('noContent sends 204 with empty body', async () => {
    const res = await request(app).get('/no-content');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('paginated sends 200 with data and meta', async () => {
    const res = await request(app).get('/paginated');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ id: '1' }], meta: { page: 1, pageSize: 10, total: 1 } });
  });

  it('serializes Prisma Decimals as JSON numbers, not strings', async () => {
    const res = await request(app).get('/decimals');
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { value: number; probability: number; deals: Array<{ value: number; stage: string }> };
    };
    expect(body.data.value).toBe(24000);
    expect(typeof body.data.value).toBe('number');
    expect(body.data.probability).toBe(0.7);
    expect(typeof body.data.probability).toBe('number');
    expect(body.data.deals[0]?.value).toBe(0.1);
    expect(typeof body.data.deals[0]?.value).toBe('number');
    expect(body.data.deals[0]?.stage).toBe('open');
  });

  it('serializes Decimals inside paginated lists', async () => {
    const res = await request(app).get('/decimals-paginated');
    expect(res.status).toBe(200);
    const body = res.body as { data: Array<{ value: number }> };
    expect(body.data[0]?.value).toBe(12.5);
    expect(typeof body.data[0]?.value).toBe('number');
  });
});
