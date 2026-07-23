// POST /api/v1/activites/[id]/stocks — Lier un stock à l'activité (M:N)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiCreated, apiError } from '@/lib/permissions'

const linkSchema = z.object({
  stockId: z.string().cuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'stocks.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = linkSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const activite = await db.activite.findUnique({ where: { id } })
    if (!activite) return apiError('NOT_FOUND', 'Activité introuvable', 404)

    const stock = await db.stock.findUnique({ where: { id: parsed.data.stockId } })
    if (!stock) return apiError('NOT_FOUND', 'Stock introuvable', 404)

    const existing = await db.activiteStock.findUnique({
      where: { activiteId_stockId: { activiteId: id, stockId: parsed.data.stockId } },
    })
    if (existing) {
      return apiError('CONFLICT', 'Ce stock est déjà lié à cette activité', 409)
    }

    const link = await db.activiteStock.create({
      data: { activiteId: id, stockId: parsed.data.stockId },
      include: { stock: true },
    })

    return apiCreated(link)
  })
}
