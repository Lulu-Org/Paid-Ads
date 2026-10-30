import { randomUUID } from 'node:crypto';
import { adPlatformSchema, type AdPlatform } from '@lulu/shared';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env, resolveJwtSecret } from '../config/env';
import { AppError } from './errors';
import { getRedisConnection } from './redis';

// Signed, short-lived OAuth state for the ad-account callback. The signature proves we started the
// flow; the jti is stored in Redis and consumed with GETDEL, so a callback URL cannot be replayed.

export const OAUTH_STATE_PREFIX = 'ads:oauth:state:';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export interface OAuthStateInput {
  workspaceId: string;
  userId: string;
  platform: AdPlatform;
}

export interface OAuthState extends OAuthStateInput {
  jti: string;
}

export interface OAuthStateStore {
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  getdel(key: string): Promise<string | null>;
}

const redisStore: OAuthStateStore = {
  set: (key, value, ttlSeconds) => getRedisConnection().set(key, value, 'EX', ttlSeconds),
  getdel: (key) => getRedisConnection().getdel(key),
};

export interface OAuthStateOptions {
  store?: OAuthStateStore;
  secret?: string;
  ttlSeconds?: number;
}

const stateKey = (jti: string) => `${OAUTH_STATE_PREFIX}${jti}`;

export async function signOAuthState(
  input: OAuthStateInput,
  options: OAuthStateOptions = {},
): Promise<string> {
  const jti = randomUUID();
  const ttlSeconds = options.ttlSeconds ?? OAUTH_STATE_TTL_SECONDS;
  const store = options.store ?? redisStore;
  await store.set(
    stateKey(jti),
    JSON.stringify({
      workspaceId: input.workspaceId,
      userId: input.userId,
      platform: input.platform,
    }),
    Math.max(1, ttlSeconds),
  );

  const signOptions = { expiresIn: ttlSeconds } as SignOptions;
  return jwt.sign(
    { workspaceId: input.workspaceId, userId: input.userId, platform: input.platform, jti },
    options.secret ?? resolveJwtSecret(env),
    signOptions,
  );
}

export async function verifyOAuthState(
  token: string,
  options: OAuthStateOptions = {},
): Promise<OAuthState> {
  let decoded: JwtPayload | string;
  try {
    decoded = jwt.verify(token, options.secret ?? resolveJwtSecret(env));
  } catch {
    throw AppError.unauthorized();
  }
  if (typeof decoded === 'string') {
    throw AppError.unauthorized();
  }

  const { workspaceId, userId, platform, jti } = decoded;
  const parsedPlatform = adPlatformSchema.safeParse(platform);
  if (
    typeof workspaceId !== 'string' ||
    typeof userId !== 'string' ||
    typeof jti !== 'string' ||
    !parsedPlatform.success
  ) {
    throw AppError.unauthorized();
  }

  const store = options.store ?? redisStore;
  const stored = await store.getdel(stateKey(jti));
  if (stored === null) {
    throw AppError.unauthorized();
  }

  return { workspaceId, userId, platform: parsedPlatform.data, jti };
}
