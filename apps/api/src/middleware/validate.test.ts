import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { idSchema } from '@lulu/shared';
import { errorHandler } from './errorHandler';
import { TypedRequest, validate } from './validate';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: Array<{ path: string; code: string; message: string }>;
  };
}

const bodySchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
});
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().optional(),
});
const paramsSchema = z.object({
  id: idSchema,
});

const app = express();
app.use(express.json());

app.post('/body', validate({ body: bodySchema }), (req, res) => {
  const typed = req.body as z.infer<typeof bodySchema>;
  res.status(200).json({ data: { name: typed.name, age: typed.age } });
});

app.get('/query', validate({ query: querySchema }), (req, res) => {
  const typed = req.query as unknown as z.infer<typeof querySchema>;
  res.status(200).json({ data: typed });
});

app.get('/params/:id', validate({ params: paramsSchema }), (req, res) => {
  res.status(200).json({ data: req.params.id });
});

app.get('/typed/:id', validate({ params: paramsSchema, query: querySchema }), (req, res) => {
  const typed = req as unknown as TypedRequest<
    unknown,
    z.infer<typeof querySchema>,
    z.infer<typeof paramsSchema>
  >;
  res.status(200).json({ data: { id: typed.params.id, page: typed.query.page } });
});

app.use(errorHandler);

describe('validate middleware', () => {
  it('parses a valid body and exposes it on req.body', async () => {
    const res = await request(app).post('/body').send({ name: 'Ada', age: 36 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { name: 'Ada', age: 36 } });
  });

  it('rejects an invalid body with 400 VALIDATION_ERROR details', async () => {
    const badRes = await request(app).post('/body').send({ name: '', age: -1 });
    expect(badRes.status).toBe(400);
    const b = badRes.body as ErrorBody;
    expect(b.error.code).toBe('VALIDATION_ERROR');
    const paths = b.error.details.map((d) => d.path);
    expect(paths).toEqual(['name', 'age']);
  });

  it('coerces query parameters and applies defaults', async () => {
    const res = await request(app).get('/query');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { page: 1, q: undefined } });

    const res2 = await request(app).get('/query?page=3&q=%20Ada%20');
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ data: { page: 3, q: 'Ada' } });
  });

  it('rejects an invalid query value', async () => {
    const res = await request(app).get('/query?page=0');
    expect(res.status).toBe(400);
    const b = res.body as ErrorBody;
    expect(b.error.details[0]).toEqual(
      expect.objectContaining({ path: 'page', code: 'too_small' }),
    );
  });

  it('accepts any non-empty id, uuid or not', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get(`/params/${uuid}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: uuid });

    const res2 = await request(app).get('/params/row-17');
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ data: 'row-17' });
  });

  it('supports TypedRequest generics on handlers', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get(`/typed/${uuid}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { id: uuid, page: 1 } });
  });
});
