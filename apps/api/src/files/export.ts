import { ZipArchive } from 'archiver';
import { cleanFileName } from '@docrequest/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { seal, unseal } from './envelope.js';
import { fileStore, newStorageKey } from './storage.js';

export const EXPORT_TTL_MS = 60 * 60 * 1000;

/**
 * Builds the zip of accepted documents with clean names (e.g. smith-jane_passport.pdf),
 * encrypts it like any upload and stores it. It's deleted again after an hour.
 */
export async function buildExport(prisma: PrismaClient, exportId: string): Promise<void> {
  const ex = await prisma.export.findUnique({
    where: { id: exportId },
    include: { request: { select: { clientName: true } } },
  });
  if (!ex || ex.status !== 'PENDING') return;
  const items = await prisma.requestItem.findMany({
    where: { requestId: ex.requestId, status: 'ACCEPTED' },
    orderBy: { position: 'asc' },
    include: {
      files: {
        where: {
          deletedAt: null,
          scanStatus: { in: ['CLEAN', 'SKIPPED'] },
          processedAt: { not: null },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const store = fileStore();
  const zip = new ZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  zip.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    zip.on('end', resolve);
    zip.on('error', reject);
  });
  let count = 0;
  const used = new Set<string>();
  for (const item of items) {
    for (const [i, f] of item.files.entries()) {
      const plain = await unseal({ ...f, ciphertext: await store.get(f.storageKey) });
      let name = cleanFileName(
        ex.request.clientName,
        item.title,
        f.originalExt,
        i + 1,
        item.files.length,
      );
      // Two items with the same title: keep names unique.
      for (let n = 2; used.has(name); n++) name = name.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
      used.add(name);
      zip.append(plain, { name, date: f.createdAt });
      count++;
    }
  }
  await zip.finalize();
  await done;
  const plainZip = Buffer.concat(chunks);

  const sealed = await seal(plainZip);
  const storageKey = newStorageKey().replace(/^files\//, 'exports/');
  await store.put(storageKey, sealed.ciphertext);
  await prisma.export.update({
    where: { id: ex.id },
    data: {
      status: 'READY',
      storageKey,
      wrappedKey: sealed.wrappedKey,
      iv: sealed.iv,
      authTag: sealed.authTag,
      size: plainZip.length,
      fileCount: count,
      expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
    },
  });
}

/** Deletes an export's bytes (after an hour, or straight away by retention). */
export async function expireExport(prisma: PrismaClient, exportId: string): Promise<void> {
  const ex = await prisma.export.findUnique({ where: { id: exportId } });
  if (!ex || ex.status === 'EXPIRED') return;
  if (ex.storageKey) await fileStore().remove(ex.storageKey);
  await prisma.export.update({
    where: { id: ex.id },
    data: { status: 'EXPIRED', storageKey: null, wrappedKey: null, iv: null, authTag: null },
  });
}
