// Bearer-token authentication and the role guard.
//
// requireAuth verifies the token, enforces the logout denylist, loads the user
// from the database (so a role change or deactivation takes effect at once) and
// sets req.ctx. requirePermission then checks the role against the workspace's
// permissions (the Permission table, or the shared defaults when it has none).
import {
  can,
  defaultPermissions,
  permissionActionSchema,
  permissionResourceSchema,
  type PermissionAction,
  type PermissionResource,
  type RolePermissions,
} from '@lulu/shared';
import type { RequestHandler } from 'express';
import { scopedDb } from '../db/scoped';
import { setActor } from '../lib/actorContext';
import { AppError } from '../lib/errors';
import { isTokenDenied } from '../lib/tokenDenylist';
import { getUserById, verifyToken } from '../services/auth';
import { requireContext } from './requestContext';

const BEARER_PREFIX = 'Bearer ';

export function readBearerToken(header: string | undefined): string {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw AppError.unauthorized();
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token === '') {
    throw AppError.unauthorized();
  }
  return token;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    try {
      const claims = verifyToken(readBearerToken(req.headers.authorization));
      if (await isTokenDenied(claims.jti)) {
        throw AppError.unauthorized();
      }
      const user = await getUserById(claims.userId);
      if (user === null) {
        throw AppError.unauthorized();
      }
      req.ctx = { workspaceId: user.workspaceId, userId: user.id, role: user.role };
      setActor({ actorType: 'user', actorId: user.id, workspaceId: user.workspaceId });
      next();
    } catch (err) {
      next(err);
    }
  })();
};

interface PermissionRow {
  role: string;
  resource: string;
  actions: string[];
}

function isPermissionAction(action: string): action is PermissionAction {
  return permissionActionSchema.safeParse(action).success;
}

/**
 * Effective permissions: the shared defaults, with each Permission row for the
 * workspace overriding one role + resource. A workspace with no rows uses the
 * defaults as-is. Owners always pass, handled inside `can`.
 */
export async function loadPermissions(workspaceId: string): Promise<RolePermissions> {
  const rows: PermissionRow[] = await scopedDb(workspaceId).permission.findMany();
  if (rows.length === 0) {
    return defaultPermissions;
  }
  const permissions: RolePermissions = {
    admin: { ...defaultPermissions.admin },
    member: { ...defaultPermissions.member },
  };
  for (const row of rows) {
    if (row.role !== 'admin' && row.role !== 'member') continue;
    const resource = permissionResourceSchema.safeParse(row.resource);
    if (!resource.success) continue;
    permissions[row.role] = {
      ...permissions[row.role],
      [resource.data]: row.actions.filter(isPermissionAction),
    };
  }
  return permissions;
}

// Runs after requireAuth. The role guard from AGENTS.md rule 2 and tasks.md task 2.
export function requirePermission(
  resource: PermissionResource,
  action: PermissionAction,
): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        const ctx = requireContext(req);
        const permissions = await loadPermissions(ctx.workspaceId);
        if (!can(permissions, ctx.role, resource, action)) {
          throw AppError.forbidden();
        }
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
