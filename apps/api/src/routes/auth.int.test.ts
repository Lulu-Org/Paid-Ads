import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { runSeed } from '../../prisma/seed';
import { createApp } from '../app';
import { env } from '../config/env';
import { db } from '../db/prisma';
import { disconnectRedis } from '../lib/redis';

const OWNER = { email: 'jamie.morgan@lulu.test', password: env.SEED_OWNER_PASSWORD };
const MEMBER = { email: 'alex.rivera@lulu.test', password: env.SEED_MEMBER_PASSWORD };

interface ErrorBody {
  error: { code: string; message: string };
}

interface UserBody {
  data: { email: string; name: string; role: string; language: string };
}

interface ListBody {
  data: Array<{ email: string }>;
  meta: { page: number; pageSize: number; total: number };
}

async function login(app: Express, credentials = OWNER): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send(credentials);
  expect(res.status).toBe(200);
  return (res.body as { data: { token: string } }).data.token;
}

describe('auth routes (int)', () => {
  const app = createApp();

  beforeAll(async () => {
    await runSeed();
  }, 180_000);

  afterAll(async () => {
    await db.$disconnect();
    await disconnectRedis();
  });

  it('logs in a seeded user and returns a usable token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(OWNER);
    expect(res.status).toBe(200);
    const body = res.body as { data: { token: string; expiresAt: string } };
    expect(typeof body.data.token).toBe('string');
    expect(Number.isNaN(Date.parse(body.data.expiresAt))).toBe(false);

    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body as UserBody).toMatchObject({
      data: {
        email: OWNER.email,
        name: 'Jamie Morgan',
        role: 'owner',
        language: 'en',
      },
    });
  });

  it('logs in the member too', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(MEMBER);
    expect(res.status).toBe(200);
  });

  it('answers the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER.email, password: 'not-the-password' });
    expect(wrongPassword.status).toBe(401);
    expect((wrongPassword.body as ErrorBody).error.code).toBe('UNAUTHORIZED');

    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@lulu.test', password: 'whatever' });
    expect(unknownEmail.status).toBe(401);
    expect((unknownEmail.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed login body with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER.email, password: '' });
    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a protected endpoint without a token', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('updates only the writable fields of the current user', async () => {
    const token = await login(app);

    const updated = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'de' });
    expect(updated.status).toBe(200);
    expect(updated.body as UserBody).toMatchObject({ data: { language: 'de', role: 'owner' } });

    // role is not writable: a body without name/language fails the refine.
    const roleOnly = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(roleOnly.status).toBe(400);

    await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'en' });
  });

  it('lists the workspace users with search and sort', async () => {
    const token = await login(app);

    const all = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect((all.body as ListBody).meta).toEqual({ page: 1, pageSize: 25, total: 3 });

    const search = await request(app)
      .get('/api/v1/users?q=alex')
      .set('Authorization', `Bearer ${token}`);
    const searchBody = search.body as ListBody;
    expect(searchBody.meta.total).toBe(1);
    expect(searchBody.data[0]).toMatchObject({ email: MEMBER.email });

    const badSort = await request(app)
      .get('/api/v1/users?sort=email')
      .set('Authorization', `Bearer ${token}`);
    expect(badSort.status).toBe(400);
  });

  it('revokes the token on logout', async () => {
    const token = await login(app);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(204);

    const after = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('lets a member call protected endpoints but not read the audit log', async () => {
    const memberToken = await login(app, MEMBER);

    // Alex is a member: reading their profile is fine, the audit log is for owners and admins.
    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${memberToken}`);
    expect(me.status).toBe(200);
    expect(me.body as UserBody).toMatchObject({ data: { email: MEMBER.email, role: 'member' } });

    const audit = await request(app)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(audit.status).toBe(403);
    expect((audit.body as ErrorBody).error.code).toBe('FORBIDDEN');

    const ownerToken = await login(app);
    const ownerAudit = await request(app)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerAudit.status).toBe(200);
  });
});
