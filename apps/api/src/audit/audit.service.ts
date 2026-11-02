import { Injectable } from '@nestjs/common';
import type { ActorType } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma.service.js';

export type AuditAction =
  | 'auth.signup'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.refresh_reuse'
  | 'auth.password_reset'
  | 'workspace.settings_updated'
  | 'member.invited'
  | 'member.invite_revoked'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'template.created'
  | 'template.updated'
  | 'template.deleted'
  | 'request.created'
  | 'request.sent'
  | 'request.link_resent'
  | 'request.updated'
  | 'request.items_updated'
  | 'request.cancelled'
  | 'request.deleted'
  | 'request.completed'
  | 'client.opened'
  | 'client.verified'
  | 'file.uploaded'
  | 'file.removed'
  | 'file.infected'
  | 'file.unreadable'
  | 'file.viewed'
  | 'file.downloaded'
  | 'item.accepted'
  | 'item.rejected'
  | 'export.created'
  | 'export.downloaded'
  | 'reminder.sent'
  | 'request.expired'
  | 'retention.files_deleted';

export interface AuditEntry {
  workspaceId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** Links the entry to a request for its activity feed. */
  requestId?: string | null;
}

/**
 * Append-only audit log. Only ids and action names are stored:
 * never client names, emails, file names or file contents.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({ data: entry });
  }
}
