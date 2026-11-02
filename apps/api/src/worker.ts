import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { MAIL_QUEUE, QUEUE_PREFIX, bullConnection } from './queue/queues.js';
import { createMailSender } from './mail/mail.sender.js';
import type { MailMessage } from './mail/templates.js';

const logger = new Logger('Worker');
const sendMail = createMailSender();

const workers = [
  new Worker<MailMessage>(
    MAIL_QUEUE,
    async (job) => {
      await sendMail(job.data);
    },
    { connection: bullConnection(), prefix: QUEUE_PREFIX, concurrency: 5 },
  ),
];

for (const w of workers) {
  // Log job ids only: never email addresses or content.
  w.on('failed', (job, err) =>
    logger.warn(`${w.name} job ${job?.id ?? '?'} failed: ${err.message}`),
  );
}
logger.log('Worker started');

async function shutdown(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
