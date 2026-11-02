import { fileTypeFromBuffer } from 'file-type';
import type { FileType } from '../generated/prisma/enums.js';

export interface Detected {
  type: FileType;
  mime: string;
  ext: string;
}

const MAP: Record<string, Detected> = {
  'application/pdf': { type: 'PDF', mime: 'application/pdf', ext: 'pdf' },
  'image/jpeg': { type: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  'image/png': { type: 'PNG', mime: 'image/png', ext: 'png' },
  'image/heic': { type: 'HEIC', mime: 'image/heic', ext: 'heic' },
  'image/heif': { type: 'HEIC', mime: 'image/heic', ext: 'heic' },
};

/**
 * The real type, read from the file's first bytes (magic numbers).
 * The file name and the browser's Content-Type are ignored.
 */
export async function detectType(buf: Buffer): Promise<Detected | null> {
  const ft = await fileTypeFromBuffer(buf);
  return ft ? (MAP[ft.mime] ?? null) : null;
}
