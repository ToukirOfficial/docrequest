import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { MailMessage } from '../mail/templates.js';
import { mailTemplates } from '../mail/templates.js';
import { DAY_MS, todayLondon } from '../common/dates.js';
import { rotateLink } from '../requests/links.js';

/** Automatic reminders only go out in the daytime, UK time (PRD §3, item 14). */
export const SEND_FROM_HOUR = 8;
export const SEND_UNTIL_HOUR = 20;

const londonHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: 'numeric',
  hourCycle: 'h23',
});
export function isSendingHour(now: Date): boolean {
  const h = Number(londonHour.format(now));
  return h >= SEND_FROM_HOUR && h < SEND_UNTIL_HOUR;
}

type ItemState = { title: string; required: boolean; status: string };

/** Required documents not yet sent, or sent back for a retake. With no required items, any missing item counts. */
export function missingItems<T extends ItemState>(items: T[]): T[] {
  const required = items.filter((i) => i.required);
  const pool = required.length > 0 ? required : items;
  return pool.filter((i) => i.status === 'PENDING' || i.status === 'REJECTED');
}

/** Which automatic reminders are due now, oldest first. */
export function dueKinds(
  r: { sentAt: Date; dueDate: Date | null },
  w: { reminderDays: number[]; dueReminderDays: number },
  now: Date,
): string[] {
  const kinds = w.reminderDays
    .filter((d) => now.getTime() >= r.sentAt.getTime() + d * DAY_MS)
    .sort((a, b) => a - b)
    .map((d) => `DAY_${d}`);
  if (r.dueDate && w.dueReminderDays > 0) {
    const today = todayLondon(now);
    const from = new Date(r.dueDate.getTime() - w.dueReminderDays * DAY_MS);
    if (today >= from && today <= r.dueDate) kinds.push('DUE');
  }
  return kinds;
}

export interface ReminderTarget {
  id: string;
  workspaceId: string;
  clientName: string;
  clientEmail: string;
  dueDate: Date | null;
  workspace: { name: string };
  items: ItemState[];
}

/**
 * Records the reminder kinds and builds the email (with a fresh link) inside the caller's transaction.
 * Returns null when another sweep got there first (the unique key on requestId+kind).
 */
export async function recordReminder(
  tx: Prisma.TransactionClient,
  r: ReminderTarget,
  kinds: string[],
  actor: { type: 'SYSTEM' } | { type: 'USER'; id: string },
): Promise<MailMessage | null> {
  const newest = kinds[kinds.length - 1];
  const created = await tx.reminder.createMany({
    data: kinds.map((kind) => ({
      requestId: r.id,
      workspaceId: r.workspaceId,
      kind,
      // A late sweep sends one email for the newest reminder; older ones are recorded as skipped.
      emailed: kind === newest,
      sentById: actor.type === 'USER' ? actor.id : null,
    })),
    skipDuplicates: true,
  });
  if (created.count === 0) return null;
  const link = await rotateLink(tx, r.id);
  await tx.auditLog.create({
    data: {
      workspaceId: r.workspaceId,
      actorType: actor.type,
      actorId: actor.type === 'USER' ? actor.id : null,
      action: 'reminder.sent',
      entityType: 'request',
      entityId: r.id,
      requestId: r.id,
    },
  });
  return mailTemplates.reminder(r.clientEmail, {
    clientName: r.clientName.split(/\s+/)[0] ?? r.clientName,
    workspaceName: r.workspace.name,
    missing: missingItems(r.items).map((i) => ({
      title: i.title,
      retake: i.status === 'REJECTED',
    })),
    dueDate: r.dueDate,
    link,
  });
}

export interface SweepDeps {
  prisma: PrismaClient;
  sendMail: (m: MailMessage) => Promise<void>;
  now?: Date;
}

/**
 * Hourly: sends the reminders that are due. Stops by itself when nothing is missing,
 * the request completes, or the link expires. Never sends the same reminder twice.
 */
export async function reminderSweep(deps: SweepDeps): Promise<number> {
  const now = deps.now ?? new Date();
  if (!isSendingHour(now)) return 0;
  let sent = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await deps.prisma.request.findMany({
      where: {
        status: { in: ['SENT', 'IN_PROGRESS'] },
        sentAt: { not: null },
        linkExpiresAt: { gt: now },
      },
      include: {
        workspace: { select: { name: true, reminderDays: true, dueReminderDays: true } },
        items: {
          select: { title: true, required: true, status: true },
          orderBy: { position: 'asc' },
        },
        reminders: { select: { kind: true } },
      },
      orderBy: { id: 'asc' },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]?.id;
    for (const r of batch) {
      if (!r.sentAt || missingItems(r.items).length === 0) continue;
      const done = new Set(r.reminders.map((x) => x.kind));
      const kinds = dueKinds({ sentAt: r.sentAt, dueDate: r.dueDate }, r.workspace, now).filter(
        (k) => !done.has(k),
      );
      if (kinds.length === 0) continue;
      const mail = await deps.prisma.$transaction((tx) =>
        recordReminder(tx, r, kinds, { type: 'SYSTEM' }),
      );
      if (mail) {
        await deps.sendMail(mail);
        sent++;
      }
    }
  }
  return sent;
}

/** When the next automatic reminder is due (a UK date), for the request page. */
export function nextReminderDate(
  r: {
    status: string;
    sentAt: Date | null;
    dueDate: Date | null;
    items: ItemState[];
    reminders: { kind: string }[];
  },
  w: { reminderDays: number[]; dueReminderDays: number },
  now = new Date(),
): string | null {
  if (
    !r.sentAt ||
    (r.status !== 'SENT' && r.status !== 'IN_PROGRESS') ||
    missingItems(r.items).length === 0
  )
    return null;
  const done = new Set(r.reminders.map((x) => x.kind));
  const times: number[] = w.reminderDays
    .filter((d) => !done.has(`DAY_${d}`))
    .map((d) => r.sentAt!.getTime() + d * DAY_MS)
    .filter((t) => t > now.getTime());
  if (r.dueDate && w.dueReminderDays > 0 && !done.has('DUE')) {
    const t = r.dueDate.getTime() - w.dueReminderDays * DAY_MS;
    if (t >= todayLondon(now).getTime()) times.push(t);
  }
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toISOString().slice(0, 10);
}
