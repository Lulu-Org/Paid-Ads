import 'dotenv/config';
import { z } from 'zod';

// Optional vars that arrive as an empty string (e.g. docker-compose ${VAR:-}) mean "not set".
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

// Token signing secret for local development only, so `npm run dev` works without
// configuration. envSchema rejects it being absent in production, and seed demo
// passwords keep their dev defaults everywhere (the seed is sample data).
export const DEV_JWT_SECRET = 'lulu-dev-only-insecure-jwt-secret-do-not-ship';

export const adsProviderModeSchema = z.enum(['simulated', 'live']);
export type AdsProviderMode = z.infer<typeof adsProviderModeSchema>;

const providerMode = () =>
  z.preprocess(emptyToUndefined, adsProviderModeSchema.default('simulated'));

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
    // Per-platform provider mode. Google LSA is live-capable (C1); `live` fails fast for the
    // other platforms until their provider exists (C2-C4).
    ADS_PROVIDER_GOOGLE_LSA: providerMode(),
    ADS_PROVIDER_GOOGLE_ADS: providerMode(),
    ADS_PROVIDER_META_ADS: providerMode(),
    ADS_PROVIDER_LINKEDIN_ADS: providerMode(),
    // AES-256-GCM key for ad-account tokens. Required in production; development uses a fallback.
    ADS_TOKEN_ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    // Google Ads API credentials. The three secrets are required when Google LSA runs live.
    GOOGLE_ADS_DEVELOPER_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GOOGLE_ADS_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GOOGLE_ADS_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    // Optional manager account id to send as login-customer-id.
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GOOGLE_ADS_API_VERSION: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^v\d+$/, 'must look like v26')
        .default('v26'),
    ),
    // Public base URL of this API, used to build the OAuth callback URL.
    API_PUBLIC_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    // LinkedIn Marketing API app (C4). Needed only when ADS_PROVIDER_LINKEDIN_ADS=live.
    LINKEDIN_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    LINKEDIN_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    // The monthly API version the connector is written against, e.g. 202610 (header LinkedIn-Version).
    LINKEDIN_API_VERSION: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
    ),
  })
  .superRefine((value, ctx) => {
    // A live LinkedIn connection needs the app credentials and an API version; never guess them.
    if (value.ADS_PROVIDER_LINKEDIN_ADS === 'live') {
      for (const key of [
        'LINKEDIN_CLIENT_ID',
        'LINKEDIN_CLIENT_SECRET',
        'LINKEDIN_API_VERSION',
      ] as const) {
        if (value[key] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when ADS_PROVIDER_LINKEDIN_ADS=live',
          });
        }
      }
    }
    // A real deployment must sign tokens with a real secret, never the dev fallback.
    if (value.NODE_ENV === 'production' && value.JWT_SECRET === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'is required in production',
      });
    }
    // Ad-account tokens must never be encrypted with the development fallback in production.
    if (value.NODE_ENV === 'production' && value.ADS_TOKEN_ENCRYPTION_KEY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADS_TOKEN_ENCRYPTION_KEY'],
        message: 'is required in production',
      });
    }
    // The live Google LSA connector cannot talk to Google without its OAuth client and token.
    if (value.ADS_PROVIDER_GOOGLE_LSA === 'live') {
      const required = [
        'GOOGLE_ADS_DEVELOPER_TOKEN',
        'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET',
      ] as const;
      for (const key of required) {
        if (value[key] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when ADS_PROVIDER_GOOGLE_LSA=live',
          });
        }
      }
    }
  })
  .transform((value) => ({
    ...value,
    API_PUBLIC_URL: value.API_PUBLIC_URL ?? `http://localhost:${value.PORT}`,
  }));

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
