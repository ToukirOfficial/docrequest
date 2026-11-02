import type { Response } from 'express';
import { isProd } from '../config/env.js';

export const ACCESS_COOKIE = 'dr_access';
export const REFRESH_COOKIE = 'dr_refresh';
export const LOGIN_COOKIE = 'dr_login';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
export const LOGIN_TTL_SEC = 10 * 60;

const paths: Record<string, string> = {
  [ACCESS_COOKIE]: '/api',
  [REFRESH_COOKIE]: '/api/auth',
  [LOGIN_COOKIE]: '/api/auth',
};

/**
 * httpOnly, SameSite=Lax (so links from emails work), Secure in production.
 * Cross-site writes are blocked separately by the Origin check in main.
 */
export function setCookie(res: Response, name: string, value: string, maxAgeSec: number): void {
  res.cookie(name, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: paths[name] ?? '/api',
    maxAge: maxAgeSec * 1000,
  });
}

export function clearCookie(res: Response, name: string): void {
  res.clearCookie(name, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: paths[name] ?? '/api',
  });
}

export function readCookie(
  req: { headers: { cookie?: string } },
  name: string,
): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
