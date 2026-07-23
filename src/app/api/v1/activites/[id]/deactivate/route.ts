// PATCH /api/v1/activites/[id]/deactivate — mirroring ActiviteDAL.Desactiver v1
//
// Note : les gardes réelles v1 (contextes BOM actifs rattachés, lots de stock > 0 dans les
// stocks liés) ne sont pas encore reproductibles en v2 — BomContext n'est pas encore rattaché
// à Activite, et le module Achats/Lots n'existe pas. À ajouter quand ces relations existeront.

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
      data: { isActive: false },
    })

    return apiSuccess(activite)
  })
}
