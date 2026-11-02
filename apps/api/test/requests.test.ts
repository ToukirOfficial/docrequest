import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  createUser,
  lastMailTo,
  login,
  resetState,
  setupApp,
  type TestContext,
} from './helpers.js';

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

const items = [
  { title: 'Passport', helpText: 'Photo page', required: true, allowedTypes: ['PDF', 'JPEG'] },
  { title: 'Reference', helpText: '', required: false, allowedTypes: ['PDF'] },
];
const newRequest = (extra: Record<string, unknown> = {}) => ({
  clientName: 'Jane Smith',
  clientEmail: 'jane.client@example.com',
  checklistName: 'New tenant',
  items,
  ...extra,
});

async function twoWorkspaces() {
  const a = await createUser(ctx, 'a@example.com', { workspaceName: 'A' });
  const b = await createUser(ctx, 'b@example.com', { workspaceName: 'B' });
  const agentA = await login(ctx, 'a@example.com');
  const agentB = await login(ctx, 'b@example.com');
  return { a, b, agentA, agentB };
}

describe('templates', () => {
  it('lists the five built-in templates to every role', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    await createUser(ctx, 'staff@example.com', { workspaceId: owner.workspaceId, role: 'STAFF' });
    const staff = await login(ctx, 'staff@example.com');
    const res = await staff.get(`/api/w/${owner.workspaceId}/templates`).expect(200);
    const builtIns = (res.body as { builtIn: boolean; name: string }[]).filter((t) => t.builtIn);
    expect(builtIns.map((t) => t.name)).toEqual([
      'New tenant',
      'New employee (right to work)',
      'Self-assessment tax return',
      'Immigration case',
      'Mortgage application',
    ]);
  });

  it('staff can read but not create, edit or delete templates', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    await createUser(ctx, 'staff@example.com', { workspaceId: owner.workspaceId, role: 'STAFF' });
    const ownerAgent = await login(ctx, 'owner@example.com');
    const staff = await login(ctx, 'staff@example.com');
    const base = `/api/w/${owner.workspaceId}/templates`;

    await staff.post(base).send({ name: 'Mine', items }).expect(403);
    const created = await ownerAgent.post(base).send({ name: 'Ours', items }).expect(201);
    const id = (created.body as { id: string }).id;
    await staff.get(`${base}/${id}`).expect(200);
    await staff.put(`${base}/${id}`).send({ name: 'Changed', items }).expect(403);
    await staff.delete(`${base}/${id}`).expect(403);
    await ownerAgent.put(`${base}/${id}`).send({ name: 'Changed', items }).expect(200);
    await ownerAgent.delete(`${base}/${id}`).expect(204);
  });

  it('built-in templates are read-only', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const base = `/api/w/${owner.workspaceId}/templates`;
    await agent.get(`${base}/builtin-new-tenant`).expect(200);
    await agent.put(`${base}/builtin-new-tenant`).send({ name: 'X', items }).expect(403);
    await agent.delete(`${base}/builtin-new-tenant`).expect(403);
  });

  it("a workspace can't see or change another workspace's templates", async () => {
    const { a, b, agentA, agentB } = await twoWorkspaces();
    const created = await agentB
      .post(`/api/w/${b.workspaceId}/templates`)
      .send({ name: 'B only', items })
      .expect(201);
    const id = (created.body as { id: string }).id;

    // Through its own workspace id: not found. Through B's id: not a member.
    await agentA.get(`/api/w/${a.workspaceId}/templates/${id}`).expect(404);
    await agentA
      .put(`/api/w/${a.workspaceId}/templates/${id}`)
      .send({ name: 'Hacked', items })
      .expect(404);
    await agentA.delete(`/api/w/${a.workspaceId}/templates/${id}`).expect(404);
    await agentA.get(`/api/w/${b.workspaceId}/templates`).expect(404);
    const listA = await agentA.get(`/api/w/${a.workspaceId}/templates`).expect(200);
    expect((listA.body as { id: string }[]).some((t) => t.id === id)).toBe(false);
    expect((await ctx.prisma.template.findUniqueOrThrow({ where: { id } })).name).toBe('B only');
  });
});

describe('requests', () => {
  it('stores the client link only as a SHA-256 hash, and a resend replaces it', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const res = await agent
      .post(`/api/w/${owner.workspaceId}/requests`)
      .send(newRequest({ send: true }))
      .expect(201);
    const id = (res.body as { id: string; status: string }).id;
    expect((res.body as { status: string }).status).toBe('SENT');

    const mail = await lastMailTo(ctx, 'jane.client@example.com');
    const token = /\/r\/([A-Za-z0-9_-]{40,})/.exec(mail)?.[1];
    expect(token).toBeDefined();
    const row = await ctx.prisma.request.findUniqueOrThrow({ where: { id } });
    expect(row.linkHash).toBe(createHash('sha256').update(token!).digest('hex'));
    // The raw token appears nowhere in the stored row.
    expect(JSON.stringify(row)).not.toContain(token!);
    // Nor in the API response.
    expect(JSON.stringify(res.body)).not.toContain(token!);

    await agent.post(`/api/w/${owner.workspaceId}/requests/${id}/send`).expect(200);
    const after = await ctx.prisma.request.findUniqueOrThrow({ where: { id } });
    expect(after.linkHash).not.toBe(row.linkHash);
    expect(after.linkHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a workspace gets 404 for every action on another workspace's request", async () => {
    const { a, b, agentA, agentB } = await twoWorkspaces();
    const created = await agentB
      .post(`/api/w/${b.workspaceId}/requests`)
      .send(newRequest())
      .expect(201);
    const id = (created.body as { id: string }).id;
    const viaA = `/api/w/${a.workspaceId}/requests/${id}`;

    await agentA.get(viaA).expect(404);
    await agentA.patch(viaA).send({ clientName: 'Hacked' }).expect(404);
    await agentA.put(`${viaA}/items`).send({ items }).expect(404);
    await agentA.post(`${viaA}/send`).expect(404);
    await agentA.post(`${viaA}/cancel`).expect(404);
    await agentA.delete(viaA).expect(404);
    await agentA.get(`/api/w/${b.workspaceId}/requests/${id}`).expect(404);
    await agentA.get(`/api/w/${b.workspaceId}/requests`).expect(404);
    await agentA.get(`/api/w/${b.workspaceId}/dashboard`).expect(404);

    const listA = await agentA.get(`/api/w/${a.workspaceId}/requests`).expect(200);
    expect((listA.body as { total: number }).total).toBe(0);
    const row = await ctx.prisma.request.findUniqueOrThrow({ where: { id } });
    expect(row.clientName).toBe('Jane Smith');
    expect(row.status).toBe('DRAFT');
    expect(await lastMailTo(ctx, 'jane.client@example.com').catch(() => 'none')).toBe('none');
  });

  it('staff can create, send and cancel requests', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    await createUser(ctx, 'staff@example.com', { workspaceId: owner.workspaceId, role: 'STAFF' });
    const staff = await login(ctx, 'staff@example.com');
    const base = `/api/w/${owner.workspaceId}/requests`;
    const res = await staff.post(base).send(newRequest()).expect(201);
    const id = (res.body as { id: string }).id;
    await staff.post(`${base}/${id}/send`).expect(200);
    const cancelled = await staff.post(`${base}/${id}/cancel`).expect(200);
    expect((cancelled.body as { status: string }).status).toBe('EXPIRED');
    // Ended requests can't be changed or re-sent.
    await staff.post(`${base}/${id}/send`).expect(409);
  });

  it('only drafts can be deleted', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const base = `/api/w/${owner.workspaceId}/requests`;
    const draft = (await agent.post(base).send(newRequest()).expect(201)).body as { id: string };
    const sent = (
      await agent
        .post(base)
        .send(newRequest({ send: true }))
        .expect(201)
    ).body as { id: string };
    await agent.delete(`${base}/${sent.id}`).expect(409);
    await agent.delete(`${base}/${draft.id}`).expect(204);
  });

  it('filters overdue requests and counts them on the dashboard', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const base = `/api/w/${owner.workspaceId}`;
    await agent
      .post(`${base}/requests`)
      .send(newRequest({ send: true, dueDate: '2020-01-10' }))
      .expect(201);
    await agent
      .post(`${base}/requests`)
      .send(newRequest({ send: true, dueDate: '2099-01-10' }))
      .expect(201);
    await agent
      .post(`${base}/requests`)
      .send(newRequest({ dueDate: '2020-01-10' }))
      .expect(201); // draft: never overdue

    const overdue = await agent.get(`${base}/requests?filter=OVERDUE`).expect(200);
    expect((overdue.body as { total: number }).total).toBe(1);
    const dash = await agent.get(`${base}/dashboard`).expect(200);
    const d = dash.body as {
      stats: { open: number; overdue: number };
      attention: unknown[];
      activity: unknown[];
    };
    expect(d.stats).toMatchObject({ open: 2, overdue: 1 });
    expect(d.attention).toHaveLength(1);
    expect(d.activity.length).toBeGreaterThan(0);
  });

  it('rejects invalid input', async () => {
    const owner = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const base = `/api/w/${owner.workspaceId}/requests`;
    await agent
      .post(base)
      .send(newRequest({ clientEmail: 'not-an-email' }))
      .expect(400);
    await agent
      .post(base)
      .send(newRequest({ items: [] }))
      .expect(400);
    await agent
      .post(base)
      .send(newRequest({ items: [{ ...items[0], allowedTypes: ['EXE'] }] }))
      .expect(400);
    await agent
      .post(base)
      .send(newRequest({ dueDate: '13/11/2026' }))
      .expect(400);
  });
});
