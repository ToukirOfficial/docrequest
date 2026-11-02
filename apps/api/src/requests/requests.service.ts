import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActivityEntry,
  CreateRequestInput,
  Dashboard,
  ListRequestsQuery,
  ReplaceItemsInput,
  RequestDetail,
  RequestList,
  RequestSummary,
  UpdateRequestInput,
  createRequestSchema,
  listRequestsQuerySchema,
  replaceItemsSchema,
  updateRequestSchema,
} from '@docrequest/shared';
import type { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import type { ItemStatus, RequestStatus } from '../generated/prisma/enums.js';
import { env } from '../config/env.js';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { randomToken, sha256 } from '../common/crypto.js';
import type { AuthUser, WorkspaceMember } from '../common/decorators.js';
import { DAY_MS, dateOnly, startOfWeekLondon, todayLondon } from '../common/dates.js';
import { refreshRequestStatus } from './request-state.js';

const PAGE_SIZE = 20;
const OPEN: RequestStatus[] = ['SENT', 'IN_PROGRESS'];
const EDITABLE: RequestStatus[] = ['DRAFT', 'SENT', 'IN_PROGRESS'];

const summaryInclude = {
  items: { select: { status: true, required: true } },
} satisfies Prisma.RequestInclude;
type SummaryRow = Prisma.RequestGetPayload<{ include: typeof summaryInclude }>;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async list(member: WorkspaceMember, query: ListRequestsQuery): Promise<RequestList> {
    const q = query as z.output<typeof listRequestsQuerySchema>;
    const where: Prisma.RequestWhereInput = {
      workspaceId: member.workspaceId,
      ...filterWhere(q.filter),
    };
    if (q.q) {
      where.OR = [
        { clientName: { contains: q.q, mode: 'insensitive' } },
        { clientEmail: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        include: summaryInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.request.count({ where }),
    ]);
    return { requests: rows.map(toSummary), total, page: q.page, pageSize: PAGE_SIZE };
  }

  async dashboard(member: WorkspaceMember): Promise<Dashboard> {
    const wid = member.workspaceId;
    const [open, toReview, overdue, completedThisWeek, attention, logs] = await Promise.all([
      this.prisma.request.count({ where: { workspaceId: wid, ...filterWhere('OPEN') } }),
      this.prisma.request.count({ where: { workspaceId: wid, ...filterWhere('REVIEW') } }),
      this.prisma.request.count({ where: { workspaceId: wid, ...filterWhere('OVERDUE') } }),
      this.prisma.request.count({
        where: { workspaceId: wid, status: 'COMPLETE', completedAt: { gte: startOfWeekLondon() } },
      }),
      this.prisma.request.findMany({
        where: {
          workspaceId: wid,
          status: { in: OPEN },
          OR: [{ dueDate: { lt: todayLondon() } }, { items: { some: { status: 'SUBMITTED' } } }],
        },
        include: summaryInclude,
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take: 6,
      }),
      this.prisma.auditLog.findMany({
        where: { workspaceId: wid, requestId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);
    return {
      stats: { open, toReview, overdue, completedThisWeek },
      attention: attention.map(toSummary),
      activity: await this.activity(wid, logs),
    };
  }

  async get(member: WorkspaceMember, requestId: string): Promise<RequestDetail> {
    const r = await this.prisma.request.findFirst({
      where: { id: requestId, workspaceId: member.workspaceId },
      include: { items: { orderBy: { position: 'asc' } }, createdBy: { select: { name: true } } },
    });
    if (!r) throw new NotFoundException('Request not found');
    return {
      ...toSummary(r),
      message: r.message,
      linkExpiresAt: r.linkExpiresAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      expiredAt: r.expiredAt?.toISOString() ?? null,
      filesDeletedAt: r.filesDeletedAt?.toISOString() ?? null,
      createdByName: r.createdBy?.name ?? null,
      items: r.items.map((i) => ({
        id: i.id,
        position: i.position,
        title: i.title,
        helpText: i.helpText,
        required: i.required,
        allowedTypes: i.allowedTypes,
        status: i.status,
        rejectReason: i.rejectReason,
      })),
    };
  }

  async create(
    member: WorkspaceMember,
    user: AuthUser,
    input: CreateRequestInput,
  ): Promise<RequestDetail> {
    const data = input as z.output<typeof createRequestSchema>;
    const created = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.create({
        data: {
          workspaceId: member.workspaceId,
          createdById: user.id,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          checklistName: data.checklistName,
          dueDate: data.dueDate ? dateOnly(data.dueDate) : null,
          message: data.message,
          items: {
            create: data.items.map((i, position) => ({
              ...i,
              position,
              workspaceId: member.workspaceId,
            })),
          },
        },
      });
      await this.log(tx, member, user, 'request.created', r.id);
      return r;
    });
    if (data.send) return this.send(member, user, created.id);
    return this.get(member, created.id);
  }

  async update(
    member: WorkspaceMember,
    user: AuthUser,
    requestId: string,
    input: UpdateRequestInput,
  ): Promise<RequestDetail> {
    const data = input as z.output<typeof updateRequestSchema>;
    const r = await this.findEditable(member, requestId);
    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: r.id },
        data: {
          ...data,
          dueDate:
            data.dueDate === undefined ? undefined : data.dueDate ? dateOnly(data.dueDate) : null,
        },
      });
      await this.log(tx, member, user, 'request.updated', r.id);
    });
    return this.get(member, r.id);
  }

  /**
   * Replace the checklist. Items keep their id (and any uploads) when sent back with it.
   * Items that already have files can't be removed.
   */
  async replaceItems(
    member: WorkspaceMember,
    user: AuthUser,
    requestId: string,
    input: ReplaceItemsInput,
  ): Promise<RequestDetail> {
    const data = input as z.output<typeof replaceItemsSchema>;
    const r = await this.findEditable(member, requestId);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.requestItem.findMany({ where: { requestId: r.id } });
      const byId = new Map(existing.map((i) => [i.id, i]));
      const keep = new Set<string>();
      for (const i of data.items) {
        if (i.id) {
          if (!byId.has(i.id))
            throw new BadRequestException(
              'One of the documents no longer exists. Reload and try again.',
            );
          keep.add(i.id);
        }
      }
      const removed = existing.filter((i) => !keep.has(i.id));
      if (removed.some((i) => i.status !== 'PENDING')) {
        throw new ConflictException('A document the client has already uploaded can’t be removed.');
      }
      await tx.requestItem.deleteMany({ where: { id: { in: removed.map((i) => i.id) } } });
      for (const [position, i] of data.items.entries()) {
        const fields = {
          title: i.title,
          helpText: i.helpText,
          required: i.required,
          allowedTypes: i.allowedTypes,
          position,
        };
        if (i.id) await tx.requestItem.update({ where: { id: i.id }, data: fields });
        else
          await tx.requestItem.create({
            data: { ...fields, requestId: r.id, workspaceId: member.workspaceId },
          });
      }
      await refreshRequestStatus(tx, r.id);
      await this.log(tx, member, user, 'request.items_updated', r.id);
    });
    return this.get(member, r.id);
  }

  /**
   * Sends (or re-sends) the client link. A new random token is made every time,
   * so older links stop working. Only its SHA-256 hash is stored.
   */
  async send(member: WorkspaceMember, user: AuthUser, requestId: string): Promise<RequestDetail> {
    const r = await this.findEditable(member, requestId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: member.workspaceId },
    });
    const itemCount = await this.prisma.requestItem.count({ where: { requestId: r.id } });
    if (itemCount === 0) throw new BadRequestException('Add at least one document before sending.');

    const token = randomToken();
    const now = Date.now();
    let expires = now + workspace.linkExpiryDays * DAY_MS;
    if (r.dueDate) expires = Math.max(expires, r.dueDate.getTime() + 8 * DAY_MS);
    const firstSend = r.status === 'DRAFT';

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: r.id },
        data: {
          linkHash: sha256(token),
          linkExpiresAt: new Date(expires),
          ...(firstSend ? { status: 'SENT', sentAt: new Date(now) } : {}),
        },
      });
      await this.log(tx, member, user, firstSend ? 'request.sent' : 'request.link_resent', r.id);
    });
    await this.mail.send(
      mailTemplates.requestLink(r.clientEmail, {
        clientName: r.clientName,
        workspaceName: workspace.name,
        itemCount,
        dueDate: r.dueDate,
        message: r.message,
        link: `${env.WEB_ORIGIN}/r/${token}`,
      }),
    );
    return this.get(member, r.id);
  }

  /** Stops the link working. Files are then deleted by the retention schedule. */
  async cancel(member: WorkspaceMember, user: AuthUser, requestId: string): Promise<RequestDetail> {
    const r = await this.findEditable(member, requestId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: r.id },
        data: { status: 'EXPIRED', expiredAt: now, linkExpiresAt: now },
      });
      await this.log(tx, member, user, 'request.cancelled', r.id);
    });
    return this.get(member, r.id);
  }

  /** Only drafts can be deleted outright; sent requests are cancelled instead. */
  async remove(member: WorkspaceMember, user: AuthUser, requestId: string): Promise<void> {
    const r = await this.find(member, requestId);
    if (r.status !== 'DRAFT')
      throw new ConflictException('Only drafts can be deleted. Cancel the request instead.');
    await this.prisma.$transaction(async (tx) => {
      await tx.request.delete({ where: { id: r.id } });
      await this.log(tx, member, user, 'request.deleted', r.id);
    });
  }

  private async find(member: WorkspaceMember, requestId: string) {
    const r = await this.prisma.request.findFirst({
      where: { id: requestId, workspaceId: member.workspaceId },
    });
    if (!r) throw new NotFoundException('Request not found');
    return r;
  }

  private async findEditable(member: WorkspaceMember, requestId: string) {
    const r = await this.find(member, requestId);
    if (!EDITABLE.includes(r.status)) {
      throw new ConflictException(
        r.status === 'COMPLETE'
          ? 'This request is complete and can’t be changed.'
          : 'This request has ended and can’t be changed.',
      );
    }
    return r;
  }

  private log(
    tx: Prisma.TransactionClient,
    member: WorkspaceMember,
    user: AuthUser,
    action: Parameters<AuditService['log']>[0]['action'],
    requestId: string,
  ): Promise<void> {
    return this.audit.log(
      {
        workspaceId: member.workspaceId,
        actorType: 'USER',
        actorId: user.id,
        action,
        entityType: 'request',
        entityId: requestId,
        requestId,
      },
      tx,
    );
  }

  /** Audit rows hold only ids; names are looked up here, at read time, for the feed. */
  private async activity(
    workspaceId: string,
    logs: {
      id: string;
      action: string;
      actorType: ActivityEntry['actorType'];
      actorId: string | null;
      requestId: string | null;
      createdAt: Date;
    }[],
  ): Promise<ActivityEntry[]> {
    const userIds = [
      ...new Set(
        logs.filter((l) => l.actorType === 'USER' && l.actorId).map((l) => l.actorId as string),
      ),
    ];
    const requestIds = [...new Set(logs.map((l) => l.requestId).filter((x): x is string => !!x))];
    const [users, requests] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      this.prisma.request.findMany({
        where: { id: { in: requestIds }, workspaceId },
        select: { id: true, clientName: true },
      }),
    ]);
    const userName = new Map(users.map((u) => [u.id, u.name]));
    const clientName = new Map(requests.map((r) => [r.id, r.clientName]));
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      actorType: l.actorType,
      actorName: l.actorId ? (userName.get(l.actorId) ?? null) : null,
      requestId: l.requestId && clientName.has(l.requestId) ? l.requestId : null,
      clientName: l.requestId ? (clientName.get(l.requestId) ?? null) : null,
      at: l.createdAt.toISOString(),
    }));
  }
}

function filterWhere(
  filter: z.output<typeof listRequestsQuerySchema>['filter'],
): Prisma.RequestWhereInput {
  switch (filter) {
    case 'OPEN':
      return { status: { in: OPEN } };
    case 'REVIEW':
      return { status: { in: OPEN }, items: { some: { status: 'SUBMITTED' } } };
    case 'OVERDUE':
      return { status: { in: OPEN }, dueDate: { lt: todayLondon() } };
    case 'DRAFT':
    case 'COMPLETE':
    case 'EXPIRED':
      return { status: filter };
    default:
      return {};
  }
}

const RECEIVED: ItemStatus[] = ['SUBMITTED', 'ACCEPTED'];

export function toSummary(r: SummaryRow): RequestSummary {
  return {
    id: r.id,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    checklistName: r.checklistName,
    status: r.status,
    overdue: OPEN.includes(r.status) && !!r.dueDate && r.dueDate < todayLondon(),
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    itemCount: r.items.length,
    receivedCount: r.items.filter((i) => RECEIVED.includes(i.status)).length,
    acceptedCount: r.items.filter((i) => i.status === 'ACCEPTED').length,
    toReviewCount: r.items.filter((i) => i.status === 'SUBMITTED').length,
    sentAt: r.sentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
