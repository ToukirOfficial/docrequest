import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { BUILTIN_TEMPLATES, type TemplateItem } from '@docrequest/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { ActorType, ItemStatus, RequestStatus } from '../generated/prisma/enums.js';
import { env } from '../config/env.js';
import { DAY_MS, dateOnly, todayLondon } from '../common/dates.js';
import { hashPassword } from '../auth/passwords.js';
import { seal } from '../files/envelope.js';
import { fileStore, newStorageKey } from '../files/storage.js';
import { makeBillPhoto, makeCutOffScreenshot, makeIdPhoto, makePdf } from './fake-docs.js';

export const DEMO_OWNER_EMAIL = 'priya@cranbrooklettings.example';
export const DEMO_SEEDED_AT_KEY = 'demo:seededAt';
const HOUR = 60 * 60 * 1000;

type FileSpec = { kind: 'id' | 'bill' | 'cutoff' | 'pdf'; title?: string; lines?: string[] };
type ItemSpec = { status: ItemStatus; files?: FileSpec[]; rejectReason?: string };

const tpl = (id: string): TemplateItem[] => BUILTIN_TEMPLATES.find((t) => t.id === id)?.items ?? [];

/**
 * Fills an empty database with the demo workspace (PRD §3, item 21): believable made-up
 * clients, every request state, watermarked sample documents and a recent activity feed.
 */
export async function seedDemo(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ workspaceId: string }> {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR);
  const day = (offset: number) =>
    dateOnly(new Date(todayLondon(now).getTime() + offset * DAY_MS).toISOString().slice(0, 10));
  // Nobody signs in with these passwords: the demo uses one-click sign-in.
  const unusable = await hashPassword(randomBytes(24).toString('base64url'));

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Cranbrook Lettings',
      isDemo: true,
      reminderDays: [2, 5, 7],
      dueReminderDays: 1,
      retentionDays: 30,
      linkExpiryDays: 30,
    },
  });
  const priya = await prisma.user.create({
    data: { email: DEMO_OWNER_EMAIL, name: 'Priya Shah', passwordHash: unusable },
  });
  const tom = await prisma.user.create({
    data: { email: 'tom@cranbrooklettings.example', name: 'Tom Hughes', passwordHash: unusable },
  });
  await prisma.membership.create({
    data: { userId: priya.id, workspaceId: workspace.id, role: 'OWNER' },
  });
  await prisma.membership.create({
    data: { userId: tom.id, workspaceId: workspace.id, role: 'STAFF' },
  });
  await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name: 'Guarantor',
      items: {
        create: [
          {
            position: 0,
            title: 'Photo ID',
            helpText: 'Passport or full driving licence.',
            allowedTypes: ['PDF', 'JPEG', 'PNG', 'HEIC'],
          },
          {
            position: 1,
            title: 'Proof of income',
            helpText: 'Your last 3 payslips or a tax return.',
            allowedTypes: ['PDF'],
          },
          {
            position: 2,
            title: 'Proof of address',
            helpText: 'A bill from the last 3 months.',
            allowedTypes: ['PDF', 'JPEG', 'PNG', 'HEIC'],
          },
        ],
      },
    },
  });

  const audit = (
    action: string,
    requestId: string,
    hoursAgo: number,
    actorType: ActorType = 'USER',
    actorId: string | null = priya.id,
  ) =>
    prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorType,
        actorId: actorType === 'USER' ? actorId : null,
        action,
        entityType: 'request',
        entityId: requestId,
        requestId,
        createdAt: at(hoursAgo),
      },
    });

  async function request(o: {
    client: [string, string];
    checklist: string;
    items: TemplateItem[];
    specs: ItemSpec[];
    status: RequestStatus;
    sentHoursAgo?: number;
    due?: number | null;
    message?: string;
    by?: string;
  }) {
    const r = await prisma.request.create({
      data: {
        workspaceId: workspace.id,
        createdById: o.by ?? priya.id,
        checklistName: o.checklist,
        clientName: o.client[0],
        clientEmail: o.client[1],
        message: o.message ?? '',
        dueDate: o.due === undefined || o.due === null ? null : day(o.due),
        status: o.status,
        // A random hash: the demo's sample links aren't usable; visitors send their own requests.
        linkHash: o.status === 'DRAFT' ? null : randomBytes(32).toString('hex'),
        linkExpiresAt: o.status === 'DRAFT' ? null : new Date(now.getTime() + 25 * DAY_MS),
        sentAt: o.sentHoursAgo === undefined ? null : at(o.sentHoursAgo),
        completedAt: o.status === 'COMPLETE' ? at(20) : null,
        expiredAt: o.status === 'EXPIRED' ? at(30) : null,
        createdAt: at((o.sentHoursAgo ?? 2) + 1),
      },
    });
    for (const [position, item] of o.items.entries()) {
      const spec = o.specs[position] ?? { status: 'PENDING' };
      const ri = await prisma.requestItem.create({
        data: {
          ...item,
          position,
          requestId: r.id,
          workspaceId: workspace.id,
          status: spec.status,
          rejectReason: spec.rejectReason ?? null,
        },
      });
      for (const f of spec.files ?? []) {
        const [first = '', ...rest] = o.client[0].split(' ');
        const bytes =
          f.kind === 'id'
            ? await makeIdPhoto(first, rest.join(' '))
            : f.kind === 'bill'
              ? await makeBillPhoto(o.client[0], ['14 Cranbrook Road', 'Bristol', 'BS6 7XX'])
              : f.kind === 'cutoff'
                ? await makeCutOffScreenshot()
                : makePdf(f.title ?? item.title, f.lines ?? []);
        const sealed = await seal(bytes);
        const storageKey = newStorageKey();
        await fileStore().put(storageKey, sealed.ciphertext);
        const pdf = f.kind === 'pdf';
        await prisma.file.create({
          data: {
            requestItemId: ri.id,
            requestId: r.id,
            workspaceId: workspace.id,
            storageKey,
            wrappedKey: sealed.wrappedKey,
            iv: sealed.iv,
            authTag: sealed.authTag,
            mimeType: pdf ? 'application/pdf' : 'image/jpeg',
            originalExt: pdf ? 'pdf' : 'jpg',
            size: bytes.length,
            scanStatus: 'CLEAN',
            processedAt: at(3),
            createdAt: at(3),
          },
        });
      }
    }
    return r;
  }

  const payslip = (who: string, month: string): FileSpec => ({
    kind: 'pdf',
    title: 'Payslip',
    lines: [
      `Employee: ${who}`,
      'Employer: Harbour & Finch Ltd (sample)',
      `Pay period: ${month} 2026`,
      '',
      'Gross pay        £3,050.00',
      'Income tax         £400.00',
      'National Insurance £139.40',
      'Pension            £152.50',
      '',
      'Net pay          £2,358.10',
    ],
  });

  const amara = await request({
    client: ['Amara Okafor', 'amara.okafor@example.com'],
    checklist: 'New tenant',
    items: tpl('builtin-new-tenant'),
    status: 'IN_PROGRESS',
    sentHoursAgo: 50,
    due: 9,
    message: "Hi Amara, here's everything we need for 14 Cranbrook Road.",
    specs: [
      { status: 'ACCEPTED', files: [{ kind: 'id' }] },
      { status: 'SUBMITTED', files: [{ kind: 'bill' }] },
      {
        status: 'SUBMITTED',
        files: [
          payslip('Amara Okafor', 'August'),
          payslip('Amara Okafor', 'September'),
          payslip('Amara Okafor', 'October'),
        ],
      },
    ],
  });
  const daniel = await request({
    client: ['Daniel Whitfield', 'daniel.whitfield@example.com'],
    checklist: 'Guarantor',
    items: [
      {
        title: 'Photo ID',
        helpText: 'Passport or full driving licence.',
        required: true,
        allowedTypes: ['PDF', 'JPEG', 'PNG', 'HEIC'],
      },
      {
        title: 'Proof of income',
        helpText: 'Your last 3 payslips or a tax return.',
        required: true,
        allowedTypes: ['PDF'],
      },
    ],
    status: 'COMPLETE',
    sentHoursAgo: 96,
    specs: [
      { status: 'ACCEPTED', files: [{ kind: 'id' }] },
      {
        status: 'ACCEPTED',
        files: [
          {
            kind: 'pdf',
            title: 'SA302 tax calculation',
            lines: [
              'Name: Daniel Whitfield',
              'Tax year: 2025 to 2026',
              '',
              'Total income received  £64,210.00',
              'Income tax due         £13,486.00',
            ],
          },
        ],
      },
    ],
  });
  const sofia = await request({
    client: ['Sofia Marchetti', 'sofia.marchetti@example.com'],
    checklist: 'New tenant',
    items: tpl('builtin-new-tenant'),
    status: 'SENT',
    sentHoursAgo: 7 * 24 + 5,
    due: -3,
    specs: [],
  });
  const hannah = await request({
    client: ['Hannah Price', 'hannah.price@example.com'],
    checklist: 'New employee (right to work)',
    items: tpl('builtin-new-employee'),
    status: 'IN_PROGRESS',
    sentHoursAgo: 26,
    due: 4,
    by: tom.id,
    specs: [
      { status: 'SUBMITTED', files: [{ kind: 'id' }] },
      {
        status: 'REJECTED',
        rejectReason:
          'Part of the document is cut off. Please make sure the whole result is in the screenshot.',
      },
      {
        status: 'SUBMITTED',
        files: [
          {
            kind: 'pdf',
            title: 'National Insurance number',
            lines: [
              'Name: Hannah Price',
              'National Insurance number: QQ 12 34 56 C',
              '',
              'This is a sample letter for the DocRequest demo.',
            ],
          },
        ],
      },
    ],
  });
  const oliver = await request({
    client: ['Oliver Bennett', 'oliver.bennett@example.com'],
    checklist: 'Mortgage application',
    items: tpl('builtin-mortgage'),
    status: 'EXPIRED',
    sentHoursAgo: 40 * 24,
    specs: [{ status: 'SUBMITTED', files: [{ kind: 'id' }] }],
  });
  await request({
    client: ['Rhys Llewellyn', 'rhys.llewellyn@example.com'],
    checklist: 'Guarantor',
    items: tpl('builtin-new-tenant').slice(0, 3),
    status: 'DRAFT',
    specs: [],
  });

  await prisma.reminder.create({
    data: { requestId: sofia.id, workspaceId: workspace.id, kind: 'DAY_2', sentAt: at(5 * 24 + 5) },
  });
  await prisma.reminder.create({
    data: { requestId: sofia.id, workspaceId: workspace.id, kind: 'DAY_5', sentAt: at(2 * 24 + 5) },
  });

  // A believable recent history for the activity feed (oldest first).
  const history: [string, string, number, ActorType?, string?][] = [
    ['request.sent', oliver.id, 40 * 24],
    ['request.expired', oliver.id, 30, 'SYSTEM'],
    ['request.sent', daniel.id, 96],
    ['file.uploaded', daniel.id, 70, 'CLIENT'],
    ['item.accepted', daniel.id, 21],
    ['request.completed', daniel.id, 20],
    ['request.sent', sofia.id, 7 * 24 + 5],
    ['reminder.sent', sofia.id, 2 * 24 + 5, 'SYSTEM'],
    ['request.sent', amara.id, 50],
    ['request.sent', hannah.id, 26, 'USER', tom.id],
    ['file.uploaded', hannah.id, 9, 'CLIENT'],
    ['item.rejected', hannah.id, 6, 'USER', tom.id],
    ['client.verified', amara.id, 4, 'CLIENT'],
    ['file.uploaded', amara.id, 3.5, 'CLIENT'],
    ['item.accepted', amara.id, 2],
    ['file.uploaded', amara.id, 1.2, 'CLIENT'],
  ];
  for (const [action, requestId, hoursAgo, actorType, actorId] of history) {
    await audit(action, requestId, hoursAgo, actorType ?? 'USER', actorId ?? priya.id);
  }
  return { workspaceId: workspace.id };
}

/**
 * Nightly: wipes everything and seeds again. Refuses to run unless DEMO_MODE is on and
 * every workspace is a demo one, so it can never empty a real install.
 */
export async function resetDemo(
  prisma: PrismaClient,
  onSeeded: (at: Date) => Promise<void>,
): Promise<void> {
  if (!env.DEMO_MODE) throw new Error('Demo reset refused: DEMO_MODE is off');
  const real = await prisma.workspace.count({ where: { isDemo: false } });
  if (real > 0) throw new Error('Demo reset refused: a non-demo workspace exists');
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  // TRUNCATE (not DELETE) so the audit log's append-only trigger doesn't fire.
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
  );
  if (env.STORAGE_DRIVER === 'local')
    await rm(resolve(env.STORAGE_DIR), { recursive: true, force: true });
  const now = new Date();
  await seedDemo(prisma, now);
  await onSeeded(now);
}

/** Hourly: deletes files visitors uploaded more than an hour ago (the seed's own files stay). */
export async function purgeVisitorUploads(
  prisma: PrismaClient,
  seededAt: Date,
  now = new Date(),
): Promise<number> {
  const files = await prisma.file.findMany({
    where: { deletedAt: null, createdAt: { gt: seededAt, lt: new Date(now.getTime() - HOUR) } },
    select: { id: true, storageKey: true, requestItemId: true },
  });
  for (const f of files) {
    await prisma.file.update({
      where: { id: f.id },
      data: { deletedAt: now, wrappedKey: 'deleted', iv: '', authTag: '' },
    });
    const left = await prisma.file.count({
      where: { requestItemId: f.requestItemId, deletedAt: null },
    });
    if (left === 0) {
      await prisma.requestItem.updateMany({
        where: { id: f.requestItemId, status: { not: 'ACCEPTED' } },
        data: { status: 'PENDING' },
      });
    }
    await fileStore()
      .remove(f.storageKey)
      .catch(() => undefined);
  }
  return files.length;
}
