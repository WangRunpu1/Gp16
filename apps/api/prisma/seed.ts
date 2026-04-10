import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  await prisma.user.upsert({
    where: { email: 'staff@gp16.local' },
    update: {},
    create: { email: 'staff@gp16.local', password: hash('Staff123!'), role: 'staff' },
  });

  await prisma.user.upsert({
    where: { email: 'customer@gp16.local' },
    update: {},
    create: { email: 'customer@gp16.local', password: hash('Customer123!'), role: 'customer' },
  });

  console.log('Seed complete: staff@gp16.local / Staff123!  |  customer@gp16.local / Customer123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
