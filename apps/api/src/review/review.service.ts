import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  cleanFileName,
  clientSlug,
  slug,
  type AuditPage,
  type ExportInfo,
  type RequestDetail,
} from '@docrequest/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import type { AuthUser, WorkspaceMember } from '../common/decorators.js';
import { EXPORT_QUEUE, QUEUE_PREFIX, bullConnection, type ExportJob } from '../queue/queues.js';
import { unseal } from '../files/envelope.js';
import { fileStore } from '../files/storage.js';
import { RequestsService } from '../requests/requests.service.js';
import { refreshRequestStatus } from '../requests/request-state.js';
import { rotateLink } from '../requests/links.js';

const OPEN = ['SENT', 'IN_PROGRESS'] as const;
const AUDIT_PAGE = 50;

/** A file staff may open: scanned clean (or scanning switched off), converted, not deleted. */
const READY: Prisma.FileWhereInput = {
  deletedAt: null,
  scanStatus: { in: ['CLEAN', 'SKIPPED'] },
  processedAt: { not: null },
};

export interface FileDownload {
  body: Buffer;
  mimeType: string;
  fileName: string;
}

@Injectable()
export class ReviewService implements OnModuleDestroy {
  readonly exportQueue = new Queue<ExportJob>(EXPORT_QUEUE, {
    connection: bullConnection(),
    prefix: QUEUE_PREFIX,
    defaultJobOptions: { attempts: 2, removeOnComplete: true, removeOnFail: 100 },
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly requests: RequestsService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.exportQueue.close();
  }

  /** Decrypts one file for preview or download. Infected, unscanned or unprocessed files are never served. */
  async file(
    member: WorkspaceMember,
    user: AuthUser,
    fileId: string,
    download: boolean,
  ): Promise<FileDownload> {
    const f = await this.prisma.file.findFirst({
      where: { id: fileId, workspaceId: member.workspaceId, ...READY },
      include: {
        item: {
          select: {
            title: true,
            files: { where: READY, select: { id: true }, orderBy: { createdAt: 'asc' } },
          },
        },
        request: { select: { clientName: true } },
      },
    });
    if (!f) throw new NotFoundException('File not found');
    const body = await unseal({ ...f, ciphertext: await fileStore().get(f.storageKey) });
    await this.audit.log({
      workspaceId: member.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      action: download ? 'file.downloaded' : 'file.viewed',
      entityType: 'file',
      entityId: f.id,
      requestId: f.requestId,
    });
    const index = f.item.files.findIndex((x) => x.id === f.id) + 1;
    return {
      body,
      mimeType: f.mimeType,
      fileName: cleanFileName(
        f.request.clientName,
        f.item.title,
        f.originalExt,
        index,
        f.item.files.length,
      ),
    };
  }

  async accept(
    member: WorkspaceMember,
    user: AuthUser,
    requestId: string,
    itemId: string,
  ): Promise<RequestDetail> {
    const item = await this.openItem(member, requestId, itemId);
    if (item.status !== 'SUBMITTED')
      throw new ConflictException('Only documents waiting for review can be accepted.');
    const files = await this.prisma.file.findMany({
      where: { requestItemId: item.id, deletedAt: null },
    });
    if (files.length === 0) throw new ConflictException('There is no file to accept yet.');
    if (
      files.some(
        (f) => !(f.processedAt && (f.scanStatus === 'CLEAN' || f.scanStatus === 'SKIPPED')),
      )
    ) {
      throw new ConflictException('A file is still being checked. Try again in a moment.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.requestItem.update({
        where: { id: item.id },
        data: { status: 'ACCEPTED', rejectReason: null },
      });
      await this.audit.log(
        {
          workspaceId: member.workspaceId,
          actorType: 'USER',
          actorId: user.id,
          action: 'item.accepted',
          entityType: 'item',
          entityId: item.id,
          requestId,
        },
        tx,
      );
      if (await refreshRequestStatus(tx, requestId)) {
        await this.audit.log(
          {
            workspaceId: member.workspaceId,
            actorType: 'USER',
            actorId: user.id,
            action: 'request.completed',
            entityType: 'request',
            entityId: requestId,
            requestId,
          },
          tx,
        );
      }
    });
    return this.requests.get(member, requestId);
  }

  /**
   * Sends the item back to the client with a reason. The rejected files are deleted
   * (no reason to keep a blurry passport), and the client gets an email with a fresh link.
   */
  async reject(
    member: WorkspaceMember,
    user: AuthUser,
    requestId: string,
    itemId: string,
    reason: string,
  ): Promise<RequestDetail> {
    const item = await this.openItem(member, requestId, itemId);
    if (item.status !== 'SUBMITTED' && item.status !== 'ACCEPTED') {
      throw new ConflictException('Only documents the client has sent can be sent back.');
    }
    const files = await this.prisma.file.findMany({
      where: { requestItemId: item.id, deletedAt: null },
    });
    const { link, request, workspace } = await this.prisma.$transaction(async (tx) => {
      await tx.file.updateMany({
        where: { id: { in: files.map((f) => f.id) } },
        data: { deletedAt: new Date() },
      });
      await tx.requestItem.update({
        where: { id: item.id },
        data: { status: 'REJECTED', rejectReason: reason },
      });
      await this.audit.log(
        {
          workspaceId: member.workspaceId,
          actorType: 'USER',
          actorId: user.id,
          action: 'item.rejected',
          entityType: 'item',
          entityId: item.id,
          requestId,
        },
        tx,
      );
      return {
        link: await rotateLink(tx, requestId),
        request: await tx.request.findUniqueOrThrow({ where: { id: requestId } }),
        workspace: await tx.workspace.findUniqueOrThrow({ where: { id: member.workspaceId } }),
      };
    });
    await Promise.all(files.map((f) => fileStore().remove(f.storageKey)));
    await this.mail.send(
      mailTemplates.retakeRequested(request.clientEmail, {
        clientName: request.clientName.split(/\s+/)[0] ?? request.clientName,
        workspaceName: workspace.name,
        itemTitle: item.title,
        reason,
        link,
      }),
    );
    return this.requests.get(member, requestId);
  }

  private async openItem(member: WorkspaceMember, requestId: string, itemId: string) {
    const item = await this.prisma.requestItem.findFirst({
      where: { id: itemId, requestId, workspaceId: member.workspaceId },
      include: { request: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Document not found');
    if (!OPEN.includes(item.request.status as (typeof OPEN)[number])) {
      throw new ConflictException('This request has ended, so its documents can’t be changed.');
    }
    return item;
  }

  /** Starts building a zip of every accepted document. The worker encrypts and stores it. */
  async createExport(
    member: WorkspaceMember,
    user: AuthUser,
    requestId: string,
  ): Promise<ExportInfo> {
    const r = await this.prisma.request.findFirst({
      where: { id: requestId, workspaceId: member.workspaceId },
    });
    if (!r) throw new NotFoundException('Request not found');
    const count = await this.prisma.file.count({
      where: { requestId, ...READY, item: { status: 'ACCEPTED' } },
    });
    if (count === 0) throw new ConflictException('Accept at least one document to download a zip.');
    const ex = await this.prisma.$transaction(async (tx) => {
      const e = await tx.export.create({
        data: { requestId, workspaceId: member.workspaceId, createdById: user.id },
      });
      await this.audit.log(
        {
          workspaceId: member.workspaceId,
          actorType: 'USER',
          actorId: user.id,
          action: 'export.created',
          entityType: 'export',
          entityId: e.id,
          requestId,
        },
        tx,
      );
      return e;
    });
    await this.exportQueue.add('build', { exportId: ex.id });
    return toExportInfo(ex, r);
  }

  async getExport(member: WorkspaceMember, exportId: string): Promise<ExportInfo> {
    const e = await this.prisma.export.findFirst({
      where: { id: exportId, workspaceId: member.workspaceId },
      include: { request: true },
    });
    if (!e) throw new NotFoundException('Download not found');
    return toExportInfo(e, e.request);
  }

  async downloadExport(
    member: WorkspaceMember,
    user: AuthUser,
    exportId: string,
  ): Promise<FileDownload> {
    const e = await this.prisma.export.findFirst({
      where: { id: exportId, workspaceId: member.workspaceId },
      include: { request: true },
    });
    if (!e) throw new NotFoundException('Download not found');
    if (
      e.status !== 'READY' ||
      !e.storageKey ||
      !e.wrappedKey ||
      !e.iv ||
      !e.authTag ||
      (e.expiresAt && e.expiresAt < new Date())
    ) {
      throw new ConflictException('This download isn’t ready or has expired. Make a new one.');
    }
    const body = await unseal({
      wrappedKey: e.wrappedKey,
      iv: e.iv,
      authTag: e.authTag,
      ciphertext: await fileStore().get(e.storageKey),
    });
    await this.audit.log({
      workspaceId: member.workspaceId,
      actorType: 'USER',
      actorId: user.id,
      action: 'export.downloaded',
      entityType: 'export',
      entityId: e.id,
      requestId: e.requestId,
    });
    return { body, mimeType: 'application/zip', fileName: exportName(e.request) };
  }

  /** Owner/Admin only (checked by the controller). Names are looked up here; the log itself holds ids only. */
  async auditLog(member: WorkspaceMember, page: number): Promise<AuditPage> {
    const rows = await this.prisma.auditLog.findMany({
      where: { workspaceId: member.workspaceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * AUDIT_PAGE,
      take: AUDIT_PAGE + 1,
    });
    const userIds = [
      ...new Set(
        rows.filter((r) => r.actorType === 'USER' && r.actorId).map((r) => r.actorId as string),
      ),
    ];
    const requestIds = [...new Set(rows.map((r) => r.requestId).filter((x): x is string => !!x))];
    const [users, requests] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      this.prisma.request.findMany({
        where: { id: { in: requestIds }, workspaceId: member.workspaceId },
        select: { id: true, clientName: true },
      }),
    ]);
    const userName = new Map(users.map((u) => [u.id, u.name]));
    const clientName = new Map(requests.map((r) => [r.id, r.clientName]));
    return {
      entries: rows.slice(0, AUDIT_PAGE).map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        actorType: r.actorType,
        actorName: r.actorId ? (userName.get(r.actorId) ?? null) : null,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        requestId: r.requestId && clientName.has(r.requestId) ? r.requestId : null,
        clientName: r.requestId ? (clientName.get(r.requestId) ?? null) : null,
      })),
      page,
      pageSize: AUDIT_PAGE,
      hasMore: rows.length > AUDIT_PAGE,
    };
  }
}

export function exportName(r: { clientName: string; checklistName: string }): string {
  return `${clientSlug(r.clientName)}_${slug(r.checklistName, 'documents')}.zip`;
}

function toExportInfo(
  e: {
    id: string;
    status: ExportInfo['status'];
    fileCount: number | null;
    size: number | null;
    expiresAt: Date | null;
  },
  r: { clientName: string; checklistName: string },
): ExportInfo {
  const expired = e.status === 'READY' && !!e.expiresAt && e.expiresAt < new Date();
  return {
    id: e.id,
    status: expired ? 'EXPIRED' : e.status,
    fileCount: e.fileCount,
    size: e.size,
    expiresAt: e.expiresAt?.toISOString() ?? null,
    fileName: exportName(r),
  };
}
