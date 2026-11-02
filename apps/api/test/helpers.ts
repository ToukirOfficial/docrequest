import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.factory.js';
import { PrismaService } from '../src/common/prisma.service.js';
import { RedisService } from '../src/common/redis.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { hashPassword } from '../src/auth/passwords.js';
import type { Role } from '../src/generated/prisma/enums.js';

export const PASSWORD = 'correct horse battery staple';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  redis: RedisService;
  mail: MailService;
}

export async function setupApp(): Promise<TestContext> {
  const app = await createApp();
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
    mail: app.get(MailService),
  };
}

/** Empties every table and this test run's Redis keys. */
export async function resetState(ctx: TestContext): Promise<void> {
  const tables = await ctx.prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length > 0) {
    await ctx.prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
    );
  }
  const keys = await ctx.redis.keys('docrequest-test:*');
  if (keys.length > 0) {
    // keys() returns full names; del() would add the prefix again, so strip it.
    await ctx.redis.del(...keys.map((k) => k.replace(/^docrequest-test:/, '')));
  }
}

/** Reads the most recent queued email to this address (no worker runs in tests). */
export async function lastMailTo(ctx: TestContext, to: string): Promise<string> {
  const jobs = await ctx.mail.queue.getJobs(['waiting', 'delayed', 'prioritized'], 0, 200);
  const job = jobs
    .filter((j) => j.data.to === to)
    .sort((a, b) => b.timestamp - a.timestamp || Number(b.id) - Number(a.id))[0];
  if (!job) throw new Error(`No mail queued for ${to}`);
  return `${job.data.subject}\n${job.data.text}`;
}

export function codeFrom(mail: string): string {
  const m = mail.match(/\b(\d{6})\b/);
  if (!m?.[1]) throw new Error('No code in mail');
  return m[1];
}

export async function createUser(
  ctx: TestContext,
  email: string,
  opts: { workspaceId?: string; role?: Role; workspaceName?: string } = {},
): Promise<{ userId: string; workspaceId: string }> {
  const user = await ctx.prisma.user.create({
    data: { email, name: 'Test Person', passwordHash: await hashPassword(PASSWORD) },
  });
  const workspaceId =
    opts.workspaceId ??
    (await ctx.prisma.workspace.create({ data: { name: opts.workspaceName ?? 'Test Workspace' } }))
      .id;
  await ctx.prisma.membership.create({
    data: { userId: user.id, workspaceId, role: opts.role ?? 'OWNER' },
  });
  return { userId: user.id, workspaceId };
}

/** Full login (password + emailed code). Returns an agent holding the cookies. */
export async function login(ctx: TestContext, email: string): Promise<TestAgent> {
  const agent = request.agent(ctx.app.getHttpServer());
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  const code = codeFrom(await lastMailTo(ctx, email));
  await agent.post('/api/auth/login/verify').send({ code }).expect(204);
  return agent;
}

export function cookieValue(
  res: { headers: Record<string, unknown> },
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  for (const c of list) {
    const [pair] = c.split(';');
    if (pair?.startsWith(`${name}=`)) return pair.slice(name.length + 1);
  }
  return undefined;
}
