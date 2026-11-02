import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_ORIGIN: z.url().default('http://localhost:8020'),
  API_PORT: z.coerce.number().int().default(8120),
  TRUST_PROXY: z.string().default('loopback, linklocal, uniquelocal'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379/6'),
  REDIS_PREFIX: z.string().default('docrequest:'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CODE_PEPPER: z.string().min(16, 'CODE_PEPPER must be at least 16 characters'),
  SIGNUP_ENABLED: bool.default(true),
  DEMO_MODE: bool,
  MAIL_DRIVER: z.enum(['file', 'smtp']).default('file'),
  MAIL_DIR: z.string().default('./storage/mail'),
  MAIL_FROM: z.string().default('DocRequest <no-reply@localhost>'),
  SMTP_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
