import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';

export const IS_PUBLIC = 'isPublic';
/** Opt an endpoint out of the global auth guard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restrict a workspace endpoint to these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
}

export interface WorkspaceMember {
  membershipId: string;
  workspaceId: string;
  role: Role;
  isDemo: boolean;
}

export interface AppRequest extends Request {
  user?: AuthUser;
  member?: WorkspaceMember;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.user) throw new Error('CurrentUser used on a public route');
  return req.user;
});

export const CurrentMember = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.member) throw new Error('CurrentMember used outside a workspace route');
  return req.member;
});
