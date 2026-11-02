import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Load the repo's .env for local commands (Docker and CI pass real env vars).
if (!process.env.DATABASE_URL && existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` doesn't connect, so a placeholder is fine when unset.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://placeholder/unset' },
});
