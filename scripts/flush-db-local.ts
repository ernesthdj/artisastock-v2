// Flush complet de la DB locale — conserve uniquement Tenant + User + Role (credentials admin).
// Garde-fou dur : refuse de s'exécuter si DATABASE_URL ne pointe pas vers localhost/127.0.0.1.
// Usage : npx tsx scripts/flush-db-local.ts

import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL ?? '';
const host = (() => {
  try { return new URL(dbUrl).hostname; } catch { return ''; }
})();

if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(`Refus : DATABASE_URL pointe vers "${host}", pas localhost. Ce script ne s'exécute qu'en local.`);
  process.exit(1);
}

const prisma = new PrismaClient();

// Tous les modèles sauf Tenant, User, Role — TRUNCATE ... CASCADE résout l'ordre des FK automatiquement.
const TABLES_TO_FLUSH = [
  'Session', 'UserInvitation', 'PasswordResetToken',
  'Ingredient', 'Lot', 'Supplier',
  'Recipe', 'RecipeIngredient', 'RecipeVersion',
  'Product', 'TenantVatRate', 'ProductChannelStock', 'StockClosure',
  'Customer', 'Order', 'OrderItem', 'Invoice', 'PickupSlot', 'ClosedDay',
  'Page', 'SiteConfig', 'NotificationLog', 'CookieConsent', 'GdprRequest', 'AuditLog',
  'BomContext', 'BomLevel', 'BomSheet', 'BomLine', 'BomProduction', 'BomProductionLine', 'BomStock',
  'Activite', 'Stock', 'ActiviteStock',
  'Vendeur', 'SessionCaisse', 'PointageHoraire', 'PosSale', 'PosSaleItem',
];

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const users = await prisma.user.findMany({ select: { id: true, email: true, tenantId: true } });

  console.log('Avant flush :');
  console.log('  Tenants :', tenants.map((t) => `${t.name} (${t.id})`).join(', '));
  console.log('  Users   :', users.map((u) => u.email).join(', '));

  const quoted = TABLES_TO_FLUSH.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);

  const tenantsAfter = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const usersAfter = await prisma.user.findMany({ select: { id: true, email: true } });
  const rolesAfter = await prisma.role.findMany({ select: { name: true } });

  console.log('\nAprès flush :');
  console.log('  Tenants conservés :', tenantsAfter.map((t) => `${t.name} (${t.id})`).join(', '));
  console.log('  Users conservés   :', usersAfter.map((u) => u.email).join(', '));
  console.log('  Roles conservés   :', rolesAfter.map((r) => r.name).join(', '));
  console.log('\nFlush terminé — DB locale vide hors Tenant/User/Role.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
