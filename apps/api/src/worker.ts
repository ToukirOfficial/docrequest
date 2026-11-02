import { Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import {
  CONVERT_QUEUE,
  EXPORT_QUEUE,
  MAIL_QUEUE,
  QUEUE_PREFIX,
  SCAN_QUEUE,
  SWEEP_QUEUE,
  bullConnection,
  type ExportJob,
  type FileJob,
} from './queue/queues.js';
import { EXPORT_TTL_MS, buildExport, expireExport } from './files/export.js';
import { reminderSweep } from './sweeps/reminders.js';
import { expirySweep, retentionSweep } from './sweeps/retention.js';
import { env } from './config/env.js';
import { DEMO_SEEDED_AT_KEY, purgeVisitorUploads, resetDemo, seedDemo } from './demo/seed.js';
import { RedisService } from './common/redis.service.js';
import { createMailSender } from './mail/mail.sender.js';
import type { MailMessage } from './mail/templates.js';
import { PrismaService } from './common/prisma.service.js';
import { convertFile, rejectUnreadable, scanFile } from './files/pipeline.js';

const logger = new Logger('Worker');
const sendMail = createMailSender();
const prisma = new PrismaService();
const redis = new RedisService();
const markSeeded = async (at: Date) => void (await redis.set(DEMO_SEEDED_AT_KEY, at.toISOString()));
const convertQueue = new Queue<FileJob>(CONVERT_QUEUE, {
  connection: bullConnection(),
  prefix: QUEUE_PREFIX,
});
const exportQueue = new Queue<ExportJob>(EXPORT_QUEUE, {
  connection: bullConnection(),
  prefix: QUEUE_PREFIX,
});
const mailQueue = new Queue<MailMessage>(MAIL_QUEUE, {
  connection: bullConnection(),
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
const sweepQueue = new Queue(SWEEP_QUEUE, { connection: bullConnection(), prefix: QUEUE_PREFIX });
const opts = { connection: bullConnection(), prefix: QUEUE_PREFIX };

// One at a time: decoding big photos uses a lot of memory on a small server.
const convertWorker = new Worker<FileJob>(
  CONVERT_QUEUE,
  async (job) => convertFile({ prisma }, job.data.fileId),
  {
    ...opts,
    concurrency: 1,
  },
);
// Out of retries on a file the converter can't read: ask the client for a new one.
convertWorker.on('failed', (job) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1))
    void rejectUnreadable({ prisma }, job.data.fileId);
});

const exportWorker = new Worker<ExportJob>(
  EXPORT_QUEUE,
  async (job) => {
    if (job.data.expire) return expireExport(prisma, job.data.exportId);
    await buildExport(prisma, job.data.exportId);
    // Delete the zip again after an hour.
    await exportQueue.add(
      'expire',
      { exportId: job.data.exportId, expire: true },
      { delay: EXPORT_TTL_MS, removeOnComplete: true },
    );
  },
  { ...opts, concurrency: 1 },
);

const workers: Worker[] = [
  new Worker<MailMessage>(
    MAIL_QUEUE,
    async (job) => {
      await sendMail(job.data);
    },
    { ...opts, concurrency: 5 },
  ),
  new Worker<FileJob>(
    SCAN_QUEUE,
    async (job) => {
      if (await scanFile({ prisma }, job.data.fileId)) {
        await convertQueue.add('convert', job.data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 100,
        });
      }
    },
    { ...opts, concurrency: 2 },
  ),
  convertWorker,
  exportWorker,
];

for (const w of workers) {
  // Log job ids only: never email addresses, names or file contents.
  w.on('failed', (job, err) =>
    logger.warn(
      `${w.name} job ${job?.id ?? '?'} failed: ${err.message.replace(/[^\s<>"']+@[^\s<>"']+/g, '[email]')}`,
    ),
  );
}
const sweeps = new Worker(
  SWEEP_QUEUE,
  async (job) => {
    const deps = {
      prisma,
      sendMail: async (m: MailMessage) => void (await mailQueue.add('send', m)),
    };
    if (job.name === 'reminders') return { sent: await reminderSweep(deps) };
    if (job.name === 'expiry') return { expired: await expirySweep(deps) };
    if (job.name === 'retention') return { deleted: await retentionSweep(deps) };
    if (job.name === 'demo-reset') {
      await resetDemo(prisma, markSeeded);
      await redis.del('demo:mail');
      return { reset: true };
    }
    if (job.name === 'demo-purge') {
      const seededAt = await redis.get(DEMO_SEEDED_AT_KEY);
      return { purged: seededAt ? await purgeVisitorUploads(prisma, new Date(seededAt)) : 0 };
    }
  },
  { ...opts, concurrency: 1 },
);
workers.push(sweeps);

// Schedules are upserted on every start, so changing them here is all it takes.
await sweepQueue.upsertJobScheduler(
  'reminders',
  { pattern: '5 * * * *', tz: 'Europe/London' },
  { name: 'reminders' },
);
await sweepQueue.upsertJobScheduler(
  'expiry',
  { pattern: '35 * * * *', tz: 'Europe/London' },
  { name: 'expiry' },
);
await sweepQueue.upsertJobScheduler(
  'retention',
  { pattern: '15 3 * * *', tz: 'Europe/London' },
  { name: 'retention' },
);

// Demo mode (PRD §3, item 21): seed on first start, purge visitor uploads hourly, reset nightly.
if (env.DEMO_MODE) {
  if ((await prisma.workspace.count()) === 0) {
    await seedDemo(prisma);
    await markSeeded(new Date());
    logger.log('Demo workspace seeded');
  }
  await sweepQueue.upsertJobScheduler(
    'demo-purge',
    { pattern: '50 * * * *', tz: 'Europe/London' },
    { name: 'demo-purge' },
  );
  await sweepQueue.upsertJobScheduler(
    'demo-reset',
    { pattern: '0 2 * * *', tz: 'Europe/London' },
    { name: 'demo-reset' },
  );
} else {
  await sweepQueue.removeJobScheduler('demo-purge');
  await sweepQueue.removeJobScheduler('demo-reset');
}

logger.log('Worker started');

async function shutdown(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  await convertQueue.close();
  await exportQueue.close();
  await mailQueue.close();
  await sweepQueue.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

// A zip that can't be built (after retries) is marked FAILED so the UI can say so.
exportWorker.on('failed', (job) => {
  const data = job?.data as ExportJob | undefined;
  if (job && data && !data.expire && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void prisma.export
      .update({ where: { id: data.exportId }, data: { status: 'FAILED' } })
      .catch(() => undefined);
  }
});
