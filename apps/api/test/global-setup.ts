import { execSync } from 'node:child_process';

export default function setup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://docrequest:docrequest@localhost:5432/docrequest_test';
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url },
  });
}
