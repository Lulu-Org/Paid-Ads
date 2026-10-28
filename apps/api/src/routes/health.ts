import type { DependencyStatus, HealthStatus as HealthStatusBody } from '@lulu/shared';
import type { Request, RequestHandler, Response } from 'express';
import { db } from '../db/prisma';
import { getRedisConnection } from '../lib/redis';

export interface HealthChecks {
  database: () => Promise<void>;
  redis: () => Promise<void>;
}

export type { DependencyStatus };

export type HealthStatus = HealthStatusBody;

export const CHECK_TIMEOUT_MS = 2000;

export async function withTimeout(fn: () => Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('health check timed out')), timeoutMs);
  });
  try {
    await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export const defaultHealthChecks: HealthChecks = {
  database: async () => {
    await db.$queryRaw`SELECT 1`;
  },
  redis: async () => {
    await getRedisConnection().ping();
  },
};

async function runCheck(check: () => Promise<void>, timeoutMs: number): Promise<DependencyStatus> {
  try {
    await withTimeout(check, timeoutMs);
    return 'ok';
  } catch {
    return 'down';
  }
}

export async function getHealthStatus(
  checks: HealthChecks = defaultHealthChecks,
  timeoutMs: number = CHECK_TIMEOUT_MS,
): Promise<HealthStatus> {
  const [database, redis] = await Promise.all([
    runCheck(checks.database, timeoutMs),
    runCheck(checks.redis, timeoutMs),
  ]);
  const status = database === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
  return { data: { status, checks: { database, redis } } };
}

export function createHealthHandler(
  checks: HealthChecks = defaultHealthChecks,
  timeoutMs: number = CHECK_TIMEOUT_MS,
): RequestHandler {
  return (_req: Request, res: Response, next) => {
    void getHealthStatus(checks, timeoutMs)
      .then((result) => {
        res.status(result.data.status === 'ok' ? 200 : 503).json(result);
      })
      .catch(next);
  };
}

export function liveHandler(_req: Request, res: Response): void {
  res.status(200).json({ data: { status: 'ok' } });
}
