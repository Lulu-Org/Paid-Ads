import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The DB row and Redis are the edges of the middleware; the token itself is
// signed and verified for real (the dev secret is used in tests).
const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  isTokenDenied: vi.fn(),
  permissionFindMany: vi.fn(),
}));

vi.mock('../services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth')>();
  return { ...actual, getUserById: mocks.getUserById };
});

vi.mock('../lib/tokenDenylist', () => ({
  isTokenDenied: mocks.isTokenDenied,
  denyToken: vi.fn(),
}));

vi.mock('../db/scoped', () => ({
  scopedDb: () => ({ permission: { findMany: mocks.permissionFindMany } }),
}));

import { signToken } from '../services/auth';
import { errorHandler } from '../middleware/errorHandler';
import { requireAuth, requirePermission } from './auth';

interface ErrorBody {
  error: { code: string; message: string };
}

const USER = { id: 'u-1', workspaceId: 'ws-1', role: 'member' as const };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/me', requireAuth, (req, res) => {
    res.status(200).json({ data: req.ctx });
  });
  app.delete('/contacts', requireAuth, requirePermission('campaigns', 'delete'), (_req, res) => {
    res.status(204).send();
  });
  app.get('/contacts', requireAuth, requirePermission('campaigns', 'view'), (_req, res) => {
    res.status(200).json({ data: [] });
  });
  app.use(errorHandler);
  return app;
}

const app = buildApp();

function tokenFor(role: 'owner' | 'admin' | 'member' = 'member'): string {
  // The DB row is what requireAuth trusts, so keep it in step with the claim.
  mocks.getUserById.mockResolvedValue({ ...USER, role });
  return signToken({ userId: USER.id, workspaceId: USER.workspaceId, role }).token;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue(USER);
  mocks.isTokenDenied.mockResolvedValue(false);
  mocks.permissionFindMany.mockResolvedValue([]);
});

describe('requireAuth', () => {
  it('rejects a missing Authorization header', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);

    const empty = await request(app).get('/me').set('Authorization', 'Bearer ');
    expect(empty.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const token = signToken(
      { userId: USER.id, workspaceId: USER.workspaceId, role: 'member' },
      '-10s',
    ).token;
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a denylisted token', async () => {
    mocks.isTokenDenied.mockResolvedValue(true);
    const res = await request(app).get('/me').set('Authorization', `Bearer ${tokenFor()}`);
    expect(res.status).toBe(401);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it('rejects a token for a user that no longer exists', async () => {
    const token = tokenFor();
    mocks.getUserById.mockResolvedValue(null);
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('sets req.ctx from the database row, not the token role', async () => {
    // Token claims owner, but the stored user is a member: the row wins.
    const token = signToken({
      userId: USER.id,
      workspaceId: USER.workspaceId,
      role: 'owner',
    }).token;
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { workspaceId: USER.workspaceId, userId: USER.id, role: 'member' },
    });
  });
});

describe('requirePermission', () => {
  it('lets a member view contacts but not delete them', async () => {
    const view = await request(app)
      .get('/contacts')
      .set('Authorization', `Bearer ${tokenFor('member')}`);
    expect(view.status).toBe(200);

    const remove = await request(app)
      .delete('/contacts')
      .set('Authorization', `Bearer ${tokenFor('member')}`);
    expect(remove.status).toBe(403);
    expect((remove.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('lets an admin delete contacts', async () => {
    const res = await request(app)
      .delete('/contacts')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(res.status).toBe(204);
  });

  it('lets the owner delete contacts', async () => {
    const res = await request(app)
      .delete('/contacts')
      .set('Authorization', `Bearer ${tokenFor('owner')}`);
    expect(res.status).toBe(204);
  });

  it('honours a workspace Permission row over the defaults', async () => {
    mocks.permissionFindMany.mockResolvedValue([
      { role: 'member', resource: 'campaigns', actions: ['view', 'delete'] },
    ]);
    const res = await request(app)
      .delete('/contacts')
      .set('Authorization', `Bearer ${tokenFor('member')}`);
    expect(res.status).toBe(204);
  });

  it('ignores an invalid Permission row and keeps the other defaults', async () => {
    mocks.permissionFindMany.mockResolvedValue([
      { role: 'member', resource: 'not-a-resource', actions: ['delete'] },
    ]);
    const view = await request(app)
      .get('/contacts')
      .set('Authorization', `Bearer ${tokenFor('member')}`);
    expect(view.status).toBe(200);

    const remove = await request(app)
      .delete('/contacts')
      .set('Authorization', `Bearer ${tokenFor('member')}`);
    expect(remove.status).toBe(403);
  });
});
