import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import type { MailMessage } from './templates.js';

/** Used by the worker. "file" driver writes .eml files instead of sending. */
export function createMailSender(): (message: MailMessage) => Promise<void> {
  if (env.MAIL_DRIVER === 'smtp') {
    if (!env.SMTP_URL) throw new Error('SMTP_URL is required when MAIL_DRIVER=smtp');
    const transport = nodemailer.createTransport(env.SMTP_URL);
    return async (m) => {
      await transport.sendMail({ from: env.MAIL_FROM, to: m.to, subject: m.subject, text: m.text });
    };
  }

  const dir = resolve(env.MAIL_DIR);
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  return async (m) => {
    const info = await transport.sendMail({
      from: env.MAIL_FROM,
      to: m.to,
      subject: m.subject,
      text: m.text,
    });
    await mkdir(dir, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.eml`;
    await writeFile(join(dir, name), info.message as Buffer, { mode: 0o600 });
  };
}
