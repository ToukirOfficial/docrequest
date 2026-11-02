import type { Prisma } from '../generated/prisma/client.js';

/**
 * Completion rule (PRD §3, item 12): a request is Complete when every required
 * item is accepted. With no required items, every item must be accepted.
 * Returns true when this call completed the request.
 */
export async function refreshRequestStatus(
  tx: Prisma.TransactionClient,
  requestId: string,
): Promise<boolean> {
  const r = await tx.request.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true, items: { select: { required: true, status: true } } },
  });
  if (r.status !== 'SENT' && r.status !== 'IN_PROGRESS') return false;
  const required = r.items.filter((i) => i.required);
  const mustAccept = required.length > 0 ? required : r.items;
  if (mustAccept.length === 0 || mustAccept.some((i) => i.status !== 'ACCEPTED')) return false;
  await tx.request.update({
    where: { id: requestId },
    data: { status: 'COMPLETE', completedAt: new Date() },
  });
  return true;
}
