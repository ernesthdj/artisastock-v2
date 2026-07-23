// PATCH /api/v1/activites/[id]/reactivate — mirroring ActiviteDAL.Reactiver v1
// Aucune vérification — réactiver ne peut rien casser (symétrie non gardée, intentionnelle).

import { NextRequest } from 'next/server'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiSuccess, apiError } from '@/lib/permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'activites.write', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.activite.findUnique({ where: { id } })
    if (!existing) return apiError('NOT_FOUND', 'Activité introuvable', 404)

    const activite = await db.activite.update({
      where: { id },
      data: { isActive: true },
    })

    return apiSuccess(activite)
  })
}
