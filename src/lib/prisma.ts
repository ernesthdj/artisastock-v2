import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Extension Prisma — injection automatique du tenantId sur toutes les requêtes métier
const GLOBAL_MODELS = new Set([
  'Session',
  'PasswordResetToken',
  'AuditLog',
  'CookieConsent',
]);

export function getPrismaWithTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || GLOBAL_MODELS.has(model)) return query(args);

        const readOps = new Set(['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy']);
        const createOps = new Set(['create', 'createMany']);
        const mutateOps = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

        if (readOps.has(operation)) {
          (args as { where?: Record<string, unknown> }).where = {
            ...(args as { where?: Record<string, unknown> }).where,
            tenantId,
          };
        }

        if (createOps.has(operation)) {
          if (operation === 'create') {
            (args as { data?: Record<string, unknown> }).data = {
              tenantId,
              ...(args as { data?: Record<string, unknown> }).data,
            };
          }
        }

        if (mutateOps.has(operation)) {
          (args as { where?: Record<string, unknown> }).where = {
            ...(args as { where?: Record<string, unknown> }).where,
            tenantId,
          };
          if (operation === 'upsert') {
            (args as { create?: Record<string, unknown> }).create = {
              tenantId,
              ...(args as { create?: Record<string, unknown> }).create,
            };
          }
        }

        return query(args);
      },
    },
  });
}
