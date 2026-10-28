import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env, resolveJwtSecret } from '../config/env';
import { AppError } from '../lib/errors';
import { hashPassword, signToken, verifyPassword, verifyToken } from './auth';

const TEST_ROUNDS = 4;

describe('password hashing', () => {
  it('hashes to a bcrypt string that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple', TEST_ROUNDS);
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret', TEST_ROUNDS);
    await expect(verifyPassword('s3cret', hash)).resolves.toBe(true);
    await expect(verifyPassword('s3cretX', hash)).resolves.toBe(false);
  });

  it('salts each hash, so the same password hashes differently', async () => {
    const first = await hashPassword('s3cret', TEST_ROUNDS);
    const second = await hashPassword('s3cret', TEST_ROUNDS);
    expect(first).not.toBe(second);
  });
});

const claims = {
  userId: randomUUID(),
  workspaceId: randomUUID(),
  role: 'member' as const,
};

describe('signToken / verifyToken', () => {
  it('round-trips the claims, a fresh jti and an expiry', () => {
    const session = signToken(claims);
    expect(typeof session.token).toBe('string');
    expect(Number.isNaN(Date.parse(session.expiresAt))).toBe(false);

    const verified = verifyToken(session.token);
    expect(verified).toMatchObject(claims);
    expect(typeof verified.jti).toBe('string');
    expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('gives every token its own jti', () => {
    const first = verifyToken(signToken(claims).token);
    const second = verifyToken(signToken(claims).token);
    expect(first.jti).not.toBe(second.jti);
  });

  it('rejects a tampered token', () => {
    const { token } = signToken(claims);
    const index = Math.floor(token.length / 2);
    const original = token[index] ?? 'a';
    const tampered = `${token.slice(0, index)}${original === 'a' ? 'b' : 'a'}${token.slice(index + 1)}`;
    expect(() => verifyToken(tampered)).toThrow(AppError);
  });

  it('rejects an expired token', () => {
    const { token } = signToken(claims, '-10s');
    expect(() => verifyToken(token)).toThrow(AppError);
  });

  it('rejects a signed token whose claims are incomplete', () => {
    // Correctly signed, but with no jti, so it can never be revoked.
    const token = jwt.sign(claims, resolveJwtSecret(env));
    expect(() => verifyToken(token)).toThrow(AppError);
  });
});
