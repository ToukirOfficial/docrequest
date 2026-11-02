import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AcceptInviteInput,
  CreateInviteInput,
  InvitePreview,
  Member,
  PendingInvite,
  UpdateMemberInput,
  UpdateSettingsInput,
  WorkspaceSettings,
} from '@docrequest/shared';
import { env } from '../config/env.js';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { randomToken, sha256 } from '../common/crypto.js';
import type { AuthUser, WorkspaceMember } from '../common/decorators.js';
import { hashPassword } from '../auth/passwords.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async getSettings(member: WorkspaceMember): Promise<WorkspaceSettings> {
    const w = await this.prisma.workspace.findUniqueOrThrow({ where: { id: member.workspaceId } });
    return toSettings(w);
  }

  async updateSettings(member: WorkspaceMember, user: AuthUser, input: UpdateSettingsInput): Promise<WorkspaceSettings> {
    this.denyDemo(member);
    const w = await this.prisma.workspace.update({ where: { id: member.workspaceId }, data: input });
    await this.audit.log({
      workspaceId: member.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      action: 'workspace.settings_updated',
      entityType: 'workspace',
      entityId: member.workspaceId,
    });
    return toSettings(w);
  }

  async listMembers(member: WorkspaceMember): Promise<Member[]> {
    const rows = await this.prisma.membership.findMany({
      where: { workspaceId: member.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async updateMember(member: WorkspaceMember, user: AuthUser, memberId: string, input: UpdateMemberInput): Promise<Member> {
    this.denyDemo(member);
    const target = await this.findTarget(member, memberId);
    this.assertCanManage(member, target.role, target.id);
    const updated = await this.prisma.membership.update({
      where: { id: target.id },
      data: { role: input.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.audit.log({
      workspaceId: member.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      action: 'member.role_changed',
      entityType: 'membership',
      entityId: target.id,
    });
    return {
      id: updated.id,
      userId: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async removeMember(member: WorkspaceMember, user: AuthUser, memberId: string): Promise<void> {
    this.denyDemo(member);
    const target = await this.findTarget(member, memberId);
    this.assertCanManage(member, target.role, target.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: target.id } });
      await this.audit.log(
        { workspaceId: member.workspaceId, actorType: 'USER', actorId: user.id, action: 'member.removed', entityType: 'membership', entityId: target.id },
        tx,
      );
    });
  }

  async listInvites(member: WorkspaceMember): Promise<PendingInvite[]> {
    const rows = await this.prisma.invite.findMany({
      where: { workspaceId: member.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
  }

  async createInvite(member: WorkspaceMember, user: AuthUser, input: CreateInviteInput): Promise<PendingInvite> {
    this.denyDemo(member);
    const already = await this.prisma.membership.findFirst({
      where: { workspaceId: member.workspaceId, user: { email: input.email } },
    });
    if (already) throw new ConflictException('This person is already in your team');

    const token = randomToken();
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: member.workspaceId } });
    const invite = await this.prisma.$transaction(async (tx) => {
      // A new invite replaces any older pending one for the same email.
      await tx.invite.deleteMany({ where: { workspaceId: member.workspaceId, email: input.email, acceptedAt: null } });
      const invite = await tx.invite.create({
        data: {
          workspaceId: member.workspaceId,
          email: input.email,
          role: input.role,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          createdById: user.id,
        },
      });
      await this.audit.log(
        { workspaceId: member.workspaceId, actorType: 'USER', actorId: user.id, action: 'member.invited', entityType: 'invite', entityId: invite.id },
        tx,
      );
      return invite;
    });
    await this.mail.send(mailTemplates.invite(input.email, workspace.name, `${env.WEB_ORIGIN}/invite/${token}`));
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async revokeInvite(member: WorkspaceMember, user: AuthUser, inviteId: string): Promise<void> {
    this.denyDemo(member);
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, workspaceId: member.workspaceId, acceptedAt: null },
    });
    if (!invite) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.invite.delete({ where: { id: invite.id } });
      await this.audit.log(
        { workspaceId: member.workspaceId, actorType: 'USER', actorId: user.id, action: 'member.invite_revoked', entityType: 'invite', entityId: invite.id },
        tx,
      );
    });
  }

  async previewInvite(token: string): Promise<InvitePreview> {
    const invite = await this.findValidInvite(token);
    const existing = await this.prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
    return {
      workspaceName: invite.workspace.name,
      email: invite.email,
      role: invite.role,
      existingUser: Boolean(existing),
    };
  }

  /**
   * Existing users must be signed in as the invited email.
   * New users choose a name and password, then sign in normally (with a code).
   */
  async acceptInvite(token: string, input: AcceptInviteInput, caller: AuthUser | undefined): Promise<void> {
    const invite = await this.findValidInvite(token);
    const existing = await this.prisma.user.findUnique({ where: { email: invite.email } });

    let userId: string;
    if (existing) {
      if (!caller || caller.id !== existing.id) {
        throw new UnauthorizedException('Please sign in with the invited email address to accept');
      }
      userId = existing.id;
    } else {
      if (!input.name || !input.password) throw new BadRequestException('Name and password are required');
      const passwordHash = await hashPassword(input.password);
      const created = await this.prisma.user.create({
        data: { email: invite.email, name: input.name, passwordHash },
      });
      userId = created.id;
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new GoneException('This invite has already been used');
      const membership = await tx.membership.upsert({
        where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
        create: { userId, workspaceId: invite.workspaceId, role: invite.role },
        update: {},
      });
      await this.audit.log(
        { workspaceId: invite.workspaceId, actorType: 'USER', actorId: userId, action: 'member.joined', entityType: 'membership', entityId: membership.id },
        tx,
      );
    });
  }

  private async findValidInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: sha256(token) },
      include: { workspace: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw new NotFoundException('This invite link is invalid or has expired');
    }
    return invite;
  }

  private async findTarget(member: WorkspaceMember, memberId: string) {
    const target = await this.prisma.membership.findFirst({
      where: { id: memberId, workspaceId: member.workspaceId },
    });
    if (!target) throw new NotFoundException();
    return target;
  }

  /** Nobody changes the Owner or themselves; Admins can only manage Staff. */
  private assertCanManage(actor: WorkspaceMember, targetRole: string, targetId: string): void {
    if (targetId === actor.membershipId) throw new ForbiddenException('You cannot change your own membership');
    if (targetRole === 'OWNER') throw new ForbiddenException('The owner cannot be changed');
    if (actor.role === 'ADMIN' && targetRole !== 'STAFF') {
      throw new ForbiddenException('Admins can only manage staff');
    }
  }

  private denyDemo(member: WorkspaceMember): void {
    if (member.isDemo) throw new ForbiddenException('Settings and team are read-only in the demo');
  }
}

function toSettings(w: {
  id: string;
  name: string;
  reminderDays: number[];
  dueReminderDays: number;
  retentionDays: number;
  linkExpiryDays: number;
}): WorkspaceSettings {
  return {
    id: w.id,
    name: w.name,
    reminderDays: w.reminderDays,
    dueReminderDays: w.dueReminderDays,
    retentionDays: w.retentionDays,
    linkExpiryDays: w.linkExpiryDays,
  };
}
