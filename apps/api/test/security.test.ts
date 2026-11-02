import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PASSWORD, createUser, login, resetState, setupApp, type TestContext } from './helpers.js';

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

describe('rate limits', () => {
  it('blocks login after 10 attempts for the same email', async () => {
    await createUser(ctx, 'owner@example.com');
    const http = request(ctx.app.getHttpServer());
    for (let i = 0; i < 10; i++) {
      await http.post('/api/auth/login').send({ email: 'owner@example.com', password: 'wrong password!' }).expect(401);
    }
    await http.post('/api/auth/login').send({ email: 'owner@example.com', password: PASSWORD }).expect(429);
  });

  it('limits code verification attempts per IP', async () => {
    const http = request(ctx.app.getHttpServer());
    for (let i = 0; i < 10; i++) {
      await http.post('/api/auth/login/verify').send({ code: '123456' }).expect(401);
    }
    await http.post('/api/auth/login/verify').send({ code: '123456' }).expect(429);
  });

  it('limits password reset requests', async () => {
    const http = request(ctx.app.getHttpServer());
    for (let i = 0; i < 5; i++) {
      await http.post('/api/auth/password/forgot').send({ email: 'x@example.com' }).expect(204);
    }
    await http.post('/api/auth/password/forgot').send({ email: 'x@example.com' }).expect(429);
  });
});

describe('cross-site request protection', () => {
  it('rejects state-changing requests from another site', async () => {
    const { workspaceId } = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    await agent
      .patch(`/api/w/${workspaceId}/settings`)
      .set('Origin', 'https://evil.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ name: 'Hacked' })
      .expect(403);
    await agent
      .patch(`/api/w/${workspaceId}/settings`)
      .set('Origin', 'https://evil.example')
      .send({ name: 'Hacked' })
      .expect(403);
    const w = await ctx.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(w.name).toBe('Test Workspace');
  });

  it('allows the web app origin and plain GETs', async () => {
    const { workspaceId } = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    await agent
      .patch(`/api/w/${workspaceId}/settings`)
      .set('Origin', 'http://localhost:8020')
      .send({ name: 'Renamed' })
      .expect(200);
    await agent.get(`/api/w/${workspaceId}/settings`).set('Origin', 'https://evil.example').expect(200);
  });
});

describe('response hygiene', () => {
  it('sets security headers and never returns password hashes', async () => {
    const { workspaceId } = await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const res = await agent.get(`/api/w/${workspaceId}/members`).expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash/);
  });

  it('the audit log is append-only at the database level', async () => {
    await ctx.prisma.auditLog.create({
      data: { actorType: 'SYSTEM', action: 'auth.login', entityType: 'user' },
    });
    await expect(ctx.prisma.auditLog.updateMany({ data: { action: 'changed' } })).rejects.toThrow();
    await expect(ctx.prisma.auditLog.deleteMany({})).rejects.toThrow();
  });
});
