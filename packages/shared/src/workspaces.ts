import { z } from 'zod';
import { emailSchema, nameSchema, passwordSchema, tokenSchema, uuidSchema } from './common.js';
import { roleSchema, type Role } from './auth.js';

const day = z.number().int().min(1).max(365);

export const updateSettingsSchema = z
  .object({
    name: nameSchema,
    reminderDays: z
      .array(day)
      .max(10)
      .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
    dueReminderDays: z.number().int().min(0).max(30),
    retentionDays: day,
    linkExpiryDays: day,
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface WorkspaceSettings {
  id: string;
  name: string;
  reminderDays: number[];
  dueReminderDays: number;
  retentionDays: number;
  linkExpiryDays: number;
}

/** Only Admin or Staff can be given by invite or role change; Owner is fixed. */
export const assignableRoleSchema = roleSchema.exclude(['OWNER']);

export const createInviteSchema = z.object({ email: emailSchema, role: assignableRoleSchema });
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const updateMemberSchema = z.object({ role: assignableRoleSchema });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const memberParamsSchema = z.object({ workspaceId: uuidSchema, memberId: uuidSchema });
export const inviteParamsSchema = z.object({ workspaceId: uuidSchema, inviteId: uuidSchema });
export const inviteTokenParamsSchema = z.object({ token: tokenSchema });

/** Accepting an invite: existing users just log in; new users set name + password. */
export const acceptInviteSchema = z.object({
  name: nameSchema.optional(),
  password: passwordSchema.optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

export interface InvitePreview {
  workspaceName: string;
  email: string;
  role: Role;
  existingUser: boolean;
}
