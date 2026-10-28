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
    });
    expect(withSecret.success).toBe(true);
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
