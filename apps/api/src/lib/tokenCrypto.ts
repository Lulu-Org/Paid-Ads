import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env, type Env } from '../config/env';

// Ad-account tokens are stored encrypted at rest (AGENTS.md rule 8). AES-256-GCM with a random IV
// per value and an auth tag; the payload is versioned so the format can change without a migration.
// The configured secret is stretched to a 32-byte key with SHA-256.

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;

export const DEV_TOKEN_ENCRYPTION_KEY = 'lulu-dev-only-insecure-token-key-do-not-ship';

export function resolveTokenEncryptionKey(
  config: Pick<Env, 'NODE_ENV' | 'ADS_TOKEN_ENCRYPTION_KEY'> = env,
): string {
  const key =
    config.ADS_TOKEN_ENCRYPTION_KEY ??
    (config.NODE_ENV === 'production' ? undefined : DEV_TOKEN_ENCRYPTION_KEY);
  if (key === undefined) {
    throw new Error('ADS_TOKEN_ENCRYPTION_KEY is required in production');
  }
  return key;
}

function keyBytes(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptToken(token: string, secret: string = resolveTokenEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBytes(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptToken(
  payload: string,
  secret: string = resolveTokenEncryptionKey(),
): string {
  const [version, ivPart, tagPart, ciphertextPart, ...rest] = payload.split('.');
  if (
    version !== VERSION ||
    ivPart === undefined ||
    tagPart === undefined ||
    ciphertextPart === undefined ||
    rest.length > 0
  ) {
    throw new Error('Invalid encrypted token payload');
  }

  const decipher = createDecipheriv(ALGORITHM, keyBytes(secret), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
