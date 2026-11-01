import { describe, expect, it } from 'vitest';
import { DEV_JWT_SECRET, envSchema, parseEnv, resolveJwtSecret } from './env';

const validSource = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/crm_test',
  REDIS_URL: 'redis://localhost:6379',
};

describe('envSchema', () => {
  it('applies defaults for PORT, CORS_ORIGIN and AI_PROVIDER', () => {
    const parsed = envSchema.parse(validSource);
    expect(parsed.PORT).toBe(4000);
    expect(parsed.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(parsed.AI_PROVIDER).toBe('simulated');
  });

  it('defaults every ad platform to the simulated provider and derives the public API URL', () => {
    const parsed = envSchema.parse(validSource);
    expect(parsed.ADS_PROVIDER_GOOGLE_LSA).toBe('simulated');
    expect(parsed.ADS_PROVIDER_GOOGLE_ADS).toBe('simulated');
    expect(parsed.ADS_PROVIDER_META_ADS).toBe('simulated');
    expect(parsed.ADS_PROVIDER_LINKEDIN_ADS).toBe('simulated');
    expect(parsed.API_PUBLIC_URL).toBe('http://localhost:4000');
  });

  it('derives the public API URL from PORT and accepts an override', () => {
    expect(envSchema.parse({ ...validSource, PORT: '8080' }).API_PUBLIC_URL).toBe(
      'http://localhost:8080',
    );
    expect(
      envSchema.parse({ ...validSource, API_PUBLIC_URL: 'https://api.lulu.test' }).API_PUBLIC_URL,
    ).toBe('https://api.lulu.test');
  });

  it('accepts simulated or live provider modes and rejects anything else', () => {
    expect(
      envSchema.parse({ ...validSource, ADS_PROVIDER_GOOGLE_ADS: 'live' }).ADS_PROVIDER_GOOGLE_ADS,
    ).toBe('live');
    expect(envSchema.safeParse({ ...validSource, ADS_PROVIDER_GOOGLE_ADS: 'real' }).success).toBe(
      false,
    );
  });

  it('defaults the Google Ads API version and leaves credentials unset', () => {
    const parsed = envSchema.parse(validSource);
    expect(parsed.GOOGLE_ADS_API_VERSION).toBe('v26');
    expect(parsed.GOOGLE_ADS_DEVELOPER_TOKEN).toBeUndefined();
    expect(parsed.GOOGLE_ADS_CLIENT_ID).toBeUndefined();
    expect(parsed.GOOGLE_ADS_CLIENT_SECRET).toBeUndefined();
    expect(parsed.GOOGLE_ADS_LOGIN_CUSTOMER_ID).toBeUndefined();
  });

  it('requires Google Ads credentials when Google LSA runs live', () => {
    const without = envSchema.safeParse({
      ...validSource,
      ADS_PROVIDER_GOOGLE_LSA: 'live',
    });
    expect(without.success).toBe(false);

    const withCredentials = envSchema.safeParse({
      ...validSource,
      ADS_PROVIDER_GOOGLE_LSA: 'live',
      GOOGLE_ADS_DEVELOPER_TOKEN: 'developer-token',
      GOOGLE_ADS_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_ADS_CLIENT_SECRET: 'client-secret',
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: '1234567890',
    });
    expect(withCredentials.success).toBe(true);
  });

  it('rejects a Google Ads API version that is not v<number>', () => {
    expect(envSchema.safeParse({ ...validSource, GOOGLE_ADS_API_VERSION: '26' }).success).toBe(
      false,
    );
    expect(
      envSchema.parse({ ...validSource, GOOGLE_ADS_API_VERSION: 'v27' }).GOOGLE_ADS_API_VERSION,
    ).toBe('v27');
  });

  it('coerces PORT to a number', () => {
    const parsed = envSchema.parse({ ...validSource, PORT: '8080' });
    expect(parsed.PORT).toBe(8080);
  });

  it('rejects a REDIS_URL that is not redis:// or rediss://', () => {
    const result = envSchema.safeParse({ ...validSource, REDIS_URL: 'http://localhost:6379' });
    expect(result.success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...validSource, JWT_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('accepts a JWT_SECRET of 32 characters or more', () => {
    const parsed = envSchema.parse({ ...validSource, JWT_SECRET: 'a'.repeat(32) });
    expect(parsed.JWT_SECRET).toBe('a'.repeat(32));
  });

  it('rejects an invalid DATABASE_URL', () => {
    const result = envSchema.safeParse({ ...validSource, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validSource, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('treats empty optional values as unset', () => {
    const parsed = envSchema.parse({
      ...validSource,
      JWT_SECRET: '',
      AI_API_KEY: '',
      AI_PROVIDER: '',
    });
    expect(parsed.JWT_SECRET).toBeUndefined();
    expect(parsed.AI_API_KEY).toBeUndefined();
    expect(parsed.AI_PROVIDER).toBe('simulated');
  });

  it('requires JWT_SECRET in production', () => {
    const without = envSchema.safeParse({ ...validSource, NODE_ENV: 'production' });
    expect(without.success).toBe(false);

    const withSecret = envSchema.safeParse({
      ...validSource,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      ADS_TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
    });
    expect(withSecret.success).toBe(true);
  });

  it('requires ADS_TOKEN_ENCRYPTION_KEY in production', () => {
    const without = envSchema.safeParse({
      ...validSource,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
    });
    expect(without.success).toBe(false);

    const withKey = envSchema.safeParse({
      ...validSource,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      ADS_TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
    });
    expect(withKey.success).toBe(true);
  });

  it('rejects a token key shorter than 32 characters', () => {
    expect(
      envSchema.safeParse({ ...validSource, ADS_TOKEN_ENCRYPTION_KEY: 'local-key' }).success,
    ).toBe(false);
    expect(
      envSchema.parse({ ...validSource, ADS_TOKEN_ENCRYPTION_KEY: 'a'.repeat(32) })
        .ADS_TOKEN_ENCRYPTION_KEY,
    ).toBe('a'.repeat(32));
  });

  it('applies auth and seed defaults', () => {
    const parsed = envSchema.parse(validSource);
    expect(parsed.AUTH_TOKEN_TTL).toBe('1h');
    expect(parsed.PASSWORD_HASH_ROUNDS).toBe(10);
    expect(parsed.SEED_OWNER_PASSWORD).toBe('lulu-dev-owner');
    expect(parsed.SEED_MEMBER_PASSWORD).toBe('lulu-dev-member');
  });

  it('coerces PASSWORD_HASH_ROUNDS and rejects out-of-range values', () => {
    expect(
      envSchema.parse({ ...validSource, PASSWORD_HASH_ROUNDS: '6' }).PASSWORD_HASH_ROUNDS,
    ).toBe(6);
    expect(envSchema.safeParse({ ...validSource, PASSWORD_HASH_ROUNDS: 'abc' }).success).toBe(
      false,
    );
    expect(envSchema.safeParse({ ...validSource, PASSWORD_HASH_ROUNDS: '2' }).success).toBe(false);
    expect(envSchema.parse({ ...validSource, PASSWORD_HASH_ROUNDS: '' }).PASSWORD_HASH_ROUNDS).toBe(
      10,
    );
  });
});

describe('resolveJwtSecret', () => {
  it('returns the configured secret, or the dev fallback when unset', () => {
    expect(resolveJwtSecret(envSchema.parse({ ...validSource, JWT_SECRET: 'a'.repeat(32) }))).toBe(
      'a'.repeat(32),
    );
    expect(resolveJwtSecret(envSchema.parse(validSource))).toBe(DEV_JWT_SECRET);
  });
});

describe('parseEnv', () => {
  it('returns a frozen object for valid input', () => {
    const parsed = parseEnv(validSource);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsed.NODE_ENV).toBe('test');
  });
});
