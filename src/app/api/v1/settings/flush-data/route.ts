// POST /api/v1/settings/flush-data — Zone de danger (Paramètres) : vide sélectivement les
// données de test du tenant courant (jamais User/Role/Tenant/Session). Voir
// src/lib/settings/flush-data.ts pour l'ordre de suppression sûr. Confirmation forte : le nom
// exact du tenant doit être fourni (re-vérifié ici, jamais uniquement côté client).

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { flushDataSchema } from '@/lib/validators/settings';
import { flushTenantData } from '@/lib/settings/flush-data';

export async function POST(request: NextRequest) {
  return withPermission(request, 'settings.flush_data', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = flushDataSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }
    const { categories, confirmName } = parsed.data;

    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
    if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);
    if (confirmName !== tenant.name) {
      return apiError('CONFIRM_MISMATCH', 'Le nom saisi ne correspond pas au nom exact de votre espace', 400);
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const flush = await flushTenantData(tx, ctx.tenantId, categories);
          await tx.auditLog.create({
            data: {
              tenantId: ctx.tenantId,
              userId: ctx.userId,
              action: 'settings.flush_data',
              entity: 'Tenant',
              entityId: ctx.tenantId,
              changes: { categories, ...flush },
            },
          });
          return flush;
        },
        { timeout: 20000 }
      );

      return apiSuccess(result);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        return apiError(
          'DEPENDENCY_CONFLICT',
          "Suppression annulée (rien n'a été supprimé) : des données d'une catégorie non sélectionnée dépendent encore de celles-ci. Sélectionnez aussi les catégories liées, ou « Tout sélectionner ».",
          409
        );
      }
      const message = err instanceof Error ? err.message : 'Erreur lors du flush';
      return apiError('FLUSH_FAILED', message, 500);
    }
  });
}
