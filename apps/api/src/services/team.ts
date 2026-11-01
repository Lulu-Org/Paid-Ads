import { randomUUID } from 'node:crypto';
import type { TeamInviteInput, TeamMember, TeamMemberUpdateInput } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import type { Prisma } from '../generated/prisma/client';
import { hashPassword } from './auth';

// Team and Paid Ads roles (docs/api.md "team").

type MemberRow = Prisma.TeamMemberGetPayload<{ include: { user: true } }>;

function toTeamMemberDto(row: MemberRow): TeamMember {
  return {
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    title: row.title,
    adsRole: row.adsRole as TeamMember['adsRole'],
    channelScope: row.channelScope as TeamMember['channelScope'],
    canApproveCreatives: row.canApproveCreatives,
    invited: row.joinedAt === null,
  };
}

export async function listTeam(ctx: RequestContext): Promise<TeamMember[]> {
  const rows = await scopedDb(ctx.workspaceId).teamMember.findMany({
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toTeamMemberDto);
}

// Invites by email. A person with no account yet gets one that cannot sign in until a password is set.
export async function inviteTeammate(
  ctx: RequestContext,
  input: TeamInviteInput,
): Promise<TeamMember> {
  const scoped = scopedDb(ctx.workspaceId);
  const email = input.email.toLowerCase();

  const found = await scoped.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  let user = found;
  if (user === null) {
    try {
      user = await scoped.user.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: email.split('@')[0] ?? email,
          email,
          passwordHash: await hashPassword(randomUUID()),
          role: 'member',
        },
      });
    } catch (error) {
      // The email already belongs to an account in another workspace.
      if ((error as { code?: string }).code === 'P2002') throw AppError.conflict('CONFLICT');
      throw error;
    }
  }

  const existing = await scoped.teamMember.findFirst({ where: { userId: user.id } });
  if (existing !== null) throw AppError.conflict('CONFLICT');

  const row = await scoped.teamMember.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: user.id,
      adsRole: input.adsRole,
      channelScope: input.channelScope,
      canApproveCreatives: input.canApproveCreatives,
      invitedAt: new Date(),
    },
    include: { user: true },
  });
  return toTeamMemberDto(row);
}

export async function updateTeamMember(
  ctx: RequestContext,
  userId: string,
  input: TeamMemberUpdateInput,
): Promise<TeamMember> {
  const scoped = scopedDb(ctx.workspaceId);
  const member = await scoped.teamMember.findFirst({ where: { userId } });
  if (member === null) throw AppError.notFound('NOT_FOUND');
  if (member.adsRole === 'owner') throw AppError.forbidden();

  const row = await scoped.teamMember.update({
    where: { id: member.id },
    data: {
      ...(input.adsRole === undefined ? {} : { adsRole: input.adsRole }),
      ...(input.channelScope === undefined ? {} : { channelScope: input.channelScope }),
      ...(input.canApproveCreatives === undefined
        ? {}
        : { canApproveCreatives: input.canApproveCreatives }),
    },
    include: { user: true },
  });
  return toTeamMemberDto(row);
}
