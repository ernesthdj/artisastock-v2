// GET /api/v1/bom/sheets/[id]/cost?nBatches=1 — Simulation coût BOM (hors TX)

import { NextRequest } from 'next/server'
import { getPrismaWithTenant, prisma } from '@/lib/prisma'
import { withPermission, apiSuccess, apiError } from '@/lib/permissions'
import { calculateBomCost } from '@/lib/bom/cost'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const sheet = await db.bomSheet.findUnique({
      where: { id },
      include: { level: { include: { context: { select: { tenantId: true } } } } },
    })

    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    if (sheet.level.context.tenantId !== ctx.tenantId)
      return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    const nBatchesRaw = request.nextUrl.searchParams.get('nBatches')
    const nBatches = nBatchesRaw ? parseFloat(nBatchesRaw) : 1

    if (isNaN(nBatches) || nBatches <= 0) {
      return apiError('VALIDATION_ERROR', 'nBatches doit être un nombre positif', 400)
    }

    try {
      const result = await calculateBomCost(id, nBatches, prisma)
      return apiSuccess(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur calcul coût'
      if (message.includes('Cycle BOM')) {
        return apiError('BOM_CYCLE', message, 422)
      }
      return apiError('COST_ERROR', message, 500)
    }
  })
}
