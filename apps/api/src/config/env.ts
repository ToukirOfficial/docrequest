import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_ORIGIN: z.url().default('http://localhost:8020'),
  API_PORT: z.coerce.number().int().default(8120),
  /** 0.0.0.0 for Docker (reached from other containers); 127.0.0.1 behind a host reverse proxy. */
  API_HOST: z.string().default('0.0.0.0'),
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

  // Files (PRD §3, items 16, 17, 23). Every file is encrypted before it is stored, whatever the driver.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().default('./storage/files'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  /** For S3-compatible services (MinIO, R2, Wasabi). Leave empty for AWS. */
  S3_ENDPOINT: z.string().optional(),
  /** "env": master key from MASTER_KEY. "kms": AWS KMS key (KMS_KEY_ID). */
  KEY_DRIVER: z.enum(['env', 'kms']).default('env'),
  /** 32 random bytes, base64. Generate with: openssl rand -base64 32 */
  MASTER_KEY: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(20),
  CLAMAV_ENABLED: bool,
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().default(3310),
});

export type Env = z.infer<typeof schema>;
export const DEMO_MAX_UPLOAD_MB = 2;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }
  const e = parsed.data;
  if (e.DEMO_MODE) {
    // The public demo never sends real email and only takes small uploads (PRD §3, item 21).
    e.MAIL_DRIVER = 'file';
    e.MAX_UPLOAD_MB = Math.min(e.MAX_UPLOAD_MB, DEMO_MAX_UPLOAD_MB);
    e.SIGNUP_ENABLED = false;
  }
  if (e.KEY_DRIVER === 'env') {
    const key = e.MASTER_KEY ? Buffer.from(e.MASTER_KEY, 'base64') : undefined;
    if (!key || key.length !== 32) {
      throw new Error(
        'Invalid environment:\nMASTER_KEY must be 32 bytes, base64 (openssl rand -base64 32)',
      );
    }
  }
  if (e.KEY_DRIVER === 'kms' && !e.KMS_KEY_ID)
    throw new Error('Invalid environment:\nKMS_KEY_ID is required when KEY_DRIVER=kms');
  if (e.STORAGE_DRIVER === 's3' && !e.S3_BUCKET)
    throw new Error('Invalid environment:\nS3_BUCKET is required when STORAGE_DRIVER=s3');
  return e;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
