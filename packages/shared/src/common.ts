import { z } from 'zod';

export const uuidSchema = z.uuid();

export const emailSchema = z
  .email({ message: 'Enter a valid email address' })
  .max(254)
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200, 'Use at most 200 characters');

export const nameSchema = z.string().trim().min(1, 'Required').max(120);

export const codeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,200}$/, 'Invalid link');

export const workspaceParamsSchema = z.object({ workspaceId: uuidSchema });
export type WorkspaceParams = z.infer<typeof workspaceParamsSchema>;
