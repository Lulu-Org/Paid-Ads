import Redis from 'ioredis';
import { env } from '../config/env';

export function createRedisConnection(): Redis {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5000,
    tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });
  connection.on('error', (err: Error) => {
    console.error(`[redis] connection error: ${err.message}`);
  });
  return connection;
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedisConnection(): Redis {
  globalForRedis.redis ??= createRedisConnection();
  return globalForRedis.redis;
}

export async function disconnectRedis(): Promise<void> {
  const connection = globalForRedis.redis;
  if (connection !== undefined) {
    delete globalForRedis.redis;
    await connection.quit();
  }
}
