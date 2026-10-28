import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { disconnectRedis, getRedisConnection } from './redis';
import { denyToken, isTokenDenied } from './tokenDenylist';

// The key layout is part of the module's contract: auth:denylist:<jti>.
const key = (jti: string) => `auth:denylist:${jti}`;

describe('token denylist (int)', () => {
  afterAll(async () => {
    await disconnectRedis();
  });

  it('remembers a denied token until it expires', async () => {
    const jti = randomUUID();
    await denyToken(jti, 60);

    await expect(isTokenDenied(jti)).resolves.toBe(true);

    const ttl = await getRedisConnection().ttl(key(jti));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    await getRedisConnection().del(key(jti));
  });

  it('drops the key when the token would already be expired', async () => {
    const jti = randomUUID();
    await expect(isTokenDenied(jti)).resolves.toBe(false);

    await denyToken(jti, 1);
    await expect(isTokenDenied(jti)).resolves.toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(isTokenDenied(jti)).resolves.toBe(false);
  });

  it('is a no-op for a non-positive ttl', async () => {
    const jti = randomUUID();
    await denyToken(jti, 0);
    await denyToken(jti, -30);
    await expect(isTokenDenied(jti)).resolves.toBe(false);
  });
});
