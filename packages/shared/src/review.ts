import { z } from 'zod';
import { uuidSchema } from './common.js';

export const itemParamsSchema = z.object({ workspaceId: uuidSchema, requestId: uuidSchema, itemId: uuidSchema });
export const fileParamsSchema = z.object({ workspaceId: uuidSchema, fileId: uuidSchema });
export const fileQuerySchema = z.object({ download: z.enum(['1']).optional() });
export const exportParamsSchema = z.object({ workspaceId: uuidSchema, exportId: uuidSchema });

export const rejectItemSchema = z.object({
  reason: z.string().trim().min(3, 'Tell the client what to fix').max(300),
});
export type RejectItemInput = z.input<typeof rejectItemSchema>;

/** Ready-made retake reasons shown as one-tap options. */
export const RETAKE_REASONS = [
  'The photo is blurry. Could you take it again in good light?',
  'Part of the document is cut off. Please make sure all four corners are in the picture.',
  'This looks like the wrong document. Please check the description and try again.',
  'This document is out of date. Please send one from the last 3 months.',
];

export interface ExportInfo {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED' | 'EXPIRED';
  fileCount: number | null;
  size: number | null;
  expiresAt: string | null;
  fileName: string;
}

export const auditQuerySchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) });

export interface AuditEntry {
  id: string;
  at: string;
  actorType: 'USER' | 'CLIENT' | 'SYSTEM';
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  /** Looked up when read; never stored in the audit log. Gone once retention anonymises the request. */
  clientName: string | null;
}

export interface AuditPage {
  entries: AuditEntry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** "Amara Okafor" -> "okafor-amara". ASCII, lower case, safe in any file system. */
export function clientSlug(clientName: string): string {
  const parts = slugParts(clientName);
  if (parts.length === 0) return 'client';
  const last = parts.pop() as string;
  return [last, ...parts].join('-').slice(0, 60);
}

export function slug(text: string, fallback = 'document'): string {
  return slugParts(text).join('-').slice(0, 60) || fallback;
}

function slugParts(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Clean download name, e.g. "smith-jane_passport.pdf", or "smith-jane_payslips-2.pdf" for the second file. */
export function cleanFileName(clientName: string, itemTitle: string, ext: string, index = 1, of = 1): string {
  return `${clientSlug(clientName)}_${slug(itemTitle)}${of > 1 ? `-${index}` : ''}.${ext}`;
}
