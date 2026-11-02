import { Controller, Get, HttpCode, NotFoundException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { env } from '../config/env.js';
import { Public } from '../common/decorators.js';
import { RateLimit } from '../common/rate-limit.js';
import { PrismaService } from '../common/prisma.service.js';
import { RedisService } from '../common/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { TokensService } from '../auth/tokens.service.js';
import { DEMO_MAIL_KEY } from '../mail/mail.sender.js';
import { DEMO_OWNER_EMAIL } from './seed.js';

export interface PublicConfig {
  demo: boolean;
  signupEnabled: boolean;
  maxUploadMb: number;
}

export interface DemoMail {
  to: string;
  subject: string;
  text: string;
  at: string;
}

@Controller()
@Public()
export class DemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  /** What the web app needs to know before sign-in. */
  @Get('config')
  config(): PublicConfig {
    return {
      demo: env.DEMO_MODE,
      signupEnabled: env.SIGNUP_ENABLED,
      maxUploadMb: env.MAX_UPLOAD_MB,
    };
  }

  /** One-click sign-in as the demo owner. Only exists when DEMO_MODE=true. */
  @Post('demo/login')
  @HttpCode(204)
  @RateLimit({ name: 'demo-login', limit: 30, windowSec: 600, by: ['ip'] })
  async login(@Res({ passthrough: true }) res: Response): Promise<void> {
    if (!env.DEMO_MODE) throw new NotFoundException();
    const user = await this.prisma.user.findUnique({ where: { email: DEMO_OWNER_EMAIL } });
    if (!user) throw new NotFoundException('The demo is being reset. Try again in a minute.');
    await this.tokens.issue(res, user.id);
    await this.audit.log({
      actorType: 'USER',
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
    });
  }

  /** The demo's outbox: every email the demo "sent", so visitors can play the client. */
  @Get('demo/mail')
  async mail(): Promise<DemoMail[]> {
    if (!env.DEMO_MODE) throw new NotFoundException();
    const raw = await this.redis.lrange(DEMO_MAIL_KEY, 0, 49);
    return raw.map((m) => JSON.parse(m) as DemoMail);
  }
}
