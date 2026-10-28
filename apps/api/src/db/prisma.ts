import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';
import { withAudit } from './audit';

export type Db = PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: Db };

function createClient(): Db {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  // Every write also records an audit row and a domain event (db/audit.ts).
  return withAudit(new PrismaClient({ adapter }));
}

export const db: Db = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
  delete globalForPrisma.prisma;
}
