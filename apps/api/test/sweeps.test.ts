import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createUser,
  lastMailTo,
  login,
  resetState,
  setupApp,
  type TestContext,
} from './helpers.js';
import { reminderSweep } from '../src/sweeps/reminders.js';
import { ANONYMISED_NAME, expirySweep, retentionSweep } from '../src/sweeps/retention.js';
import { convertFile, scanFile } from '../src/files/pipeline.js';
import { fileStore } from '../src/files/storage.js';
import type { MailMessage } from '../src/mail/templates.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(async () => {
  await ctx.app.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
);
// November: UK time = UTC, so these read as London times.
const SENT = new Date('2026-11-02T10:00:00Z');
const at = (iso: string) => new Date(iso);

async function sent(opts: { dueDate?: string } = {}) {
  const owner = await createUser(ctx, 'owner@example.com');
  const staff = await login(ctx, 'owner@example.com');
  const res = await staff
    .post(`/api/w/${owner.workspaceId}/requests`)
    .send({
      clientName: 'Jane Smith',
      clientEmail: 'jane@example.com',
      items: [
        { title: 'Passport', allowedTypes: ['PDF'] },
        { title: 'Payslip', allowedTypes: ['PDF'] },
        { title: 'Reference', allowedTypes: ['PDF'], required: false },
      ],
      send: true,
      ...(opts.dueDate ? { dueDate: opts.dueDate } : {}),
    })
    .expect(201);
  const body = res.body as { id: string; items: { id: string }[] };
  await ctx.prisma.request.update({
    where: { id: body.id },
    data: { sentAt: SENT, linkExpiresAt: at('2026-12-31T00:00:00Z') },
  });
  return { wid: owner.workspaceId, staff, id: body.id, itemIds: body.items.map((i) => i.id) };
}

function sweep(now: Date) {
  const mails: MailMessage[] = [];
  return {
    mails,
    run: () =>
      reminderSweep({ prisma: ctx.prisma, sendMail: async (m) => void mails.push(m), now }),
  };
}

describe('reminder scheduling', () => {
  it('sends the day-2 reminder once, listing only what is missing, with a fresh link', async () => {
    const r = await sent();
    const before = (await ctx.prisma.request.findUniqueOrThrow({ where: { id: r.id } })).linkHash;
    expect(await sweep(at('2026-11-04T09:00:00Z')).run()).toBe(0); // 1 hour short of 2 days

    const s = sweep(at('2026-11-04T11:00:00Z'));
    expect(await s.run()).toBe(1);
    const mail = s.mails[0];
    expect(mail?.subject).toBe('Reminder: 2 documents still needed for Test Workspace');
    expect(mail?.text).toContain('Passport');
    expect(mail?.text).toContain('Payslip');
    expect(mail?.text).not.toContain('Reference'); // optional
    expect(mail?.text).toMatch(/\/r\/[A-Za-z0-9_-]{40,}/);
    expect((await ctx.prisma.request.findUniqueOrThrow({ where: { id: r.id } })).linkHash).not.toBe(
      before,
    );

    expect(await sweep(at('2026-11-04T12:00:00Z')).run()).toBe(0); // never twice
    expect(await ctx.prisma.reminder.count({ where: { requestId: r.id } })).toBe(1);
  });

  it('only sends in the daytime, UK time', async () => {
    await sent();
    expect(await sweep(at('2026-11-04T03:00:00Z')).run()).toBe(0);
    expect(await sweep(at('2026-11-04T20:30:00Z')).run()).toBe(0);
    expect(await sweep(at('2026-11-05T08:10:00Z')).run()).toBe(1);
  });

  it('a late sweep sends one email, not a backlog', async () => {
    const r = await sent();
    const s = sweep(at('2026-11-08T10:00:00Z')); // days 2 and 5 both due
    expect(await s.run()).toBe(1);
    const rows = await ctx.prisma.reminder.findMany({
      where: { requestId: r.id },
      orderBy: { kind: 'asc' },
    });
    expect(rows.map((x) => [x.kind, x.emailed])).toEqual([
      ['DAY_2', false],
      ['DAY_5', true],
    ]);
  });

  it('two sweeps at the same moment send one reminder', async () => {
    await sent();
    const a = sweep(at('2026-11-04T11:00:00Z'));
    const b = sweep(at('2026-11-04T11:00:00Z'));
    const [x, y] = await Promise.all([a.run(), b.run()]);
    expect(x + y).toBe(1);
  });

  it('stops when nothing required is missing, and when the request completes', async () => {
    const r = await sent();
    await ctx.prisma.requestItem.updateMany({
      where: { requestId: r.id, required: true },
      data: { status: 'SUBMITTED' },
    });
    expect(await sweep(at('2026-11-04T11:00:00Z')).run()).toBe(0);
    await ctx.prisma.requestItem.updateMany({
      where: { requestId: r.id },
      data: { status: 'PENDING' },
    });
    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { status: 'COMPLETE', completedAt: SENT },
    });
    expect(await sweep(at('2026-11-04T11:00:00Z')).run()).toBe(0);
  });

  it('a rejected document counts as missing', async () => {
    const r = await sent();
    await ctx.prisma.requestItem.update({
      where: { id: r.itemIds[0] },
      data: { status: 'REJECTED', rejectReason: 'Blurry' },
    });
    await ctx.prisma.requestItem.update({
      where: { id: r.itemIds[1] },
      data: { status: 'ACCEPTED' },
    });
    const s = sweep(at('2026-11-04T11:00:00Z'));
    expect(await s.run()).toBe(1);
    expect(s.mails[0]?.subject).toContain('1 document still needed');
    expect(s.mails[0]?.text).toContain('Passport (please send it again)');
  });

  it('sends a reminder the day before the due date', async () => {
    const r = await sent({ dueDate: '2026-11-03' });
    const s = sweep(at('2026-11-02T15:00:00Z')); // day before due, no DAY_ reminders yet
    expect(await s.run()).toBe(1);
    expect((await ctx.prisma.reminder.findFirstOrThrow({ where: { requestId: r.id } })).kind).toBe(
      'DUE',
    );
    expect(s.mails[0]?.text).toContain('due by');
  });

  it('staff can send one manual reminder an hour, only while something is missing', async () => {
    const r = await sent();
    const base = `/api/w/${r.wid}/requests/${r.id}`;
    const res = await r.staff.post(`${base}/remind`).expect(200);
    expect((res.body as { reminders: { kind: string }[] }).reminders[0]?.kind).toMatch(/^MANUAL:/);
    expect(await lastMailTo(ctx, 'jane@example.com')).toContain('still needed');
    await r.staff.post(`${base}/remind`).expect(409); // within the hour

    await ctx.prisma.requestItem.updateMany({
      where: { requestId: r.id },
      data: { status: 'SUBMITTED' },
    });
    await ctx.prisma.reminder.deleteMany({});
    await r.staff.post(`${base}/remind`).expect(409); // nothing missing

    const other = await createUser(ctx, 'other@example.com', { workspaceName: 'Other' });
    const otherAgent = await login(ctx, 'other@example.com');
    await otherAgent.post(`/api/w/${other.workspaceId}/requests/${r.id}/remind`).expect(404);
  });
});

describe('expiry and retention', () => {
  it('expires open requests whose link has run out', async () => {
    const r = await sent();
    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { linkExpiresAt: at('2026-11-10T00:00:00Z') },
    });
    expect(await expirySweep({ prisma: ctx.prisma, now: at('2026-11-09T00:00:00Z') })).toBe(0);
    expect(await expirySweep({ prisma: ctx.prisma, now: at('2026-11-10T01:00:00Z') })).toBe(1);
    const row = await ctx.prisma.request.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe('EXPIRED');
    expect(
      await ctx.prisma.auditLog.count({ where: { action: 'request.expired', requestId: r.id } }),
    ).toBe(1);
  });

  it('deletes files and anonymises the client after the retention period', async () => {
    const r = await sent();
    // The client uploads a file, staff accept it, the request completes.
    const token = /\/r\/([A-Za-z0-9_-]+)/.exec(await lastMailTo(ctx, 'jane@example.com'))?.[1];
    const client = request.agent(ctx.app.getHttpServer());
    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { linkExpiresAt: new Date(Date.now() + 864e5) },
    });
    await client.post('/api/client/code').send({ token }).expect(204);
    const code = /code is (\d{6})/.exec(await lastMailTo(ctx, 'jane@example.com'))?.[1];
    await client.post('/api/client/verify').send({ token, code }).expect(204);
    await client
      .post(`/api/client/items/${r.itemIds[0]}/files`)
      .attach('file', PDF, 'passport.pdf')
      .expect(201);
    const file = await ctx.prisma.file.findFirstOrThrow();
    await scanFile({ prisma: ctx.prisma }, file.id);
    await convertFile({ prisma: ctx.prisma }, file.id);
    const stored = (await ctx.prisma.file.findUniqueOrThrow({ where: { id: file.id } })).storageKey;
    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { status: 'COMPLETE', completedAt: at('2026-11-05T10:00:00Z') },
    });

    // Default retention is 30 days.
    expect(await retentionSweep({ prisma: ctx.prisma, now: at('2026-12-04T10:00:00Z') })).toBe(0);
    await r.staff.get(`/api/w/${r.wid}/files/${file.id}`).expect(200);
    expect(await retentionSweep({ prisma: ctx.prisma, now: at('2026-12-05T11:00:00Z') })).toBe(1);

    const f = await ctx.prisma.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(f.deletedAt).not.toBeNull();
    expect(f.wrappedKey).toBe('deleted'); // crypto-shredded
    await expect(fileStore().get(stored)).rejects.toThrow();
    await r.staff.get(`/api/w/${r.wid}/files/${file.id}`).expect(404);

    const row = await ctx.prisma.request.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({
      clientName: ANONYMISED_NAME,
      clientEmail: '',
      message: '',
      linkHash: null,
    });
    expect(row.filesDeletedAt).not.toBeNull();
    const detail = (await r.staff.get(`/api/w/${r.wid}/requests/${r.id}`).expect(200)).body as {
      clientName: string;
      itemCount: number;
    };
    expect(detail).toMatchObject({ clientName: ANONYMISED_NAME, itemCount: 3 }); // kept for counts
    expect(JSON.stringify(detail)).not.toContain('Jane');
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'retention.files_deleted', requestId: r.id },
      }),
    ).toBe(1);

    // Running again does nothing.
    expect(await retentionSweep({ prisma: ctx.prisma, now: at('2026-12-06T11:00:00Z') })).toBe(0);
  });

  it('never deletes drafts or open requests', async () => {
    const r = await sent();
    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { completedAt: at('2026-01-01T00:00:00Z') },
    });
    expect(await retentionSweep({ prisma: ctx.prisma, now: at('2026-12-31T00:00:00Z') })).toBe(0);
  });
});
