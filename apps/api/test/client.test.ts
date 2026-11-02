import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createUser,
  lastMailTo,
  login,
  resetState,
  setupApp,
  type TestContext,
} from './helpers.js';
import { envWrapper, seal, unseal } from '../src/files/envelope.js';
import { convertFile, INFECTED_MESSAGE, scanFile } from '../src/files/pipeline.js';
import { fileStore } from '../src/files/storage.js';

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
const EXE = Buffer.concat([Buffer.from('MZ'), randomBytes(512)]);

/** Creates and sends a request; returns its id, item ids and the raw link token from the email. */
async function sentRequest(email = 'client@example.com', ownerEmail = 'owner@example.com') {
  const owner = await createUser(ctx, ownerEmail, { workspaceName: `Agency ${ownerEmail}` });
  const agent = await login(ctx, ownerEmail);
  const res = await agent
    .post(`/api/w/${owner.workspaceId}/requests`)
    .send({
      clientName: 'Jane Smith',
      clientEmail: email,
      items: [
        { title: 'Passport', allowedTypes: ['PDF', 'JPEG'] },
        { title: 'Photo only', allowedTypes: ['JPEG', 'PNG'] },
      ],
      send: true,
    })
    .expect(201);
  const body = res.body as { id: string; items: { id: string }[] };
  const token = /\/r\/([A-Za-z0-9_-]+)/.exec(await lastMailTo(ctx, email))?.[1] ?? '';
  return {
    id: body.id,
    itemIds: body.items.map((i) => i.id),
    token,
    workspaceId: owner.workspaceId,
    agent,
  };
}

/** Opens the link, asks for a code, verifies it. Returns an agent holding the client session cookie. */
async function clientSession(token: string, email = 'client@example.com') {
  const client = request.agent(ctx.app.getHttpServer());
  await client.post('/api/client/open').send({ token }).expect(200);
  await client.post('/api/client/code').send({ token }).expect(204);
  const code = /code is (\d{6})/.exec(await lastMailTo(ctx, email))?.[1];
  await client.post('/api/client/verify').send({ token, code }).expect(204);
  return client;
}

describe('client link and code', () => {
  it('rejects unknown, expired, cancelled and replaced links', async () => {
    const r = await sentRequest();
    const anon = request(ctx.app.getHttpServer());
    await anon
      .post('/api/client/open')
      .send({ token: 'x'.repeat(43) })
      .expect(404);
    await anon.post('/api/client/open').send({ token: r.token }).expect(200);

    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { linkExpiresAt: new Date(Date.now() - 1000) },
    });
    await anon.post('/api/client/open').send({ token: r.token }).expect(410);
    await anon.post('/api/client/code').send({ token: r.token }).expect(410);

    await ctx.prisma.request.update({
      where: { id: r.id },
      data: { linkExpiresAt: new Date(Date.now() + 864e5) },
    });
    await r.agent.post(`/api/w/${r.workspaceId}/requests/${r.id}/send`).expect(200); // new link
    await anon.post('/api/client/open').send({ token: r.token }).expect(404); // old link is dead

    const fresh =
      /\/r\/([A-Za-z0-9_-]+)/.exec(await lastMailTo(ctx, 'client@example.com'))?.[1] ?? '';
    await r.agent.post(`/api/w/${r.workspaceId}/requests/${r.id}/cancel`).expect(200);
    await anon.post('/api/client/open').send({ token: fresh }).expect(410);
  });

  it('locks a code after 5 wrong tries, even if the right one follows', async () => {
    const r = await sentRequest();
    const client = request.agent(ctx.app.getHttpServer());
    await client.post('/api/client/code').send({ token: r.token }).expect(204);
    const code = /code is (\d{6})/.exec(await lastMailTo(ctx, 'client@example.com'))?.[1] ?? '';
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      await client.post('/api/client/verify').send({ token: r.token, code: wrong }).expect(401);
    await client.post('/api/client/verify').send({ token: r.token, code }).expect(401);
    await client.get('/api/client/request').expect(401);
  });

  it("a code only works with its own request's link", async () => {
    const a = await sentRequest('a.client@example.com', 'owner-a@example.com');
    const b = await sentRequest('b.client@example.com', 'owner-b@example.com');
    const anon = request.agent(ctx.app.getHttpServer());
    await anon.post('/api/client/code').send({ token: a.token }).expect(204);
    const codeA = /code is (\d{6})/.exec(await lastMailTo(ctx, 'a.client@example.com'))?.[1];
    await anon.post('/api/client/verify').send({ token: b.token, code: codeA }).expect(401);
  });

  it('a session only ever opens its own request', async () => {
    const a = await sentRequest('a.client@example.com', 'owner-a@example.com');
    const b = await sentRequest('b.client@example.com', 'owner-b@example.com');
    const sessionA = await clientSession(a.token, 'a.client@example.com');
    const sessionB = await clientSession(b.token, 'b.client@example.com');

    const view = await sessionA.get('/api/client/request').expect(200);
    expect((view.body as { items: { id: string }[] }).items.map((i) => i.id)).toEqual(a.itemIds);

    // Upload into B's item with A's session: not found, nothing stored.
    await sessionA
      .post(`/api/client/items/${b.itemIds[0]}/files`)
      .attach('file', PDF, 'x.pdf')
      .expect(404);
    expect(await ctx.prisma.file.count()).toBe(0);

    // B's own file can't be removed by A.
    await sessionB
      .post(`/api/client/items/${b.itemIds[0]}/files`)
      .attach('file', PDF, 'x.pdf')
      .expect(201);
    const bFile = await ctx.prisma.file.findFirstOrThrow();
    await sessionA.delete(`/api/client/files/${bFile.id}`).expect(404);
    expect(
      (await ctx.prisma.file.findUniqueOrThrow({ where: { id: bFile.id } })).deletedAt,
    ).toBeNull();

    // No session at all.
    await request(ctx.app.getHttpServer()).get('/api/client/request').expect(401);
    // A staff login is not a client session.
    await a.agent.get('/api/client/request').expect(401);
  });

  it('a cancelled request ends the session for uploads', async () => {
    const r = await sentRequest();
    const client = await clientSession(r.token);
    await r.agent.post(`/api/w/${r.workspaceId}/requests/${r.id}/cancel`).expect(200);
    await client
      .post(`/api/client/items/${r.itemIds[0]}/files`)
      .attach('file', PDF, 'x.pdf')
      .expect(410);
  });
});

describe('uploads', () => {
  it('checks the real type from the content, not the name or Content-Type', async () => {
    const r = await sentRequest();
    const client = await clientSession(r.token);
    await client
      .post(`/api/client/items/${r.itemIds[0]}/files`)
      .attach('file', EXE, { filename: 'passport.pdf', contentType: 'application/pdf' })
      .expect(415);
    // A real PDF where only photos are allowed.
    await client
      .post(`/api/client/items/${r.itemIds[1]}/files`)
      .attach('file', PDF, 'photo.jpg')
      .expect(415);
    expect(await ctx.prisma.file.count()).toBe(0);
  });

  it('rejects files over the size limit', async () => {
    const r = await sentRequest();
    const client = await clientSession(r.token);
    const big = Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024 + 10, 0x20)]); // test limit is 2 MB
    await client
      .post(`/api/client/items/${r.itemIds[0]}/files`)
      .attach('file', big, 'big.pdf')
      .expect(413);
  });

  it('stores only ciphertext, which decrypts back to the original', async () => {
    const r = await sentRequest();
    const client = await clientSession(r.token);
    const res = await client
      .post(`/api/client/items/${r.itemIds[0]}/files`)
      .attach('file', PDF, 'passport.pdf')
      .expect(201);
    const item = (res.body as { items: { status: string; files: unknown[] }[] }).items[0];
    expect(item?.status).toBe('SUBMITTED');
    expect(item?.files).toHaveLength(1);

    const f = await ctx.prisma.file.findFirstOrThrow();
    expect(f.storageKey).toMatch(/^files\/[0-9a-f]{2}\/[0-9a-f]{32}\.bin$/);
    const onDisk = await readFile(join(resolve('./tmp/test-files'), f.storageKey));
    expect(onDisk.includes(Buffer.from('%PDF'))).toBe(false);
    expect(await unseal({ ...f, ciphertext: onDisk })).toEqual(PDF);
    expect((await ctx.prisma.request.findUniqueOrThrow({ where: { id: r.id } })).status).toBe(
      'IN_PROGRESS',
    );
  });
});

describe('encryption', () => {
  it('round-trips, and fails with the wrong master key or tampered bytes', async () => {
    const plain = randomBytes(5000);
    const right = envWrapper(Buffer.alloc(32, 7).toString('base64'));
    const wrong = envWrapper(Buffer.alloc(32, 8).toString('base64'));
    const sealed = await seal(plain, right);
    expect(sealed.ciphertext.equals(plain)).toBe(false);
    expect(await unseal(sealed, right)).toEqual(plain);
    await expect(unseal(sealed, wrong)).rejects.toThrow();
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[10] = (tampered[10] ?? 0) ^ 0xff;
    await expect(unseal({ ...sealed, ciphertext: tampered }, right)).rejects.toThrow();
    // Two seals of the same bytes never share a key or IV.
    const again = await seal(plain, right);
    expect(again.iv).not.toBe(sealed.iv);
    expect(again.wrappedKey).not.toBe(sealed.wrappedKey);
  });
});

describe('processing pipeline', () => {
  async function uploaded(buf: Buffer, itemIndex = 0) {
    const r = await sentRequest();
    const client = await clientSession(r.token);
    await client
      .post(`/api/client/items/${r.itemIds[itemIndex]}/files`)
      .attach('file', buf, 'upload')
      .expect(201);
    return { r, client, file: await ctx.prisma.file.findFirstOrThrow() };
  }

  it('deletes an infected file and asks the client to upload again', async () => {
    const { r, client, file } = await uploaded(PDF);
    const ok = await scanFile({ prisma: ctx.prisma, scan: async () => 'Eicar-Signature' }, file.id);
    expect(ok).toBe(false);
    const after = await ctx.prisma.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(after.scanStatus).toBe('INFECTED');
    expect(after.deletedAt).not.toBeNull();
    await expect(fileStore().get(file.storageKey)).rejects.toThrow();
    const view = (await client.get('/api/client/request').expect(200)).body as {
      items: { status: string; rejectReason: string; files: unknown[] }[];
    };
    expect(view.items[0]).toMatchObject({
      status: 'PENDING',
      rejectReason: INFECTED_MESSAGE,
      files: [],
    });
    const log = await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'file.infected' } });
    expect(log).toMatchObject({ actorType: 'SYSTEM', requestId: r.id, entityId: file.id });
  });

  it('removes EXIF data including GPS, and shrinks big photos', async () => {
    const photo = await sharp({
      create: { width: 3600, height: 2400, channels: 3, background: '#8899aa' },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: 'Apple', Model: 'iPhone 15' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 27/1 40/1' },
      })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const { file } = await uploaded(photo, 1);
    expect(await scanFile({ prisma: ctx.prisma }, file.id)).toBe(true); // ClamAV off in tests: SKIPPED
    await convertFile({ prisma: ctx.prisma }, file.id);

    const after = await ctx.prisma.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(after).toMatchObject({ scanStatus: 'SKIPPED', mimeType: 'image/jpeg' });
    expect(after.processedAt).not.toBeNull();
    expect(after.storageKey).not.toBe(file.storageKey); // re-encrypted under a new key and name
    await expect(fileStore().get(file.storageKey)).rejects.toThrow(); // old bytes gone
    const out = await unseal({ ...after, ciphertext: await fileStore().get(after.storageKey) });
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(2400);
  });
});
