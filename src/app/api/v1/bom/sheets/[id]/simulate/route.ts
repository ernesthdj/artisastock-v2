// GET /api/v1/bom/sheets/[id]/simulate?nBatches=N — Simulation combinée coût + disponibilité

import { NextRequest } from 'next/server'
import { getPrismaWithTenant, prisma } from '@/lib/prisma'
import { withPermission, apiSuccess, apiError } from '@/lib/permissions'
import { calculateBomCost } from '@/lib/bom/cost'
import { checkAvailability } from '@/lib/bom/fifo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const sheet = await db.bomSheet.findUnique({
      where: { id },
      include: {
        level: {
          select: {
            order: true,
            context: { select: { tenantId: true } },
          },
        },
      },
    })

    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    if (sheet.level.context.tenantId !== ctx.tenantId)
      return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    const nBatchesRaw = request.nextUrl.searchParams.get('nBatches')
    const nBatches = nBatchesRaw ? parseFloat(nBatchesRaw) : 1

    if (isNaN(nBatches) || nBatches <= 0) {
      return apiError('VALIDATION_ERROR', 'nBatches doit être un nombre positif', 400)
    }

    // Appels parallèles : coût + disponibilité
    let costResult: Awaited<ReturnType<typeof calculateBomCost>>
    let availResult: Awaited<ReturnType<typeof checkAvailability>>

    try {
      ;[costResult, availResult] = await Promise.all([
        calculateBomCost(id, nBatches, prisma),
        checkAvailability(id, nBatches, prisma),
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur simulation'
      if (msg.includes('Cycle BOM')) return apiError('BOM_CYCLE', msg, 422)
      return apiError('SIMULATE_ERROR', msg, 500)
    }

    return apiSuccess({
      nBatches,
      cost: costResult,
      availability: availResult,
    })
  })
}
