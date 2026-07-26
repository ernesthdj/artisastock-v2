import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({ where: { name: 'Admin' } });
  for (const role of roles) {
    const current = Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
    if (current.includes('flow.read')) {
      console.log(`[skip] tenant ${role.tenantId} — déjà à jour`);
      continue;
    }
    await prisma.role.update({ where: { id: role.id }, data: { permissions: [...current, 'flow.read'] } });
    console.log(`[updated] tenant ${role.tenantId}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
