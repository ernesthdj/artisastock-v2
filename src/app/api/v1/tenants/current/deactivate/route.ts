// PATCH /api/v1/tenants/current/deactivate — désactive le tenant courant (mirroring ActiviteDAL.Desactiver v1)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';

export async function PATCH(request: NextRequest) {
  return withPermission(request, 'settings.write', async (ctx) => {
    try {
      const tenant = await prisma.$transaction(async (tx) => {
        const activeContexts = await tx.bomContext.count({
          where: { tenantId: ctx.tenantId, isActive: true },
        });
        if (activeContexts > 0) {
          throw new Error(
            `Impossible de désactiver : ${activeContexts} contexte(s) BOM actif(s) rattaché(s).`
          );
        }

        // Équivalent v2 du check v1 "lots_ingredients avec quantite_disponible > 0" —
        // le modèle v2 n'a pas encore de Lots (achats/traçabilité), donc on vérifie le stock
        // agrégé par ingrédient. À revoir une fois le module Achats/Lots implémenté.
        const ingredientsInStock = await tx.ingredient.count({
          where: { tenantId: ctx.tenantId, isActive: true, stock: { gt: 0 } },
        });
        if (ingredientsInStock > 0) {
          throw new Error(
            `Impossible de désactiver : ${ingredientsInStock} ingrédient(s) actif(s) ont encore du stock.`
          );
        }

        return tx.tenant.update({
          where: { id: ctx.tenantId },
          data: { isActive: false },
          select: { id: true, isActive: true },
        });
      });

      return apiSuccess(tenant);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la désactivation';
      return apiError('CONFLICT', message, 409);
    }
  });
}
