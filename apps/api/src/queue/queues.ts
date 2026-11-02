import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const QUEUE_PREFIX = `${env.REDIS_PREFIX}bull`;
export const MAIL_QUEUE = 'mail';
/** Virus scan, then convert (one at a time: image work is memory-hungry). */
export const SCAN_QUEUE = 'scan';
export const CONVERT_QUEUE = 'convert';

export interface FileJob {
  fileId: string;
}

/** BullMQ needs its own connection without ioredis keyPrefix. */
export function bullConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
