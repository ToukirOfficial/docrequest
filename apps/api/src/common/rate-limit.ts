import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRequest } from './decorators.js';
import { RedisService } from './redis.service.js';
import { sha256 } from './crypto.js';

export interface RateLimitRule {
  /** Bucket name, e.g. "login". */
  name: string;
  limit: number;
  windowSec: number;
  /** What to count by. "email" reads req.body.email. */
  by: Array<'ip' | 'email' | 'user'>;
}

const RATE_LIMIT = 'rateLimit';
export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT, rules);

/** Fixed-window limiter in Redis. Each "by" key is its own bucket. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(RATE_LIMIT, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rules) return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();

    for (const rule of rules) {
      for (const by of rule.by) {
        const id = this.identity(req, by);
        if (!id) continue;
        const key = `rl:${rule.name}:${by}:${sha256(id)}`;
        const count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, rule.windowSec);
        if (count > rule.limit) {
          throw new HttpException(
            'Too many attempts. Please wait a few minutes and try again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }
    return true;
  }

  private identity(req: AppRequest, by: 'ip' | 'email' | 'user'): string | undefined {
    if (by === 'ip') return req.ip ?? 'unknown';
    if (by === 'user') return req.user?.id;
    const body: unknown = req.body;
    if (body && typeof body === 'object' && 'email' in body && typeof body.email === 'string') {
      return body.email.trim().toLowerCase().slice(0, 254);
    }
    return undefined;
  }
}
