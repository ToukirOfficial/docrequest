import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/** App cache/state connection. All keys are prefixed with REDIS_PREFIX. */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor() {
    super(env.REDIS_URL, { keyPrefix: env.REDIS_PREFIX, lazyConnect: false });
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
