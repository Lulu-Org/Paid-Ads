import { randomUUID } from 'node:crypto';
import { type AuthSession, type Role, roleSchema } from '@lulu/shared';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env, resolveJwtSecret } from '../config/env';
import { db } from '../db/prisma';
import { AppError } from '../lib/errors';

export interface TokenClaims {
  userId: string;
  workspaceId: string;
  role: Role;
}

export interface VerifiedToken extends TokenClaims {
  jti: string;
  exp: number;
}

export function hashPassword(
  plain: string,
  rounds: number = env.PASSWORD_HASH_ROUNDS,
): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Signs a token for the user and returns it with its expiry, so the client knows
// when to log in again. Logout revokes the jti through lib/tokenDenylist.
export function signToken(claims: TokenClaims, ttl: string = env.AUTH_TOKEN_TTL): AuthSession {
  const options = { expiresIn: ttl } as SignOptions;
  const token = jwt.sign({ ...claims, jti: randomUUID() }, resolveJwtSecret(env), options);
  const decoded = jwt.decode(token) as JwtPayload | null;
  const exp =
    decoded !== null && typeof decoded.exp === 'number'
      ? decoded.exp
      : Math.floor(Date.now() / 1000);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyToken(token: string): VerifiedToken {
  let decoded: JwtPayload | string;
  try {
    decoded = jwt.verify(token, resolveJwtSecret(env));
  } catch {
    throw AppError.unauthorized();
  }
  if (typeof decoded === 'string') {
    throw AppError.unauthorized();
  }
  const { userId, workspaceId, jti, exp } = decoded;
  const role = roleSchema.safeParse(decoded.role);
  if (
    typeof userId !== 'string' ||
    typeof workspaceId !== 'string' ||
    typeof jti !== 'string' ||
    typeof exp !== 'number' ||
    !role.success
  ) {
    throw AppError.unauthorized();
  }
  return { userId, workspaceId, role: role.data, jti, exp };
}

// Unknown email and wrong password answer the same UNAUTHORIZED, so login never
// says which part was wrong.
export async function login(email: string, password: string): Promise<AuthSession> {
  const user = await db.user.findUnique({ where: { email } });
  if (user === null || user.deletedAt !== null || user.passwordHash === null) {
    throw AppError.unauthorized();
  }
  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) {
    throw AppError.unauthorized();
  }
  return signToken({ userId: user.id, workspaceId: user.workspaceId, role: user.role });
}

export function getUserById(id: string) {
  return db.user.findFirst({ where: { id, deletedAt: null } });
}
