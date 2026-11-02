import { PrismaService } from './common/prisma.service.js';
import { seedDemo } from './demo/seed.js';

/**
 * `pnpm db:seed`: fills an EMPTY database with the demo workspace (made-up data only).
 * Refuses to touch a database that already has workspaces.
 */
const prisma = new PrismaService();
try {
  if ((await prisma.workspace.count()) > 0) {
    console.error(
      'Seed skipped: this database already has workspaces. The seed only runs on an empty database.',
    );
    process.exitCode = 1;
  } else {
    await seedDemo(prisma);
    process.stdout.write(
      'Seeded the demo workspace "Cranbrook Lettings". With DEMO_MODE=true, use "Try the demo" on the sign-in page.\n',
    );
  }
} finally {
  await prisma.$disconnect();
}
