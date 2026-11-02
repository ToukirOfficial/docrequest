import { z } from 'zod';
import {
  codeSchema,
  emailSchema,
  nameSchema,
  passwordSchema,
  tokenSchema,
} from './common.js';

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'STAFF']);
export type Role = z.infer<typeof roleSchema>;

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  workspaceName: nameSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const loginVerifySchema = z.object({ code: codeSchema });
export type LoginVerifyInput = z.infer<typeof loginVerifySchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface MembershipSummary {
  workspaceId: string;
  workspaceName: string;
  role: Role;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  memberships: MembershipSummary[];
}

/** Returned by login step 1 and signup: a code has been emailed. */
export interface LoginChallengeResponse {
  codeSent: true;
}
