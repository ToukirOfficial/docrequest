import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Must run before the app (and env.ts) loads.
vi.hoisted(() => {
  process.env.DEMO_MODE = 'true';
});

import request from 'supertest';
import { resetState, setupApp, type TestContext } from './helpers.js';
import { DEMO_OWNER_EMAIL, purgeVisitorUploads, resetDemo, seedDemo } from '../src/demo/seed.js';
import { DEMO_MAIL_KEY } from '../src/mail/mail.sender.js';
import { env } from '../src/config/env.js';

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

describe('demo mode', () => {
  it('turns on the demo limits', async () => {
    expect(env.MAX_UPLOAD_MB).toBeLessThanOrEqual(2);
    expect(env.MAIL_DRIVER).toBe('file');
    const res = await request(ctx.app.getHttpServer()).get('/api/config').expect(200);
    expect(res.body).toMatchObject({ demo: true, signupEnabled: false });
    await request(ctx.app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'X',
        email: 'x@example.com',
        password: 'a long enough password',
        workspaceName: 'X',
      })
      .expect(403);
  });

  it('seeds a believable workspace, and one click signs in as its owner', async () => {
    const agent = request.agent(ctx.app.getHttpServer());
    await agent.post('/api/demo/login').expect(404); // nothing seeded yet
    const { workspaceId } = await seedDemo(ctx.prisma);
    await agent.post('/api/demo/login').expect(204);
    const me = (await agent.get('/api/auth/me').expect(200)).body as {
      email: string;
      memberships: { workspaceId: string }[];
    };
    expect(me.email).toBe(DEMO_OWNER_EMAIL);
    expect(me.memberships[0]?.workspaceId).toBe(workspaceId);

    const dash = (await agent.get(`/api/w/${workspaceId}/dashboard`).expect(200)).body as {
      stats: { open: number; toReview: number; overdue: number; completedThisWeek: number };
      activity: unknown[];
    };
    expect(dash.stats).toMatchObject({ open: 3, toReview: 2, overdue: 1 });
    expect(dash.activity.length).toBeGreaterThan(5);

    // Sample files are real encrypted files that open.
    const file = await ctx.prisma.file.findFirstOrThrow({ where: { mimeType: 'application/pdf' } });
    const pdf = await agent.get(`/api/w/${workspaceId}/files/${file.id}`).expect(200);
    expect(
      Buffer.from(pdf.body as Buffer)
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');

    // Settings and team are read-only in the demo.
    await agent.patch(`/api/w/${workspaceId}/settings`).send({ name: 'Renamed' }).expect(403);
    await agent
      .post(`/api/w/${workspaceId}/invites`)
      .send({ email: 'a@example.com', role: 'STAFF' })
      .expect(403);
  });

  it('shows the outbox to visitors', async () => {
    await ctx.redis.lpush(
      DEMO_MAIL_KEY,
      JSON.stringify({
        to: 'c@example.com',
        subject: 'Hello',
        text: 'Body',
        at: new Date().toISOString(),
      }),
    );
    const res = await request(ctx.app.getHttpServer()).get('/api/demo/mail').expect(200);
    expect(res.body).toEqual([expect.objectContaining({ subject: 'Hello' })]);
  });

  it('purges only visitor uploads older than an hour', async () => {
    const seededAt = new Date(Date.now() - 3 * 3600_000);
    await seedDemo(ctx.prisma, seededAt);
    const seedFiles = await ctx.prisma.file.count({ where: { deletedAt: null } });
    const item = await ctx.prisma.requestItem.findFirstOrThrow({
      where: { status: 'PENDING' },
      include: { request: true },
    });
    const base = {
      requestItemId: item.id,
      requestId: item.requestId,
      workspaceId: item.workspaceId,
      wrappedKey: 'x',
      iv: 'x',
      authTag: 'x',
      mimeType: 'application/pdf',
      size: 1,
      originalExt: 'pdf',
    };
    await ctx.prisma.file.create({
      data: {
        ...base,
        storageKey: 'files/aa/' + 'a'.repeat(32) + '.bin',
        createdAt: new Date(Date.now() - 2 * 3600_000),
      },
    });
    await ctx.prisma.file.create({
      data: {
        ...base,
        storageKey: 'files/bb/' + 'b'.repeat(32) + '.bin',
        createdAt: new Date(Date.now() - 10 * 60_000),
      },
    });

    expect(await purgeVisitorUploads(ctx.prisma, seededAt)).toBe(1); // the recent one stays for now
    expect(await ctx.prisma.file.count({ where: { deletedAt: null } })).toBe(seedFiles + 1);
  });

  it('never resets a database that has a real workspace', async () => {
    await seedDemo(ctx.prisma);
    await ctx.prisma.workspace.create({ data: { name: 'A real business' } });
    await expect(resetDemo(ctx.prisma, async () => undefined)).rejects.toThrow(/refused/);
    expect(await ctx.prisma.workspace.count()).toBe(2);
  });
});
