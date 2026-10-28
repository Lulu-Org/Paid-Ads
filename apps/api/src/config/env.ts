import 'dotenv/config';
import { z } from 'zod';

// Optional vars that arrive as an empty string (e.g. docker-compose ${VAR:-}) mean "not set".
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

// Token signing secret for local development only, so `npm run dev` works without
// configuration. envSchema rejects it being absent in production, and seed demo
// passwords keep their dev defaults everywhere (the seed is sample data).
export const DEV_JWT_SECRET = 'lulu-dev-only-insecure-jwt-secret-do-not-ship';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must start with redis:// or rediss://'),
    CORS_ORIGIN: z.url().default('http://localhost:3000'),
    JWT_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    AUTH_TOKEN_TTL: z.preprocess(emptyToUndefined, z.string().min(1).default('1h')),
    PASSWORD_HASH_ROUNDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(4).max(15).default(10),
    ),
    SEED_OWNER_PASSWORD: z.preprocess(
      emptyToUndefined,
      z.string().min(1).default('lulu-dev-owner'),
    ),
    SEED_MEMBER_PASSWORD: z.preprocess(
      emptyToUndefined,
      z.string().min(1).default('lulu-dev-member'),
    ),
    AI_PROVIDER: z.preprocess(emptyToUndefined, z.string().default('simulated')),
    AI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((value, ctx) => {
    // A real deployment must sign tokens with a real secret, never the dev fallback.
    if (value.NODE_ENV === 'production' && value.JWT_SECRET === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'is required in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment variables:\n${issues}`);
    process.exit(1);
  }
  if (
    result.data.NODE_ENV !== 'production' &&
    result.data.NODE_ENV !== 'test' &&
    result.data.JWT_SECRET === undefined
  ) {
    console.warn('[env] JWT_SECRET is not set; using the development fallback secret.');
  }
  return Object.freeze(result.data);
}

/** Secret tokens are signed with. Falls back to the dev secret outside production. */
export function resolveJwtSecret(config: Env): string {
  return config.JWT_SECRET ?? DEV_JWT_SECRET;
}

export const env: Env = parseEnv();
