import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './prisma';
import { scopedDb } from './scoped';

describe('scopedDb', () => {
  let workspaceA: string;
  let workspaceB: string;

  beforeAll(async () => {
    const a = await db.workspace.create({ data: { name: `scope-a-${randomUUID()}` } });
    const b = await db.workspace.create({ data: { name: `scope-b-${randomUUID()}` } });
    workspaceA = a.id;
    workspaceB = b.id;
  });

  afterAll(async () => {
    await db.webhookEvent.deleteMany({ where: { workspaceId: { in: [workspaceA, workspaceB] } } });
    await db.user.deleteMany({ where: { workspaceId: { in: [workspaceA, workspaceB] } } });
    await db.workspace.deleteMany({ where: { id: { in: [workspaceA, workspaceB] } } });
    await db.$disconnect();
  });

  let counter = 0;
  beforeEach(() => {
    counter += 1;
  });

  function liveUserData(workspaceId: string, suffix = '') {
    return {
      workspaceId,
      name: `Test User ${counter}${suffix}`,
      email: `user-${counter}-${randomUUID()}@example.test`,
    };
  }

  it('does not return a workspace A user through scopedDb(B)', async () => {
    const created = await db.user.create({ data: liveUserData(workspaceA) });
    const other = scopedDb(workspaceB);

    const byUnique = await other.user.findUnique({ where: { id: created.id } });
    const byEmail = await other.user.findUnique({ where: { email: created.email } });
    const byList = await other.user.findMany({ where: { id: created.id } });

    expect(byUnique).toBeNull();
    expect(byEmail).toBeNull();
    expect(byList).toEqual([]);

    await db.user.delete({ where: { id: created.id } });
  });

  it('hides soft-deleted rows from findMany and count', async () => {
    const scoped = scopedDb(workspaceA);
    const u1 = await scoped.user.create({ data: liveUserData(workspaceA) });
    const u2 = await scoped.user.create({ data: liveUserData(workspaceA) });

    await scoped.user.delete({ where: { id: u1.id } });

    const remaining = await scoped.user.findMany({ where: { id: { in: [u1.id, u2.id] } } });
    const counted = await scoped.user.count({ where: { id: { in: [u1.id, u2.id] } } });

    expect(remaining.map((u) => u.id)).toEqual([u2.id]);
    expect(counted).toBe(1);

    await db.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  });

  it('delete sets deletedAt instead of removing the row', async () => {
    const scoped = scopedDb(workspaceA);
    const created = await scoped.user.create({ data: liveUserData(workspaceA) });

    const deleted = await scoped.user.delete({ where: { id: created.id } });
    expect(deleted.id).toBe(created.id);

    const viaBase = await db.user.findUnique({ where: { id: created.id } });
    expect(viaBase).not.toBeNull();
    expect(viaBase?.deletedAt).not.toBeNull();

    await db.user.delete({ where: { id: created.id } });
  });

  it('rejects create with a mismatched workspaceId', async () => {
    const scoped = scopedDb(workspaceA);

    await expect(scoped.user.create({ data: liveUserData(workspaceB) })).rejects.toThrow(
      /WORKSPACE_MISMATCH/,
    );

    await expect(
      scoped.user.createMany({ data: [liveUserData(workspaceA), liveUserData(workspaceB)] }),
    ).rejects.toThrow(/WORKSPACE_MISMATCH/);
  });

  it('updateMany with another workspace id affects zero rows', async () => {
    const scoped = scopedDb(workspaceA);
    const inB = await db.user.create({ data: liveUserData(workspaceB) });

    const result = await scoped.user.updateMany({
      where: { id: inB.id },
      data: { name: 'Hijacked' },
    });

    expect(result.count).toBe(0);
    const unchanged = await db.user.findUnique({ where: { id: inB.id } });
    expect(unchanged?.name).not.toBe('Hijacked');

    await db.user.delete({ where: { id: inB.id } });
  });

  it('keeps settings isolated between workspaces', async () => {
    const scopedA = scopedDb(workspaceA);
    const scopedB = scopedDb(workspaceB);
    const key = `test-${randomUUID()}`;

    const settingA = await scopedA.setting.create({
      data: { workspaceId: workspaceA, key, value: { on: true } },
    });

    const viaBUnique = await scopedB.setting.findUnique({ where: { id: settingA.id } });
    const viaBList = await scopedB.setting.findMany({ where: { key } });
    const viaA = await scopedA.setting.findUnique({ where: { id: settingA.id } });

    expect(viaBUnique).toBeNull();
    expect(viaBList).toEqual([]);
    expect(viaA?.id).toBe(settingA.id);

    await db.setting.delete({ where: { id: settingA.id } });
  });

  it('soft-deletes and scopes operational tables', async () => {
    const scopedA = scopedDb(workspaceA);
    const scopedB = scopedDb(workspaceB);

    const event = await scopedA.webhookEvent.create({
      data: { workspaceId: workspaceA, platform: 'google_ads', eventType: 'test.event' },
    });

    expect(await scopedA.webhookEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
    expect(await scopedB.webhookEvent.findUnique({ where: { id: event.id } })).toBeNull();

    await scopedA.webhookEvent.delete({ where: { id: event.id } });

    expect(await scopedA.webhookEvent.findMany({ where: { id: event.id } })).toEqual([]);
    expect(await scopedA.webhookEvent.count({ where: { id: event.id } })).toBe(0);

    const viaBase = await db.webhookEvent.findUnique({ where: { id: event.id } });
    expect(viaBase?.deletedAt).not.toBeNull();

    await db.webhookEvent.delete({ where: { id: event.id } });
  });
});
