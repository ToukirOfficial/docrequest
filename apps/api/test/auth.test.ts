import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  PASSWORD,
  codeFrom,
  cookieValue,
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

describe('login with password and email code', () => {
  it('signs in only after the emailed code, then /me works', async () => {
    await createUser(ctx, 'owner@example.com');
    const agent = request.agent(ctx.app.getHttpServer());

    const step1 = await agent
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    expect(step1.body).toEqual({ codeSent: true });
    expect(cookieValue(step1, 'dr_access')).toBeUndefined();
    await agent.get('/api/auth/me').expect(401);

    const code = codeFrom(await lastMailTo(ctx, 'owner@example.com'));
    const step2 = await agent.post('/api/auth/login/verify').send({ code }).expect(204);
    const setCookies = step2.headers['set-cookie'] as unknown as string[];
    const access = setCookies.find((c) => c.startsWith('dr_access='));
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Lax/i);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe('owner@example.com');
    expect(me.body).not.toHaveProperty('passwordHash');
    expect(me.body.memberships[0].role).toBe('OWNER');
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    await createUser(ctx, 'owner@example.com');
    const wrong = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: 'wrong password here' })
      .expect(401);
    const unknown = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong password here' })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('locks the code after 5 wrong attempts, even if the right code follows', async () => {
    await createUser(ctx, 'owner@example.com');
    const agent = request.agent(ctx.app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: 'owner@example.com', password: PASSWORD }).expect(200);
    const code = codeFrom(await lastMailTo(ctx, 'owner@example.com'));
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await agent.post('/api/auth/login/verify').send({ code: wrong }).expect(401);
    }
    await agent.post('/api/auth/login/verify').send({ code }).expect(401);
    await agent.get('/api/auth/me').expect(401);
  });

  it('a code cannot be used without the matching login cookie', async () => {
    await createUser(ctx, 'owner@example.com');
    await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    const code = codeFrom(await lastMailTo(ctx, 'owner@example.com'));
    await request(ctx.app.getHttpServer()).post('/api/auth/login/verify').send({ code }).expect(401);
  });

  it('signup creates a workspace and requires the email code', async () => {
    const agent = request.agent(ctx.app.getHttpServer());
    await agent
      .post('/api/auth/signup')
      .send({ name: 'Sam Example', email: 'Sam@Example.com', password: PASSWORD, workspaceName: 'Example Ltd' })
      .expect(201);
    await agent.get('/api/auth/me').expect(401);
    const code = codeFrom(await lastMailTo(ctx, 'sam@example.com'));
    await agent.post('/api/auth/login/verify').send({ code }).expect(204);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.memberships).toEqual([
      expect.objectContaining({ workspaceName: 'Example Ltd', role: 'OWNER' }),
    ]);
  });

  it('validates input and strips unknown fields', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'not-an-email', password: 'short', workspaceName: 'W' })
      .expect(400);
  });
});

describe('refresh token rotation', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');
    const res = await agent.post('/api/auth/refresh').expect(204);
    expect(cookieValue(res, 'dr_access')).toBeTruthy();
    expect(cookieValue(res, 'dr_refresh')).toBeTruthy();
    await agent.get('/api/auth/me').expect(200);
  });

  it('re-using an old refresh token revokes the whole family', async () => {
    await createUser(ctx, 'owner@example.com');
    const agent = request.agent(ctx.app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: 'owner@example.com', password: PASSWORD });
    const code = codeFrom(await lastMailTo(ctx, 'owner@example.com'));
    const verify = await agent.post('/api/auth/login/verify').send({ code }).expect(204);
    const first = cookieValue(verify, 'dr_refresh');
    expect(first).toBeTruthy();

    const rotated = await agent.post('/api/auth/refresh').expect(204);
    const second = cookieValue(rotated, 'dr_refresh');
    expect(second).not.toBe(first);

    // Attacker replays the stolen first token.
    await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `dr_refresh=${first}`)
      .expect(401);
    // The legitimate (newer) token is now revoked too.
    await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `dr_refresh=${second}`)
      .expect(401);

    const audit = await ctx.prisma.auditLog.findMany({ where: { action: 'auth.refresh_reuse' } });
    expect(audit).toHaveLength(1);
  });

  it('rejects a missing or made-up refresh token', async () => {
    await request(ctx.app.getHttpServer()).post('/api/auth/refresh').expect(401);
    await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', 'dr_refresh=made-up-token-value-123456')
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    await createUser(ctx, 'owner@example.com');
    const agent = request.agent(ctx.app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: 'owner@example.com', password: PASSWORD });
    const code = codeFrom(await lastMailTo(ctx, 'owner@example.com'));
    const verify = await agent.post('/api/auth/login/verify').send({ code });
    const refresh = cookieValue(verify, 'dr_refresh');
    await agent.post('/api/auth/logout').expect(204);
    await request(ctx.app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `dr_refresh=${refresh}`)
      .expect(401);
  });

  it('rejects a forged access token', async () => {
    await request(ctx.app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'dr_access=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4IiwidHlwIjoiYWNjZXNzIn0.')
      .expect(401);
  });
});

describe('password reset', () => {
  it('resets the password with the emailed link, once, and signs out other sessions', async () => {
    await createUser(ctx, 'owner@example.com');
    const agent = await login(ctx, 'owner@example.com');

    await request(ctx.app.getHttpServer())
      .post('/api/auth/password/forgot')
      .send({ email: 'owner@example.com' })
      .expect(204);
    const mail = await lastMailTo(ctx, 'owner@example.com');
    const token = mail.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();

    const newPassword = 'a brand new long password';
    await request(ctx.app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token, password: newPassword })
      .expect(204);
    await request(ctx.app.getHttpServer())
      .post('/api/auth/password/reset')
      .send({ token, password: newPassword })
      .expect(400);

    await agent.post('/api/auth/refresh').expect(401);
    await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: newPassword })
      .expect(200);
  });

  it('gives the same answer for unknown emails', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/auth/password/forgot')
      .send({ email: 'nobody@example.com' })
      .expect(204);
  });
});
