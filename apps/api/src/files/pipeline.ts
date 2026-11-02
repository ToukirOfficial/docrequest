import { Logger } from '@nestjs/common';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import type { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { clamScan } from './clamav.js';
import { seal, unseal } from './envelope.js';
import { fileStore, newStorageKey, type FileStore } from './storage.js';

/** Longest side of an image after conversion. Big phone photos are resized to this. */
export const MAX_IMAGE_PX = 2400;
export const INFECTED_MESSAGE = 'This file couldn’t be accepted. Please upload it again.';
export const UNREADABLE_MESSAGE =
  'This file couldn’t be opened. Please upload it again, or try a different format.';

const logger = new Logger('Files');

interface Deps {
  prisma: PrismaClient;
  store?: FileStore;
  scan?: (data: Buffer) => Promise<string | null>;
}

async function loadPlain(deps: Deps, fileId: string) {
  const file = await deps.prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt) return null;
  const store = deps.store ?? fileStore();
  const plain = await unseal({ ...file, ciphertext: await store.get(file.storageKey) });
  return { file, plain, store };
}

/**
 * Step 1: virus scan. Returns true when the file may go on to conversion.
 * With CLAMAV_ENABLED=false files are marked SKIPPED (self-hosters without ClamAV).
 */
export async function scanFile(deps: Deps, fileId: string): Promise<boolean> {
  const loaded = await loadPlain(deps, fileId);
  if (!loaded) return false;
  const { file, plain } = loaded;
  const scanner =
    deps.scan ??
    (env.CLAMAV_ENABLED ? (d: Buffer) => clamScan(d, env.CLAMAV_HOST, env.CLAMAV_PORT) : null);
  if (!scanner) {
    await deps.prisma.file.update({ where: { id: file.id }, data: { scanStatus: 'SKIPPED' } });
    return true;
  }
  const virus = await scanner(plain);
  if (!virus) {
    await deps.prisma.file.update({ where: { id: file.id }, data: { scanStatus: 'CLEAN' } });
    return true;
  }
  await dropFile(deps, file, { scanStatus: 'INFECTED' }, INFECTED_MESSAGE, 'file.infected');
  logger.warn(`File ${file.id} failed the virus scan and was deleted`);
  return false;
}

/** Called when conversion keeps failing (a corrupt file that passed the type check). */
export async function rejectUnreadable(deps: Deps, fileId: string): Promise<void> {
  const file = await deps.prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt) return;
  await dropFile(deps, file, {}, UNREADABLE_MESSAGE, 'file.unreadable');
}

/** Deletes the bytes, keeps the row as a record, and sends the item back to the client with a reason. */
async function dropFile(
  deps: Deps,
  file: {
    id: string;
    requestItemId: string;
    requestId: string;
    workspaceId: string;
    storageKey: string;
  },
  data: { scanStatus?: 'INFECTED' },
  reason: string,
  action: 'file.infected' | 'file.unreadable',
): Promise<void> {
  await deps.prisma.$transaction(async (tx) => {
    await tx.file.update({ where: { id: file.id }, data: { ...data, deletedAt: new Date() } });
    const others = await tx.file.count({
      where: { requestItemId: file.requestItemId, deletedAt: null },
    });
    if (others === 0) {
      await tx.requestItem.update({
        where: { id: file.requestItemId },
        data: { status: 'PENDING', rejectReason: reason },
      });
    }
    await tx.auditLog.create({
      data: {
        workspaceId: file.workspaceId,
        actorType: 'SYSTEM',
        action,
        entityType: 'file',
        entityId: file.id,
        requestId: file.requestId,
      },
    });
  });
  await (deps.store ?? fileStore()).remove(file.storageKey);
}

/**
 * Step 2: make images safe and small. HEIC becomes JPEG, big images are resized,
 * and every image is re-encoded, which drops EXIF data including GPS location.
 * The result is encrypted with a fresh key; the old bytes are deleted.
 * PDFs are kept as uploaded.
 */
export async function convertFile(deps: Deps, fileId: string): Promise<void> {
  const loaded = await loadPlain(deps, fileId);
  if (!loaded) return;
  const { file, plain, store } = loaded;
  if (file.mimeType === 'application/pdf') {
    await deps.prisma.file.update({ where: { id: file.id }, data: { processedAt: new Date() } });
    return;
  }

  let input = plain;
  if (file.mimeType === 'image/heic') {
    input = Buffer.from(await heicConvert({ buffer: plain, format: 'JPEG', quality: 0.92 }));
  }
  const toPng = file.mimeType === 'image/png';
  // sharp writes no metadata unless asked to; .rotate() bakes in the EXIF orientation first.
  const pipeline = sharp(input, { limitInputPixels: 120_000_000 })
    .rotate()
    .resize({ width: MAX_IMAGE_PX, height: MAX_IMAGE_PX, fit: 'inside', withoutEnlargement: true });
  const out = toPng
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  const sealed = await seal(out);
  const storageKey = newStorageKey();
  await store.put(storageKey, sealed.ciphertext);
  await deps.prisma.file.update({
    where: { id: file.id },
    data: {
      storageKey,
      wrappedKey: sealed.wrappedKey,
      iv: sealed.iv,
      authTag: sealed.authTag,
      mimeType: toPng ? 'image/png' : 'image/jpeg',
      originalExt: toPng ? 'png' : 'jpg',
      size: out.length,
      processedAt: new Date(),
    },
  });
  await store.remove(file.storageKey);
}
