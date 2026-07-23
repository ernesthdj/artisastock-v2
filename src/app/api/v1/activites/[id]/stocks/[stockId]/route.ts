// DELETE /api/v1/activites/[id]/stocks/[stockId] — Délier un stock de l'activité (M:N)

import { NextRequest } from 'next/server'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiNoContent, apiError } from '@/lib/permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stockId: string }> }
) {
  const { id, stockId } = await params
  return withPermission(request, 'stocks.write', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const activite = await db.activite.findUnique({ where: { id } })
    if (!activite) return apiError('NOT_FOUND', 'Activité introuvable', 404)

    const stock = await db.stock.findUnique({ where: { id: stockId } })
    if (!stock) return apiError('NOT_FOUND', 'Stock introuvable', 404)

    const existing = await db.activiteStock.findUnique({
      where: { activiteId_stockId: { activiteId: id, stockId } },
    })
    if (!existing) return apiError('NOT_FOUND', 'Liaison introuvable', 404)

    await db.activiteStock.delete({
      where: { activiteId_stockId: { activiteId: id, stockId } },
    })

    return apiNoContent()
  })
}
