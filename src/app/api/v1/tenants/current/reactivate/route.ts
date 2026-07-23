// PATCH /api/v1/tenants/current/reactivate — réactive le tenant courant (mirroring ActiviteDAL.Reactiver v1)
// Aucune vérification — réactiver ne peut rien casser (symétrie non gardée, intentionnelle).

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function PATCH(request: NextRequest) {
  return withPermission(request, 'settings.write', async (ctx) => {
    const tenant = await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { isActive: true },
      select: { id: true, isActive: true },
    });

    return apiSuccess(tenant);
  });
}
