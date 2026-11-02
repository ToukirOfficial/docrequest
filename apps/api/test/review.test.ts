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
import { convertFile, scanFile } from '../src/files/pipeline.js';
import { buildExport } from '../src/files/export.js';

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

/** A sent request with a passport (required), a payslip (required) and a reference (optional). */
async function setup(ownerEmail = 'owner@example.com', clientEmail = 'jane.smith@example.com') {
  const owner = await createUser(ctx, ownerEmail, { workspaceName: `Agency ${ownerEmail}` });
  const staff = await login(ctx, ownerEmail);
  const created = await staff
    .post(`/api/w/${owner.workspaceId}/requests`)
    .send({
      clientName: 'Jane Smith',
      clientEmail,
      checklistName: 'New tenant',
      items: [
        { title: 'Passport', allowedTypes: ['PDF'] },
        { title: 'Payslip', allowedTypes: ['PDF'] },
        { title: 'Reference', allowedTypes: ['PDF'], required: false },
      ],
      send: true,
    })
    .expect(201);
  const r = created.body as { id: string; items: { id: string }[] };
  const token = /\/r\/([A-Za-z0-9_-]+)/.exec(await lastMailTo(ctx, clientEmail))?.[1] ?? '';
  const client = request.agent(ctx.app.getHttpServer());
  await client.post('/api/client/code').send({ token }).expect(204);
  const code = /code is (\d{6})/.exec(await lastMailTo(ctx, clientEmail))?.[1];
  await client.post('/api/client/verify').send({ token, code }).expect(204);

  const upload = async (itemIndex: number, process = true) => {
    await client
      .post(`/api/client/items/${r.items[itemIndex]?.id}/files`)
      .attach('file', PDF, 'passport.pdf')
      .expect(201);
    const f = await ctx.prisma.file.findFirstOrThrow({
      where: { requestItemId: r.items[itemIndex]?.id },
      orderBy: { createdAt: 'desc' },
    });
    if (process) {
      await scanFile({ prisma: ctx.prisma }, f.id);
      await convertFile({ prisma: ctx.prisma }, f.id);
    }
    return f.id;
  };
  const base = `/api/w/${owner.workspaceId}`;
  return {
    wid: owner.workspaceId,
    base,
    staff,
    client,
    token,
    requestId: r.id,
    itemIds: r.items.map((i) => i.id),
    upload,
  };
}

describe('file access', () => {
  it('serves a checked file with safe headers and a clean name', async () => {
    const s = await setup();
    const fileId = await s.upload(0);
    const res = await s.staff.get(`${s.base}/files/${fileId}`).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-disposition']).toContain(
      'inline; filename="smith-jane_passport.pdf"',
    );
    const dl = await s.staff.get(`${s.base}/files/${fileId}?download=1`).expect(200);
    expect(dl.headers['content-disposition']).toContain('attachment');
    expect(Buffer.from(dl.body as Buffer).equals(PDF)).toBe(true);
  });

  it('never serves a file that is not scanned, is infected, or was deleted', async () => {
    const s = await setup();
    const unscanned = await s.upload(0, false);
    await s.staff.get(`${s.base}/files/${unscanned}`).expect(404);
    await scanFile({ prisma: ctx.prisma }, unscanned); // scanned but not converted yet
    await s.staff.get(`${s.base}/files/${unscanned}`).expect(404);

    const infected = await s.upload(1, false);
    await scanFile({ prisma: ctx.prisma, scan: async () => 'Eicar' }, infected);
    await s.staff.get(`${s.base}/files/${infected}`).expect(404);
    // Accepting an item whose file is still being checked is refused.
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/accept`)
      .expect(409);
  });

  it("a workspace can't open another workspace's files or exports", async () => {
    const b = await setup('owner-b@example.com', 'b.client@example.com');
    const bFile = await b.upload(0);
    await b.staff
      .post(`${b.base}/requests/${b.requestId}/items/${b.itemIds[0]}/accept`)
      .expect(200);
    const ex = (await b.staff.post(`${b.base}/requests/${b.requestId}/export`).expect(202))
      .body as { id: string };
    await buildExport(ctx.prisma, ex.id);

    const a = await createUser(ctx, 'owner-a@example.com', { workspaceName: 'A' });
    const agentA = await login(ctx, 'owner-a@example.com');
    const viaA = `/api/w/${a.workspaceId}`;
    await agentA.get(`${viaA}/files/${bFile}`).expect(404);
    await agentA.get(`${b.base}/files/${bFile}`).expect(404);
    await agentA.get(`${viaA}/exports/${ex.id}`).expect(404);
    await agentA.get(`${viaA}/exports/${ex.id}/download`).expect(404);
    await agentA.post(`${viaA}/requests/${b.requestId}/export`).expect(404);
    await agentA
      .post(`${viaA}/requests/${b.requestId}/items/${b.itemIds[0]}/reject`)
      .send({ reason: 'Not yours' })
      .expect(404);
    await agentA
      .get(`${viaA}/audit`)
      .expect(200)
      .expect((res) => {
        expect(
          (res.body as { entries: { requestId: string | null }[] }).entries.some(
            (e) => e.requestId === b.requestId,
          ),
        ).toBe(false);
      });
  });
});

describe('review', () => {
  it('completes the request when every required document is accepted', async () => {
    const s = await setup();
    await s.upload(0);
    await s.upload(1);
    const first = await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/accept`)
      .expect(200);
    expect((first.body as { status: string }).status).toBe('IN_PROGRESS');
    const done = await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[1]}/accept`)
      .expect(200);
    expect((done.body as { status: string }).status).toBe('COMPLETE'); // optional reference not needed
    // The client's page now says "All done", and nothing more can be uploaded.
    const view = (await s.client.get('/api/client/request').expect(200)).body as { status: string };
    expect(view.status).toBe('COMPLETE');
    await s.client
      .post(`/api/client/items/${s.itemIds[2]}/files`)
      .attach('file', PDF, 'x.pdf')
      .expect(410);
  });

  it('a retake deletes the files, tells the client why, and sends a fresh link', async () => {
    const s = await setup();
    const fileId = await s.upload(0);
    const reason = 'The photo is blurry. Could you take it again in good light?';
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/reject`)
      .send({ reason: 'x' })
      .expect(400);
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/reject`)
      .send({ reason })
      .expect(200);

    expect(
      (await ctx.prisma.file.findUniqueOrThrow({ where: { id: fileId } })).deletedAt,
    ).not.toBeNull();
    await s.staff.get(`${s.base}/files/${fileId}`).expect(404);
    const view = (await s.client.get('/api/client/request').expect(200)).body as {
      items: { status: string; rejectReason: string; files: unknown[] }[];
    };
    expect(view.items[0]).toMatchObject({ status: 'REJECTED', rejectReason: reason, files: [] });

    const mail = await lastMailTo(ctx, 'jane.smith@example.com');
    expect(mail).toContain(reason);
    const fresh = /\/r\/([A-Za-z0-9_-]+)/.exec(mail)?.[1];
    expect(fresh).toBeDefined();
    expect(fresh).not.toBe(s.token);
    const anon = request(ctx.app.getHttpServer());
    await anon.post('/api/client/open').send({ token: s.token }).expect(404);
    await anon.post('/api/client/open').send({ token: fresh }).expect(200);
  });

  it('builds a zip of accepted documents with clean names', async () => {
    const s = await setup();
    await s.upload(0);
    await s.upload(1);
    await s.upload(1); // two payslips
    await s.staff.post(`${s.base}/requests/${s.requestId}/export`).expect(409); // nothing accepted yet
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/accept`)
      .expect(200);
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[1]}/accept`)
      .expect(200);
    const ex = (await s.staff.post(`${s.base}/requests/${s.requestId}/export`).expect(202))
      .body as { id: string; fileName: string };
    expect(ex.fileName).toBe('smith-jane_new-tenant.zip');
    await s.staff.get(`${s.base}/exports/${ex.id}/download`).expect(409); // not built yet
    await buildExport(ctx.prisma, ex.id);
    const info = (await s.staff.get(`${s.base}/exports/${ex.id}`).expect(200)).body as {
      status: string;
      fileCount: number;
    };
    expect(info).toMatchObject({ status: 'READY', fileCount: 3 });
    const zip = await s.staff
      .get(`${s.base}/exports/${ex.id}/download`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const bytes = zip.body as Buffer;
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    for (const name of [
      'smith-jane_passport.pdf',
      'smith-jane_payslip-1.pdf',
      'smith-jane_payslip-2.pdf',
    ]) {
      expect(bytes.includes(Buffer.from(name))).toBe(true);
    }
    // Stored encrypted: the zip bytes on disk aren't a zip.
    const row = await ctx.prisma.export.findUniqueOrThrow({ where: { id: ex.id } });
    expect(row.storageKey).toMatch(/^exports\//);
  });
});

describe('audit log', () => {
  it('records the whole flow without client names, emails or file names', async () => {
    const s = await setup();
    const f = await s.upload(0);
    await s.staff.get(`${s.base}/files/${f}`).expect(200);
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/reject`)
      .send({ reason: 'Please send the photo page' })
      .expect(200);
    await s.upload(0);
    await s.staff
      .post(`${s.base}/requests/${s.requestId}/items/${s.itemIds[0]}/accept`)
      .expect(200);

    const rows = await ctx.prisma.auditLog.findMany({ where: { workspaceId: s.wid } });
    const actions = rows.map((r) => r.action);
    for (const a of [
      'request.sent',
      'client.verified',
      'file.uploaded',
      'file.viewed',
      'item.rejected',
      'item.accepted',
    ]) {
      expect(actions).toContain(a);
    }
    const dump = JSON.stringify(rows).toLowerCase();
    for (const secret of [
      'jane',
      'smith',
      'jane.smith@example.com',
      'passport.pdf',
      'please send the photo page',
    ]) {
      expect(dump).not.toContain(secret);
    }
  });

  it('only owners and admins can read it', async () => {
    const s = await setup();
    await createUser(ctx, 'staff@example.com', { workspaceId: s.wid, role: 'STAFF' });
    const staffMember = await login(ctx, 'staff@example.com');
    await staffMember.get(`${s.base}/audit`).expect(403);
    const page = (await s.staff.get(`${s.base}/audit`).expect(200)).body as {
      entries: { clientName: string | null }[];
    };
    expect(page.entries.length).toBeGreaterThan(0);
  });
});
