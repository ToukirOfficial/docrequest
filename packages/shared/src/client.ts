import { z } from 'zod';
import { codeSchema, tokenSchema, uuidSchema } from './common.js';
import type { FileType } from './templates.js';
import type { ItemStatus, RequestStatus } from './requests.js';

/** The client link token travels in the request body, never in a query string or log. */
export const clientTokenSchema = z.object({ token: tokenSchema });
export const clientVerifySchema = z.object({ token: tokenSchema, code: codeSchema });
export const clientItemParamsSchema = z.object({ itemId: uuidSchema });
export const clientFileParamsSchema = z.object({ fileId: uuidSchema });

export interface ClientLinkInfo {
  workspaceName: string;
  clientFirstName: string;
  itemCount: number;
  /** e.g. a•••@example.com, so the client knows where the code went. */
  maskedEmail: string;
  /** True when this browser already has a session for this request. */
  signedIn: boolean;
  complete: boolean;
}

export interface ClientFile {
  id: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  /** CHECKING while the virus scan and conversion run. */
  state: 'CHECKING' | 'READY';
}

export interface ClientItem {
  id: string;
  title: string;
  helpText: string;
  required: boolean;
  allowedTypes: FileType[];
  status: ItemStatus;
  rejectReason: string | null;
  files: ClientFile[];
}

export interface ClientView {
  workspaceName: string;
  clientFirstName: string;
  message: string;
  dueDate: string | null;
  status: RequestStatus;
  maxUploadMb: number;
  items: ClientItem[];
}

/** A file as staff see it. Only READY files can be previewed or downloaded. */
export interface StaffFile {
  id: string;
  mimeType: string;
  size: number;
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'SKIPPED';
  ready: boolean;
  uploadedAt: string;
}
