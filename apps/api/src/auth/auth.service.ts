import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  ForgotPasswordInput,
  LoginInput,
  MeResponse,
  ResetPasswordInput,
  SignupInput,
} from '@docrequest/shared';
import { env } from '../config/env.js';
import { PrismaService } from '../common/prisma.service.js';
import { RedisService } from '../common/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { hashCode, randomCode, randomToken, safeEqual, sha256 } from '../common/crypto.js';
import { LOGIN_COOKIE, LOGIN_TTL_SEC, clearCookie, setCookie } from '../common/cookies.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './passwords.js';
import { TokensService } from './tokens.service.js';

const MAX_CODE_ATTEMPTS = 5;
const RESET_TTL_SEC = 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly tokens: TokensService,
  ) {}

  async signup(input: SignupInput, res: Response): Promise<void> {
    if (!env.SIGNUP_ENABLED || env.DEMO_MODE) throw new ForbiddenException('Sign-up is turned off');
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      const workspace = await tx.workspace.create({ data: { name: input.workspaceName } });
      await tx.membership.create({
        data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
      });
      await this.audit.log(
        {
          workspaceId: workspace.id,
          actorType: 'USER',
          actorId: user.id,
          action: 'auth.signup',
          entityType: 'workspace',
          entityId: workspace.id,
        },
        tx,
      );
      return user;
    });
    // Sign-up also proves the email address: the user must enter the emailed code.
    await this.startChallenge(user.id, user.email, res);
  }

  /** Step 1: password. On success a 6-digit code is emailed. */
  async login(input: LoginInput, res: Response): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      await burnPasswordCheck(input.password);
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    await this.startChallenge(user.id, user.email, res);
  }

  /** Step 2: the emailed code. Max 5 tries per code, then a fresh login is needed. */
  async verifyLogin(challengeId: string | undefined, code: string, res: Response): Promise<void> {
    const invalid = new UnauthorizedException(
      'That code is wrong or has expired. Please sign in again.',
    );
    if (!challengeId) throw invalid;
    const key = `login:${sha256(challengeId)}`;
    const attempts = await this.redis.hincrby(key, 'attempts', 1);
    const [userId, codeHash] = await this.redis.hmget(key, 'userId', 'codeHash');
    if (!userId || !codeHash) {
      await this.redis.del(key);
      throw invalid;
    }
    if (attempts > MAX_CODE_ATTEMPTS) {
      await this.redis.del(key);
      clearCookie(res, LOGIN_COOKIE);
      throw invalid;
    }
    if (!safeEqual(codeHash, hashCode(code, `login:${challengeId}`))) {
      throw new UnauthorizedException('That code is wrong. Please check the email and try again.');
    }
    await this.redis.del(key);
    clearCookie(res, LOGIN_COOKIE);
    await this.tokens.issue(res, userId);
    await this.audit.log({
      actorType: 'USER',
      actorId: userId,
      action: 'auth.login',
      entityType: 'user',
      entityId: userId,
    });
  }

  async logout(refresh: string | undefined, res: Response): Promise<void> {
    const userId = await this.tokens.revokeByToken(refresh);
    this.tokens.clear(res);
    if (userId) {
      await this.audit.log({
        actorType: 'USER',
        actorId: userId,
        action: 'auth.logout',
        entityType: 'user',
        entityId: userId,
      });
    }
  }

  /** Always succeeds, so it can't be used to find out which emails have accounts. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return;
    const token = randomToken();
    await this.redis.set(`pwreset:${sha256(token)}`, user.id, 'EX', RESET_TTL_SEC);
    const link = `${env.WEB_ORIGIN}/reset-password?token=${token}`;
    await this.mail.send(mailTemplates.passwordReset(user.email, link));
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const key = `pwreset:${sha256(input.token)}`;
    const userId = await this.redis.getdel(key);
    if (!userId) throw new BadRequestException('This reset link is invalid or has expired');
    const passwordHash = await hashPassword(input.password);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.log({
      actorType: 'USER',
      actorId: userId,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: userId,
    });
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        memberships: {
          select: { role: true, workspace: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      memberships: user.memberships.map((m) => ({
        workspaceId: m.workspace.id,
        workspaceName: m.workspace.name,
        role: m.role,
      })),
    };
  }

  private async startChallenge(userId: string, email: string, res: Response): Promise<void> {
    const challengeId = randomToken();
    const code = randomCode();
    const key = `login:${sha256(challengeId)}`;
    await this.redis
      .multi()
      .hset(key, { userId, codeHash: hashCode(code, `login:${challengeId}`), attempts: 0 })
      .expire(key, LOGIN_TTL_SEC)
      .exec();
    setCookie(res, LOGIN_COOKIE, challengeId, LOGIN_TTL_SEC);
    await this.mail.send(mailTemplates.loginCode(email, code));
  }
}
