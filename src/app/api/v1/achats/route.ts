// GET /api/v1/achats — Liste des lots (achats), filtrable par ingredientId/stockId
// POST /api/v1/achats — Créer un lot (formulaire d'achat libre — voir 15-reference-pattern-fiche-instance.md)

import { NextRequest } from 'next/server'
import { getPrismaWithTenant } from '@/lib/prisma'
import {
  withPermission,
  apiCreated,
  apiError,
  apiPaginated,
  parsePagination,
} from '@/lib/permissions'
import { achatCreateSchema } from '@/lib/validators/achat'
import { VAT_RATES } from '@/lib/utils/vat'

export async function GET(request: NextRequest) {
  return withPermission(request, 'achats.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const where: Record<string, unknown> = {}
    if (sp.get('ingredientId')) where['ingredientId'] = sp.get('ingredientId')
    if (sp.get('stockId')) where['stockId'] = sp.get('stockId')

    const [data, total] = await Promise.all([
      db.lot.findMany({
        where,
        include: {
          ingredient: { select: { id: true, name: true, unit: true } },
          stock: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { purchaseDate: 'desc' },
        skip,
        take: pageSize,
      }),
      db.lot.count({ where }),
    ])

    return apiPaginated(data, page, pageSize, total)
  })
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'achats.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = achatCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }
    const d = parsed.data

    const db = getPrismaWithTenant(ctx.tenantId)

    const ingredient = await db.ingredient.findUnique({ where: { id: d.ingredientId } })
    if (!ingredient) return apiError('NOT_FOUND', 'Ingrédient introuvable', 404)
    if (!ingredient.packSize) {
      return apiError(
        'VALIDATION_ERROR',
        "Cet ingrédient n'a pas de quantité par conditionnement définie (packSize) — complétez sa fiche avant de l'acheter",
        422
      )
    }

    const stock = await db.stock.findUnique({ where: { id: d.stockId } })
    if (!stock) return apiError('NOT_FOUND', 'Stock introuvable', 404)

    if (d.supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: d.supplierId } })
      if (!supplier) return apiError('NOT_FOUND', 'Fournisseur introuvable', 404)
    }

    // Conversion saisie → conditionnements (mirroring GetNbConditionnements)
    const nbConditionnements = d.purchaseMode === 'LOT' ? d.quantity * ingredient.unitsPerLot : d.quantity
    const quantityInitial = nbConditionnements * Number(ingredient.packSize)

    // La DB stocke toujours HTVA, quel que soit le mode de saisie
    const vatFactor = 1 + VAT_RATES[d.vatRate]
    const unitPriceHT = Math.round((d.priceMode === 'HT' ? d.priceEntered : d.priceEntered / vatFactor) * 10000) / 10000
    const totalPriceHT = Math.round(nbConditionnements * unitPriceHT * 100) / 100

    const lot = await db.$transaction(async (tx) => {
      const newLot = await tx.lot.create({
        data: {
          tenantId: ctx.tenantId,
          ingredientId: d.ingredientId,
          stockId: d.stockId,
          supplierId: d.supplierId,
          lotNumber: d.lotNumber,
          purchaseDate: d.purchaseDate ?? new Date(),
          expiryDate: d.expiryDate,
          quantityInitial,
          quantityAvailable: quantityInitial,
          unitPrice: unitPriceHT,
          totalPriceHT,
          vatRate: d.vatRate,
          invoiceRef: d.invoiceRef,
          notes: d.notes,
        },
        include: {
          ingredient: { select: { id: true, name: true, unit: true } },
          stock: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      })

      await tx.ingredient.update({
        where: { id: d.ingredientId },
        data: { stock: { increment: quantityInitial } },
      })

      return newLot
    })

    return apiCreated(lot)
  })
}
