import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.create({
    data: { name: 'Staff4dshire Properties' },
  });

  const passwordHash = await bcrypt.hash('123456', 10);
  const superadmin = await prisma.user.create({
    data: {
      email: 'tom@staff4dshireproperties.com',
      passwordHash,
      firstName: 'Tom',
      lastName: 'Staff4dshire',
      role: 'superadmin',
      companyId: company.id,
    },
  });

  await prisma.companyMembership.create({
    data: {
      userId: superadmin.id,
      companyId: company.id,
      role: 'superadmin',
    },
  });

  const invitationToken = randomBytes(8).toString('hex').toUpperCase();
  const adminInvitation = await prisma.companyInvitation.create({
    data: {
      token: invitationToken,
      email: 'adam@staff4dshireproperties.com',
      role: 'admin',
      companyId: company.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed complete.');
  console.log('Company:', company.name);
  console.log('Credentials:');
  console.log('  Superadmin:', superadmin.email);
  console.log('  Password:', '123456');
  console.log('Invitation created by superadmin account:');
  console.log('  Invitee (admin):', adminInvitation.email);
  console.log('  Role:', adminInvitation.role);
  console.log('  Token:', adminInvitation.token);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
