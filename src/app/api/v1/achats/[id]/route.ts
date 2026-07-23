// GET/PATCH/DELETE /api/v1/achats/[id]

import { NextRequest } from 'next/server'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiSuccess, apiNoContent, apiError } from '@/lib/permissions'
import { achatUpdateSchema } from '@/lib/validators/achat'
import { VAT_RATES } from '@/lib/utils/vat'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'achats.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const lot = await db.lot.findUnique({
      where: { id },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, packSize: true, unitsPerLot: true } },
        stock: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    })

    if (!lot) return apiError('NOT_FOUND', 'Lot introuvable', 404)

    return apiSuccess(lot)
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'achats.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = achatUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }
    const d = parsed.data

    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.lot.findUnique({
      where: { id },
      include: { ingredient: { select: { packSize: true, unitsPerLot: true } } },
    })
    if (!existing) return apiError('NOT_FOUND', 'Lot introuvable', 404)

    if (d.stockId) {
      const stock = await db.stock.findUnique({ where: { id: d.stockId } })
      if (!stock) return apiError('NOT_FOUND', 'Stock introuvable', 404)
    }
    if (d.supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: d.supplierId } })
      if (!supplier) return apiError('NOT_FOUND', 'Fournisseur introuvable', 404)
    }

    const packSize = Number(existing.ingredient.packSize ?? 0)
    if (!packSize) {
      return apiError('VALIDATION_ERROR', "L'ingrédient de ce lot n'a pas de packSize défini", 422)
    }

    // Recalcul complet (pas de diff) si la quantité et/ou le prix sont resaisis — sinon on ne
    // touche pas quantityInitial/unitPrice, seuls les champs non-quantité sont mis à jour.
    let quantityInitial = Number(existing.quantityInitial)
    let unitPriceHT = Number(existing.unitPrice)
    const vatRate = d.vatRate ?? existing.vatRate

    if (d.quantity !== undefined && d.purchaseMode !== undefined) {
      const nbConditionnements = d.purchaseMode === 'LOT' ? d.quantity * existing.ingredient.unitsPerLot : d.quantity
      quantityInitial = nbConditionnements * packSize
    }
    if (d.priceEntered !== undefined && d.priceMode !== undefined) {
      const vatFactor = 1 + VAT_RATES[vatRate]
      unitPriceHT = Math.round((d.priceMode === 'HT' ? d.priceEntered : d.priceEntered / vatFactor) * 10000) / 10000
    }
    const nbConditionnements = quantityInitial / packSize
    const totalPriceHT = Math.round(nbConditionnements * unitPriceHT * 100) / 100

    // Règle réelle v1 (LotDAL.Update) : préserver la consommation déjà effectuée.
    const consumed = Number(existing.quantityInitial) - Number(existing.quantityAvailable)
    const newQuantityAvailable = Math.max(0, quantityInitial - consumed)
    const stockDelta = newQuantityAvailable - Number(existing.quantityAvailable)

    const updated = await db.$transaction(async (tx) => {
      const lot = await tx.lot.update({
        where: { id },
        data: {
          stockId: d.stockId,
          supplierId: d.supplierId,
          lotNumber: d.lotNumber,
          purchaseDate: d.purchaseDate,
          expiryDate: d.expiryDate,
          invoiceRef: d.invoiceRef,
          notes: d.notes,
          quantityInitial,
          quantityAvailable: newQuantityAvailable,
          unitPrice: unitPriceHT,
          totalPriceHT,
          vatRate,
        },
        include: {
          ingredient: { select: { id: true, name: true, unit: true } },
          stock: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      })

      if (stockDelta !== 0) {
        await tx.ingredient.update({
          where: { id: existing.ingredientId },
          data: { stock: { increment: stockDelta } },
        })
      }

      return lot
    })

    return apiSuccess(updated)
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'achats.write', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.lot.findUnique({ where: { id } })
    if (!existing) return apiError('NOT_FOUND', 'Lot introuvable', 404)

    const consumed = Number(existing.quantityInitial) - Number(existing.quantityAvailable)
    if (consumed > 0) {
      return apiError(
        'CONFLICT',
        'Impossible de supprimer : ce lot a été partiellement consommé — les données de traçabilité seraient perdues',
        409
      )
    }

    await db.$transaction(async (tx) => {
      await tx.lot.delete({ where: { id } })
      await tx.ingredient.update({
        where: { id: existing.ingredientId },
        data: { stock: { decrement: Number(existing.quantityAvailable) } },
      })
    })

    return apiNoContent()
  })
}
