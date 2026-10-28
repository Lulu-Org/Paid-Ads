import type { Prisma } from '../src/generated/prisma/client';
import { db, disconnectDb } from '../src/db/prisma';
import { env } from '../src/config/env';
import { hashPassword } from '../src/services/auth';
import { SEED_ALEX_ID, SEED_JAMIE_ID, SEED_WORKSPACE_ID } from './seed-ids';

// The demo workspace and its two sign-in users (the design's Jamie Morgan and Alex Rivera). Every
// row has a fixed id from seed-ids.ts and is upserted, so running the seed twice adds nothing.
// The Paid Ads sample data from the design (campaigns, metrics, ...) is added with task B1.

type WithId<T> = T & { id: string };

const workspace: WithId<Prisma.WorkspaceUncheckedCreateInput> = {
  id: SEED_WORKSPACE_ID,
  name: 'Lulu demo',
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
};

const users: WithId<Prisma.UserUncheckedCreateInput>[] = [
  {
    id: SEED_JAMIE_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Jamie Morgan',
    email: 'jamie.morgan@lulu.test',
    role: 'owner',
  },
  {
    id: SEED_ALEX_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Alex Rivera',
    email: 'alex.rivera@lulu.test',
    role: 'member',
  },
];

async function upsertMany<T extends { id: string }>(
  rows: T[],
  upsert: (id: string, data: Omit<T, 'id'>, create: T) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    const { id, ...data } = row;
    await upsert(id, data, row);
  }
}

// Passwords are hashed fresh on every run (new salt), so the seed stays
// idempotent: the same two users, each with a non-null passwordHash.
async function usersWithPasswords(): Promise<WithId<Prisma.UserUncheckedCreateInput>[]> {
  return Promise.all(
    users.map(async (user) => ({
      ...user,
      passwordHash: await hashPassword(
        user.id === SEED_JAMIE_ID ? env.SEED_OWNER_PASSWORD : env.SEED_MEMBER_PASSWORD,
      ),
    })),
  );
}

export async function runSeed(): Promise<void> {
  await upsertMany([workspace], (id, data, create) =>
    db.workspace.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(await usersWithPasswords(), (id, data, create) =>
    db.user.upsert({ where: { id }, update: data, create }),
  );
  console.log(`Workspaces: 1`);
  console.log(`Users: ${users.length}`);
  console.log('Seed complete');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && /prisma[\\/]seed\.(ts|js)$/.test(process.argv[1]);

if (invokedDirectly) {
  runSeed()
    .catch((err: unknown) => {
      console.error('Seed failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => disconnectDb());
}
