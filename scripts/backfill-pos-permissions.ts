// Backfill ciblé : ajoute pos.sell/pos.read/pos.manage au rôle Admin de chaque
// tenant, sans toucher au reste de son tableau permissions. Ne PAS remplacer
// par un `tsx prisma/seed.ts` complet (règle #29 JOURNAL — reseed complet
// risque de dupliquer/écraser des données réelles sur une base déjà en prod).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POS_PERMISSIONS = ['pos.sell', 'pos.read', 'pos.manage'];

async function main() {
  const adminRoles = await prisma.role.findMany({ where: { name: 'Admin' } });

  for (const role of adminRoles) {
    const current = Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
    const missing = POS_PERMISSIONS.filter((p) => !current.includes(p));
    if (missing.length === 0) {
      console.log(`[skip] tenant ${role.tenantId} — déjà à jour`);
      continue;
    }
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: [...current, ...missing] },
    });
    console.log(`[updated] tenant ${role.tenantId} — ajouté: ${missing.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
