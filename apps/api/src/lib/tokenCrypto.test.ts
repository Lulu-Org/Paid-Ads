import { describe, expect, it } from 'vitest';
import {
  decryptToken,
  DEV_TOKEN_ENCRYPTION_KEY,
  encryptToken,
  resolveTokenEncryptionKey,
} from './tokenCrypto';

const KEY = 'test-token-encryption-key-with-enough-length';

describe('tokenCrypto', () => {
  it('round-trips a token and uses a fresh IV each time', () => {
    const first = encryptToken('access-token-value', KEY);
    const second = encryptToken('access-token-value', KEY);

    expect(first).not.toBe(second);
    expect(first.startsWith('v1.')).toBe(true);
    expect(decryptToken(first, KEY)).toBe('access-token-value');
    expect(decryptToken(second, KEY)).toBe('access-token-value');
  });

  it('detects tampering with the ciphertext or auth tag', () => {
    const payload = encryptToken('access-token-value', KEY);
    const parts = payload.split('.');
    const ciphertext = parts[3]!;
    const tampered = [...parts];
    tampered[3] = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;

    expect(() => decryptToken(tampered.join('.'), KEY)).toThrow();
  });

  it('rejects a payload encrypted with a different key', () => {
    const payload = encryptToken('access-token-value', KEY);
    expect(() => decryptToken(payload, 'a-different-key')).toThrow();
  });

  it('rejects an unknown version or malformed payload', () => {
    expect(() => decryptToken('v2.a.b.c', KEY)).toThrow('Invalid encrypted token payload');
    expect(() => decryptToken('not-a-payload', KEY)).toThrow('Invalid encrypted token payload');
  });

  it('falls back to the development key outside production and refuses to in production', () => {
    expect(resolveTokenEncryptionKey({ NODE_ENV: 'development' })).toBe(DEV_TOKEN_ENCRYPTION_KEY);
    expect(
      resolveTokenEncryptionKey({
        NODE_ENV: 'production',
        ADS_TOKEN_ENCRYPTION_KEY: 'production-key',
      }),
    ).toBe('production-key');
    expect(() => resolveTokenEncryptionKey({ NODE_ENV: 'production' })).toThrow(
      'ADS_TOKEN_ENCRYPTION_KEY is required in production',
    );
  });
});
