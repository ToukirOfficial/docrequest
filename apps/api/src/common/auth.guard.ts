import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { uuidSchema } from '@docrequest/shared';
import type { Role } from '../generated/prisma/enums.js';
import { ACCESS_COOKIE, readCookie } from './cookies.js';
import { AppRequest, IS_PUBLIC, ROLES } from './decorators.js';
import { PrismaService } from './prisma.service.js';

interface AccessPayload {
  sub: string;
  typ: 'access';
}

/**
 * Global guard, deny by default.
 * 1. Verifies the access cookie (unless the route is @Public()).
 * 2. On routes with :workspaceId, loads the caller's membership (404 if none,
 *    so other workspaces' ids are not confirmed to exist).
 * 3. Checks @Roles().
 * Ownership of individual records is checked in each service.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const req = ctx.switchToHttp().getRequest<AppRequest>();

    const token = readCookie(req, ACCESS_COOKIE);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessPayload>(token, { algorithms: ['HS256'] });
        if (payload.typ === 'access' && typeof payload.sub === 'string') {
          req.user = { id: payload.sub };
        }
      } catch {
        // Invalid or expired token: treated as anonymous below.
      }
    }

    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException();

    const workspaceId: unknown = req.params?.workspaceId;
    if (workspaceId !== undefined) {
      if (typeof workspaceId !== 'string' || !uuidSchema.safeParse(workspaceId).success) {
        throw new NotFoundException();
      }
      const membership = await this.prisma.membership.findUnique({
        where: { userId_workspaceId: { userId: req.user.id, workspaceId } },
        select: { id: true, role: true, workspace: { select: { isDemo: true } } },
      });
      if (!membership) throw new NotFoundException();
      req.member = {
        membershipId: membership.id,
        workspaceId,
        role: membership.role,
        isDemo: membership.workspace.isDemo,
      };
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && roles.length > 0) {
      if (!req.member) throw new Error('@Roles() used on a route without :workspaceId');
      if (!roles.includes(req.member.role)) throw new ForbiddenException();
    }
    return true;
  }
}
