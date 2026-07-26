// POST /api/v1/bom/sheets/[id]/produce — Exécuter une production BOM

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant, prisma } from '@/lib/prisma'
import { withPermission, apiCreated, apiError } from '@/lib/permissions'
import { checkAvailability } from '@/lib/bom/fifo'
import { consumeFIFO } from '@/lib/bom/fifo'
import { calculateBomCost } from '@/lib/bom/cost'

const produceSchema = z.object({
  nBatches: z.number().positive(),
  notes: z.string().max(500).optional(),
  // Stock physique de destination du lot produit — obligatoire pour une production manuelle
  // (voir docs/JOURNAL.md, discipline de stock : toute production doit déclarer où elle est
  // rangée, comme un achat d'ingrédient déclare son Stock). Jamais requis côté POS à la
  // demande (src/app/api/v1/pos/sales/route.ts), qui ne stocke jamais rien.
  stockId: z.string().cuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.produce', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = produceSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const sheet = await db.bomSheet.findUnique({
      where: { id },
      include: {
        level: {
          include: {
            context: {
              select: {
                tenantId: true,
                activite: { include: { stocks: { select: { stockId: true } } } },
              },
            },
          },
        },
      },
    })

    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    if (sheet.level.context.tenantId !== ctx.tenantId)
      return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    const linkedStockIds = sheet.level.context.activite.stocks.map((s) => s.stockId)

    // Garde métier : l'activité doit avoir au moins un stock lié pour pouvoir produire.
    if (linkedStockIds.length === 0) {
      return apiError(
        'ACTIVITE_NO_STOCK',
        "Impossible de produire : l'activité n'a aucun stock lié.",
        409
      )
    }

    const { nBatches, notes, stockId } = parsed.data

    // Le Stock de destination doit être lié à l'activité de la fiche — même garde que pour
    // les ingrédients (defaultStockId), pas un Stock arbitraire d'un autre atelier.
    if (!linkedStockIds.includes(stockId)) {
      return apiError(
        'VALIDATION_ERROR',
        "Le Stock de destination sélectionné n'est pas lié à l'activité de cette fiche",
        400
      )
    }

    // Phase 1 (hors TX) : vérification disponibilité
    const availability = await checkAvailability(id, nBatches, prisma)
    if (!availability.allSufficient) {
      const insufficient = availability.lines.filter((l) => !l.sufficient)
      return apiError(
        'STOCK_INSUFFICIENT',
        `Stock insuffisant pour ${insufficient.length} ingrédient(s)`,
        409,
        insufficient.map((l) => ({
          label: l.label,
          required: l.required,
          available: l.availableInUnit,
          unit: l.unit,
        }))
      )
    }

    // Calculer le coût avant la transaction
    let costResult
    try {
      costResult = await calculateBomCost(id, nBatches, prisma)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur calcul coût'
      return apiError('COST_ERROR', message, 500)
    }

    const outputQty = Number(sheet.outputQty) * nBatches

    // Phase 2 (TX) : consommation + insertion production + stock BOM
    try {
      const production = await prisma.$transaction(async (tx) => {
        const newProduction = await tx.bomProduction.create({
          data: {
            tenantId: ctx.tenantId,
            levelId: sheet.levelId,
            sheetId: id,
            nBatches,
            outputQty,
            ingredientsCost: costResult.totalCost,
            unitCost: costResult.unitCost,
            notes: notes ?? null,
          },
        })

        // Consommer le stock ingrédients (FIFO MVP)
        await consumeFIFO(
          { sheetId: id, productionId: newProduction.id, nBatches },
          tx
        )

        // Incrémenter le stock BOM
        await tx.bomStock.create({
          data: {
            tenantId: ctx.tenantId,
            sheetId: id,
            productionId: newProduction.id,
            stockId,
            qtyAvailable: outputQty,
            unitCost: costResult.unitCost,
            producedAt: new Date(),
          },
        })

        return tx.bomProduction.findUniqueOrThrow({
          where: { id: newProduction.id },
          include: {
            sheet: { select: { name: true, outputUnit: true } },
            lines: true,
          },
        })
      })

      return apiCreated(production)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur production'
      if (message.includes('Stock insuffisant')) {
        return apiError('STOCK_INSUFFICIENT', message, 409)
      }
      return apiError('PRODUCTION_ERROR', message, 500)
    }
  })
}
