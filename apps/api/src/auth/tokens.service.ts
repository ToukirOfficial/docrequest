import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { randomToken, sha256 } from '../common/crypto.js';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SEC,
  REFRESH_COOKIE,
  REFRESH_TTL_SEC,
  clearCookie,
  setCookie,
} from '../common/cookies.js';

/**
 * Access token: short-lived JWT. Refresh token: random, stored only as a hash,
 * rotated on every use. Re-using an already-used refresh token revokes the
 * whole family (signals theft).
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async issue(res: Response, userId: string, familyId: string = randomUUID()): Promise<void> {
    const refresh = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(refresh),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    });
    const access = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { expiresIn: ACCESS_TTL_SEC },
    );
    setCookie(res, ACCESS_COOKIE, access, ACCESS_TTL_SEC);
    setCookie(res, REFRESH_COOKIE, refresh, REFRESH_TTL_SEC);
  }

  async rotate(res: Response, refresh: string | undefined): Promise<void> {
    if (!refresh) throw new UnauthorizedException();
    const now = new Date();
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refresh) },
    });
    if (!token) throw this.fail(res);

    if (token.usedAt || token.revokedAt) {
      if (token.usedAt && !token.revokedAt) {
        await this.revokeFamily(token.familyId);
        await this.audit.log({
          actorType: 'USER',
          actorId: token.userId,
          action: 'auth.refresh_reuse',
          entityType: 'user',
          entityId: token.userId,
        });
      }
      throw this.fail(res);
    }
    if (token.expiresAt <= now) throw this.fail(res);

    // Mark used atomically, so two parallel refreshes can't both succeed.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: token.id, usedAt: null, revokedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      await this.revokeFamily(token.familyId);
      throw this.fail(res);
    }
    await this.issue(res, token.userId, token.familyId);
  }

  async revokeByToken(refresh: string | undefined): Promise<string | undefined> {
    if (!refresh) return undefined;
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refresh) },
    });
    if (!token) return undefined;
    await this.revokeFamily(token.familyId);
    return token.userId;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clear(res: Response): void {
    clearCookie(res, ACCESS_COOKIE);
    clearCookie(res, REFRESH_COOKIE);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private fail(res: Response): UnauthorizedException {
    this.clear(res);
    return new UnauthorizedException();
  }
}
