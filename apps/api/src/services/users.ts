import type { User } from '@lulu/shared';
import type { User as UserRow } from '../generated/prisma/client';

// The row also carries passwordHash; the API never selects or returns it.
export type PublicUserRow = Pick<
  UserRow,
  | 'id'
  | 'workspaceId'
  | 'name'
  | 'email'
  | 'role'
  | 'language'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
>;

export function toUserDto(row: PublicUserRow): User {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    email: row.email,
    role: row.role,
    language: row.language,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
  };
}
