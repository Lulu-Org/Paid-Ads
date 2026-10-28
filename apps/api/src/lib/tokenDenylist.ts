// Server-side logout for stateless JWTs: a logged-out token's jti is remembered
// in Redis until the token's own expiry, so it can no longer be used.
import { getRedisConnection } from './redis';

const PREFIX = 'auth:denylist:';

export async function denyToken(jti: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  await getRedisConnection().set(`${PREFIX}${jti}`, '1', 'EX', Math.ceil(ttlSeconds));
}

export async function isTokenDenied(jti: string): Promise<boolean> {
  const found = await getRedisConnection().exists(`${PREFIX}${jti}`);
  return found === 1;
}
