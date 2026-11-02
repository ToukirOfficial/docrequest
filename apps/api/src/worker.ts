import { Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import {
  CONVERT_QUEUE,
  MAIL_QUEUE,
  QUEUE_PREFIX,
  SCAN_QUEUE,
  bullConnection,
  type FileJob,
} from './queue/queues.js';
import { createMailSender } from './mail/mail.sender.js';
import type { MailMessage } from './mail/templates.js';
import { PrismaService } from './common/prisma.service.js';
import { convertFile, rejectUnreadable, scanFile } from './files/pipeline.js';

const logger = new Logger('Worker');
const sendMail = createMailSender();
const prisma = new PrismaService();
const convertQueue = new Queue<FileJob>(CONVERT_QUEUE, {
  connection: bullConnection(),
  prefix: QUEUE_PREFIX,
});
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
];

for (const w of workers) {
  // Log job ids only: never email addresses, names or file contents.
  w.on('failed', (job, err) =>
    logger.warn(`${w.name} job ${job?.id ?? '?'} failed: ${err.message}`),
  );
}
logger.log('Worker started');

async function shutdown(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  await convertQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
