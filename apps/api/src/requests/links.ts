import type { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { randomToken, sha256 } from '../common/crypto.js';

/**
 * Makes a new client link and returns its URL. Only the SHA-256 hash is stored,
 * so the server can never re-send an old link: every email that needs one
 * (retake requests, reminders) carries a fresh link, and older links stop working.
 * Expiry is not extended here.
 */
export async function rotateLink(db: Prisma.TransactionClient, requestId: string): Promise<string> {
  const token = randomToken();
  await db.request.update({ where: { id: requestId }, data: { linkHash: sha256(token) } });
  return `${env.WEB_ORIGIN}/r/${token}`;
}
