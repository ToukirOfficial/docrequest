import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const QUEUE_PREFIX = `${env.REDIS_PREFIX}bull`;
export const MAIL_QUEUE = 'mail';

/** BullMQ needs its own connection without ioredis keyPrefix. */
export function bullConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
