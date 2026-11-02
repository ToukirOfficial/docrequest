import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Tests run against a real PostgreSQL database and Redis (no mocks).
const testDb =
  process.env.TEST_DATABASE_URL ??
  'postgresql://docrequest:docrequest@localhost:5432/docrequest_test';

export default defineConfig({
  // SWC emits decorator metadata, which NestJS dependency injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/6',
      REDIS_PREFIX: 'docrequest-test:',
      JWT_SECRET: 'test-only-secret-test-only-secret-test-only-secret',
      CODE_PEPPER: 'test-only-pepper-test-only-pepper',
      WEB_ORIGIN: 'http://localhost:8020',
      SIGNUP_ENABLED: 'true',
      DEMO_MODE: 'false',
      MAIL_DRIVER: 'file',
      MAIL_DIR: './tmp/test-mail',
    },
  },
});
