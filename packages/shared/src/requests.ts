import { z } from 'zod';
import { emailSchema, nameSchema, uuidSchema } from './common.js';
import { itemInputSchema, type FileType } from './templates.js';

export const REQUEST_STATUSES = ['DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETE', 'EXPIRED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ItemStatus = 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

/** A calendar date, YYYY-MM-DD (UK date chosen in the UI). */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Use a valid date');

const messageSchema = z.string().trim().max(1000, 'Keep the message under 1000 characters');

export const requestItemInputSchema = itemInputSchema.extend({ id: uuidSchema.optional() });
export type RequestItemInput = z.input<typeof requestItemInputSchema>;

export const createRequestSchema = z.object({
  clientName: nameSchema,
  clientEmail: emailSchema,
  checklistName: z.string().trim().max(120).default(''),
  dueDate: dateOnlySchema.nullable().default(null),
  message: messageSchema.default(''),
  items: z.array(itemInputSchema).min(1, 'Add at least one document').max(30),
  /** Send the link straight away instead of saving a draft. */
  send: z.boolean().default(false),
});
export type CreateRequestInput = z.input<typeof createRequestSchema>;

export const updateRequestSchema = z
  .object({
    clientName: nameSchema,
    clientEmail: emailSchema,
    checklistName: z.string().trim().max(120),
    dueDate: dateOnlySchema.nullable(),
    message: messageSchema,
  })
  .partial();
export type UpdateRequestInput = z.input<typeof updateRequestSchema>;

export const replaceItemsSchema = z.object({
  items: z.array(requestItemInputSchema).min(1, 'Keep at least one document').max(30),
});
export type ReplaceItemsInput = z.input<typeof replaceItemsSchema>;

/** List filters. OPEN = sent or in progress; REVIEW = has files waiting; OVERDUE = open and past due. */
export const REQUEST_FILTERS = [
  'ALL',
  'OPEN',
  'REVIEW',
  'OVERDUE',
  'DRAFT',
  'COMPLETE',
  'EXPIRED',
] as const;
export type RequestFilter = (typeof REQUEST_FILTERS)[number];
export const listRequestsQuerySchema = z.object({
  filter: z.enum(REQUEST_FILTERS).default('ALL'),
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type ListRequestsQuery = z.input<typeof listRequestsQuerySchema>;

export const requestParamsSchema = z.object({ workspaceId: uuidSchema, requestId: uuidSchema });

export interface RequestSummary {
  id: string;
  clientName: string;
  clientEmail: string;
  checklistName: string;
  status: RequestStatus;
  overdue: boolean;
  dueDate: string | null;
  itemCount: number;
  /** Items with a file in them (waiting for review or accepted). */
  receivedCount: number;
  acceptedCount: number;
  toReviewCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  position: number;
  title: string;
  helpText: string;
  required: boolean;
  allowedTypes: FileType[];
  status: ItemStatus;
  rejectReason: string | null;
}

export interface RequestDetail extends RequestSummary {
  message: string;
  linkExpiresAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  filesDeletedAt: string | null;
  createdByName: string | null;
  items: RequestItem[];
}

export interface RequestList {
  requests: RequestSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  actorType: 'USER' | 'CLIENT' | 'SYSTEM';
  actorName: string | null;
  requestId: string | null;
  clientName: string | null;
  at: string;
}

export interface Dashboard {
  stats: { open: number; toReview: number; overdue: number; completedThisWeek: number };
  attention: RequestSummary[];
  activity: ActivityEntry[];
}
