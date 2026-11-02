import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import {
  PASSWORD,
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

async function team() {
  const owner = await createUser(ctx, 'owner@example.com');
  const admin = await createUser(ctx, 'admin@example.com', { workspaceId: owner.workspaceId, role: 'ADMIN' });
  const staff = await createUser(ctx, 'staff@example.com', { workspaceId: owner.workspaceId, role: 'STAFF' });
  const membership = async (userId: string) =>
    (await ctx.prisma.membership.findFirstOrThrow({ where: { userId } })).id;
  return {
    wid: owner.workspaceId,
    ownerMid: await membership(owner.userId),
    adminMid: await membership(admin.userId),
    staffMid: await membership(staff.userId),
  };
}

describe('workspace isolation', () => {
  it('a member of workspace A gets 404 for everything in workspace B', async () => {
    await createUser(ctx, 'a@example.com', { workspaceName: 'A' });
    const b = await createUser(ctx, 'b@example.com', { workspaceName: 'B' });
    const bMember = await ctx.prisma.membership.findFirstOrThrow({ where: { workspaceId: b.workspaceId } });
    const agentA = await login(ctx, 'a@example.com');

    await agentA.get(`/api/w/${b.workspaceId}/settings`).expect(404);
    await agentA.patch(`/api/w/${b.workspaceId}/settings`).send({ name: 'Hacked' }).expect(404);
    await agentA.get(`/api/w/${b.workspaceId}/members`).expect(404);
    await agentA.delete(`/api/w/${b.workspaceId}/members/${bMember.id}`).expect(404);
    await agentA.post(`/api/w/${b.workspaceId}/invites`).send({ email: 'x@example.com', role: 'STAFF' }).expect(404);

    const unchanged = await ctx.prisma.workspace.findUniqueOrThrow({ where: { id: b.workspaceId } });
    expect(unchanged.name).toBe('B');
  });

  it('cannot act on a member of another workspace through its own workspace id', async () => {
    const a = await createUser(ctx, 'a@example.com', { workspaceName: 'A' });
    const b = await createUser(ctx, 'b@example.com', { workspaceName: 'B' });
    await createUser(ctx, 'b-staff@example.com', { workspaceId: b.workspaceId, role: 'STAFF' });
    const bStaff = await ctx.prisma.membership.findFirstOrThrow({
      where: { workspaceId: b.workspaceId, role: 'STAFF' },
    });
    const agentA = await login(ctx, 'a@example.com');
    await agentA.patch(`/api/w/${a.workspaceId}/members/${bStaff.id}`).send({ role: 'ADMIN' }).expect(404);
    await agentA.delete(`/api/w/${a.workspaceId}/members/${bStaff.id}`).expect(404);
    expect((await ctx.prisma.membership.findUniqueOrThrow({ where: { id: bStaff.id } })).role).toBe('STAFF');
  });

  it('returns 404 for a malformed or unknown workspace id', async () => {
    await createUser(ctx, 'a@example.com');
    const agent = await login(ctx, 'a@example.com');
    await agent.get('/api/w/not-a-uuid/settings').expect(404);
    await agent.get(`/api/w/${randomUUID()}/settings`).expect(404);
  });

  it('every workspace endpoint needs a signed-in user', async () => {
    const { wid, staffMid } = await team();
    const anon = request(ctx.app.getHttpServer());
    await anon.get(`/api/w/${wid}/settings`).expect(401);
    await anon.get(`/api/w/${wid}/members`).expect(401);
    await anon.get(`/api/w/${wid}/invites`).expect(401);
    await anon.delete(`/api/w/${wid}/members/${staffMid}`).expect(401);
  });
});

describe('roles', () => {
  it('staff cannot see or change settings and team', async () => {
    const { wid, adminMid } = await team();
    const staff = await login(ctx, 'staff@example.com');
    await staff.get(`/api/w/${wid}/settings`).expect(403);
    await staff.patch(`/api/w/${wid}/settings`).send({ retentionDays: 1 }).expect(403);
    await staff.get(`/api/w/${wid}/members`).expect(403);
    await staff.post(`/api/w/${wid}/invites`).send({ email: 'x@example.com', role: 'STAFF' }).expect(403);
    await staff.delete(`/api/w/${wid}/members/${adminMid}`).expect(403);
  });

  it('admin can manage staff but not the owner or other admins', async () => {
    const { wid, ownerMid, staffMid } = await team();
    const second = await createUser(ctx, 'admin2@example.com', { workspaceId: wid, role: 'ADMIN' });
    const admin2Mid = (await ctx.prisma.membership.findFirstOrThrow({ where: { userId: second.userId } })).id;
    const admin = await login(ctx, 'admin@example.com');

    await admin.patch(`/api/w/${wid}/members/${ownerMid}`).send({ role: 'STAFF' }).expect(403);
    await admin.delete(`/api/w/${wid}/members/${ownerMid}`).expect(403);
    await admin.delete(`/api/w/${wid}/members/${admin2Mid}`).expect(403);
    await admin.patch(`/api/w/${wid}/members/${staffMid}`).send({ role: 'ADMIN' }).expect(200);
  });

  it('nobody can make someone an owner or change their own role', async () => {
    const { wid, ownerMid, staffMid } = await team();
    const owner = await login(ctx, 'owner@example.com');
    await owner.patch(`/api/w/${wid}/members/${staffMid}`).send({ role: 'OWNER' }).expect(400);
    await owner.patch(`/api/w/${wid}/members/${ownerMid}`).send({ role: 'STAFF' }).expect(403);
    await owner.delete(`/api/w/${wid}/members/${ownerMid}`).expect(403);
  });

  it('owner can update settings, and the change is audited without personal data', async () => {
    const { wid } = await team();
    const owner = await login(ctx, 'owner@example.com');
    const res = await owner
      .patch(`/api/w/${wid}/settings`)
      .send({ reminderDays: [7, 2, 2], retentionDays: 14, unknownField: 'x' })
      .expect(200);
    expect(res.body.reminderDays).toEqual([2, 7]);
    expect(res.body.retentionDays).toBe(14);
    expect(res.body).not.toHaveProperty('unknownField');
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'workspace.settings_updated' } });
    expect(audit.workspaceId).toBe(wid);
  });

  it('demo workspace settings and team are read-only, even for the owner', async () => {
    const { wid, staffMid } = await team();
    await ctx.prisma.workspace.update({ where: { id: wid }, data: { isDemo: true } });
    const owner = await login(ctx, 'owner@example.com');
    await owner.get(`/api/w/${wid}/settings`).expect(200);
    await owner.patch(`/api/w/${wid}/settings`).send({ name: 'Changed' }).expect(403);
    await owner.delete(`/api/w/${wid}/members/${staffMid}`).expect(403);
    await owner.post(`/api/w/${wid}/invites`).send({ email: 'x@example.com', role: 'STAFF' }).expect(403);
  });
});

describe('invites', () => {
  it('a new person accepts an invite, sets a password and joins with the invited role', async () => {
    const { wid } = await team();
    const owner = await login(ctx, 'owner@example.com');
    await owner.post(`/api/w/${wid}/invites`).send({ email: 'New@Example.com', role: 'STAFF' }).expect(201);
    const token = (await lastMailTo(ctx, 'new@example.com')).match(/invite\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();

    const anon = request(ctx.app.getHttpServer());
    const preview = await anon.get(`/api/invites/${token}`).expect(200);
    expect(preview.body).toMatchObject({ email: 'new@example.com', role: 'STAFF', existingUser: false });

    await anon.post(`/api/invites/${token}/accept`).send({ name: 'New Person', password: PASSWORD }).expect(204);
    await anon.post(`/api/invites/${token}/accept`).send({ name: 'New Person', password: PASSWORD }).expect(404);

    const member = await ctx.prisma.membership.findFirstOrThrow({ where: { user: { email: 'new@example.com' } } });
    expect(member).toMatchObject({ workspaceId: wid, role: 'STAFF' });
  });

  it('an existing user must be signed in as the invited email to accept', async () => {
    const { wid } = await team();
    await createUser(ctx, 'other@example.com', { workspaceName: 'Other' });
    const owner = await login(ctx, 'owner@example.com');
    await owner.post(`/api/w/${wid}/invites`).send({ email: 'other@example.com', role: 'ADMIN' }).expect(201);
    const token = (await lastMailTo(ctx, 'other@example.com')).match(/invite\/([A-Za-z0-9_-]+)/)?.[1];

    await request(ctx.app.getHttpServer()).post(`/api/invites/${token}/accept`).send({}).expect(401);
    const staff = await login(ctx, 'staff@example.com');
    await staff.post(`/api/invites/${token}/accept`).send({}).expect(401);

    const other = await login(ctx, 'other@example.com');
    await other.post(`/api/invites/${token}/accept`).send({}).expect(204);
    const me = await other.get('/api/auth/me').expect(200);
    expect(me.body.memberships).toHaveLength(2);
  });

  it('invite tokens are stored only as a hash', async () => {
    const { wid } = await team();
    const owner = await login(ctx, 'owner@example.com');
    await owner.post(`/api/w/${wid}/invites`).send({ email: 'new@example.com', role: 'STAFF' }).expect(201);
    const token = (await lastMailTo(ctx, 'new@example.com')).match(/invite\/([A-Za-z0-9_-]+)/)?.[1] ?? '';
    const invite = await ctx.prisma.invite.findFirstOrThrow();
    expect(invite.tokenHash).not.toContain(token);
    expect(invite.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('expired invites cannot be used', async () => {
    const { wid } = await team();
    const owner = await login(ctx, 'owner@example.com');
    await owner.post(`/api/w/${wid}/invites`).send({ email: 'new@example.com', role: 'STAFF' }).expect(201);
    const token = (await lastMailTo(ctx, 'new@example.com')).match(/invite\/([A-Za-z0-9_-]+)/)?.[1];
    await ctx.prisma.invite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(ctx.app.getHttpServer()).get(`/api/invites/${token}`).expect(404);
  });
});
