import { Logger } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';
import { DAY_MS } from '../common/dates.js';
import { fileStore, type FileStore } from '../files/storage.js';
import { expireExport } from '../files/export.js';

const logger = new Logger('Retention');
export const ANONYMISED_NAME = 'Deleted client';

interface Deps {
  prisma: PrismaClient;
  now?: Date;
  store?: FileStore;
}

/** Hourly: open requests whose link has run out become Expired. */
export async function expirySweep(deps: Deps): Promise<number> {
  const now = deps.now ?? new Date();
  const due = await deps.prisma.request.findMany({
    where: { status: { in: ['SENT', 'IN_PROGRESS'] }, linkExpiresAt: { lt: now } },
    select: { id: true, workspaceId: true },
    take: 500,
  });
  for (const r of due) {
    await deps.prisma.$transaction(async (tx) => {
      const { count } = await tx.request.updateMany({
        where: { id: r.id, status: { in: ['SENT', 'IN_PROGRESS'] } },
        data: { status: 'EXPIRED', expiredAt: now },
      });
      if (count === 0) return;
      await tx.auditLog.create({
        data: {
          workspaceId: r.workspaceId,
          actorType: 'SYSTEM',
          action: 'request.expired',
          entityType: 'request',
          entityId: r.id,
          requestId: r.id,
        },
      });
    });
  }
  return due.length;
}

/**
 * Daily (PRD §3, item 18): once a complete or ended request is older than the workspace's
 * retention period, every file is deleted and the client's details are anonymised.
 * The request row stays, with no personal data, so counts still add up. The deletion is audited.
 */
export async function retentionSweep(deps: Deps): Promise<number> {
  const now = deps.now ?? new Date();
  const store = deps.store ?? fileStore();
  const candidates = await deps.prisma.request.findMany({
    where: { status: { in: ['COMPLETE', 'EXPIRED'] }, filesDeletedAt: null },
    select: {
      id: true,
      workspaceId: true,
      completedAt: true,
      expiredAt: true,
      workspace: { select: { retentionDays: true } },
    },
    take: 1000,
  });
  let done = 0;
  for (const r of candidates) {
    const closedAt = r.completedAt ?? r.expiredAt;
    if (!closedAt || closedAt.getTime() + r.workspace.retentionDays * DAY_MS > now.getTime())
      continue;

    const files = await deps.prisma.file.findMany({
      where: { requestId: r.id, deletedAt: null },
      select: { storageKey: true },
    });
    const exports = await deps.prisma.export.findMany({
      where: { requestId: r.id, status: { not: 'EXPIRED' } },
      select: { id: true },
    });
    await deps.prisma.$transaction(async (tx) => {
      // Crypto-shred as well as delete: without the wrapped key, a leftover copy can't be decrypted.
      await tx.file.updateMany({
        where: { requestId: r.id },
        data: { deletedAt: now, wrappedKey: 'deleted', iv: '', authTag: '' },
      });
      await tx.requestItem.updateMany({ where: { requestId: r.id }, data: { rejectReason: null } });
      await tx.request.update({
        where: { id: r.id },
        data: {
          clientName: ANONYMISED_NAME,
          clientEmail: '',
          message: '',
          linkHash: null,
          filesDeletedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: r.workspaceId,
          actorType: 'SYSTEM',
          action: 'retention.files_deleted',
          entityType: 'request',
          entityId: r.id,
          requestId: r.id,
        },
      });
    });
    for (const f of files) {
      await store
        .remove(f.storageKey)
        .catch((e: unknown) =>
          logger.warn(`Could not remove a stored file: ${(e as Error).message}`),
        );
    }
    for (const e of exports) await expireExport(deps.prisma, e.id);
    done++;
  }

  // Zips are deleted after an hour by a delayed job; this catches any that were missed.
  const staleExports = await deps.prisma.export.findMany({
    where: { status: 'READY', expiresAt: { lt: now } },
    select: { id: true },
  });
  for (const e of staleExports) await expireExport(deps.prisma, e.id);
  return done;
}
