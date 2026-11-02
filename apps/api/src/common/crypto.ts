import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/** Long random URL-safe token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Hash for storing tokens: only the hash is ever saved. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Keyed hash for short codes, so a Redis dump can't be brute-forced offline. */
export function hashCode(code: string, context: string): string {
  return createHmac('sha256', env.CODE_PEPPER).update(`${context}:${code}`).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
