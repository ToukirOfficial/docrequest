import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MAIL_QUEUE, QUEUE_PREFIX, bullConnection } from '../queue/queues.js';
import type { MailMessage } from './templates.js';

/** Puts emails on the queue; the worker sends them. Never sends inside a request. */
@Injectable()
export class MailService implements OnModuleDestroy {
  readonly queue = new Queue<MailMessage>(MAIL_QUEUE, {
    connection: bullConnection(),
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  async send(message: MailMessage): Promise<void> {
    await this.queue.add('send', message);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
