import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';

import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  if (adminEmails.length === 0) {
    console.log('ADMIN_EMAILS is empty, nothing to seed.');
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    for (const email of adminEmails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`Skipped ${email}: no matching user.`);
        continue;
      }
      await prisma.user.update({ where: { email }, data: { role: Role.ADMIN } });
      console.log(`Marked ${email} as ADMIN.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
