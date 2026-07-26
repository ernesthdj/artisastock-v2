// GET /api/v1/bom/sheets?levelId= — Liste fiches d'un niveau
// POST /api/v1/bom/sheets — Créer une fiche BOM

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { UnitOfMeasure } from '@prisma/client'
import { getPrismaWithTenant, prisma } from '@/lib/prisma'
import {
  withPermission,
  apiCreated,
  apiError,
  apiPaginated,
  parsePagination,
} from '@/lib/permissions'
import { validateSubSheetHierarchy } from '@/lib/bom/validateLine'
import { checkAvailability } from '@/lib/bom/fifo'
import { calculateBomCost } from '@/lib/bom/cost'

// Lignes saisies dans le même formulaire que l'en-tête, avant toute persistance (mirroring
// FrmBomFicheEdit : _lignes en mémoire, insérées avec la fiche en une seule transaction).
const lineInputSchema = z
  .object({
    inputType: z.enum(['INGREDIENT', 'SHEET']),
    ingredientId: z.string().cuid().optional(),
    subSheetId: z.string().cuid().optional(),
    quantity: z.number().positive(),
    unit: z.nativeEnum(UnitOfMeasure),
  })
  .refine(
    (d) =>
      (d.inputType === 'INGREDIENT' && !!d.ingredientId && !d.subSheetId) ||
      (d.inputType === 'SHEET' && !!d.subSheetId && !d.ingredientId),
    { message: 'INGREDIENT requiert ingredientId seul ; SHEET requiert subSheetId seul' }
  )

const sheetCreateSchema = z.object({
  levelId: z.string().cuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  outputUnit: z.nativeEnum(UnitOfMeasure),
  outputQty: z.number().positive(),
  prepTime: z.number().int().positive().optional(),
  targetStock: z.number().positive().optional(),
  lines: z.array(lineInputSchema).default([]),
})

export async function GET(request: NextRequest) {
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const levelId = sp.get('levelId')
    const where: Record<string, unknown> = {}

    if (levelId) {
      // Vérifier que le niveau appartient au tenant avant de lister ses fiches
      const level = await db.bomLevel.findUnique({
        where: { id: levelId },
        include: { context: { select: { tenantId: true } } },
      })
      if (!level) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
      if (level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
      where['levelId'] = levelId
    } else {
      // Sans levelId : toutes les fiches du tenant, tous niveaux confondus — utilisé par le
      // picker de publication produit (module Boutique), qui n'est pas ancré à un niveau précis.
      where['level'] = { context: { tenantId: ctx.tenantId } }
    }

    if (sp.get('isActive') !== null) where['isActive'] = sp.get('isActive') === 'true'

    // Picker de publication produit (UC2) : depuis la révision "vente à la demande" du POS
    // (docs/modules/POS.md §0), publier un produit n'exige plus un stock produit pré-existant
    // — seulement que la fiche soit productible dès maintenant depuis le stock d'ingrédients
    // réel (checkAvailability). La Boutique Web (canal VITRINE) continue d'exiger une vraie
    // production + allocation après publication, mais ce n'est plus une précondition à la
    // publication elle-même.
    if (sp.get('hasStock') === 'true') {
      const candidates = await db.bomSheet.findMany({
        where,
        include: { _count: { select: { lines: true } } },
        orderBy: { name: 'asc' },
      })

      const withAvailability = await Promise.all(
        candidates.map(async (sheet) => {
          const availability = await checkAvailability(sheet.id, 1, prisma)
          if (!availability.allSufficient) return null
          const cost = await calculateBomCost(sheet.id, 1, prisma)
          const maxBatches = availability.lines.length
            ? Math.min(
                ...availability.lines.map((l) =>
                  l.required > 0 ? Math.floor(l.availableInUnit / l.required) : Number.POSITIVE_INFINITY
                )
              )
            : 0
          return {
            ...sheet,
            availableStock: Number.isFinite(maxBatches) ? Math.max(0, maxBatches) : 0,
            avgUnitCost: cost.unitCost,
          }
        })
      )

      const producible = withAvailability.filter((s): s is NonNullable<typeof s> => s !== null)
      return apiPaginated(producible.slice(skip, skip + pageSize), page, pageSize, producible.length)
    }

    const [data, total] = await Promise.all([
      db.bomSheet.findMany({
        where,
        include: {
          _count: { select: { lines: true } },
          stocks: { where: { qtyAvailable: { gt: 0 } }, select: { qtyAvailable: true, unitCost: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      db.bomSheet.count({ where }),
    ])

    // avgUnitCost : moyenne pondérée par quantité des lots de production disponibles —
    // sert d'indicateur de marge (UC7) à la publication, pas un coût de lot arbitraire.
    const withStock = data.map(({ stocks, ...sheet }) => {
      const availableStock = stocks.reduce((sum, s) => sum + Number(s.qtyAvailable), 0)
      const weightedCost = stocks.reduce((sum, s) => sum + Number(s.qtyAvailable) * Number(s.unitCost), 0)
      return {
        ...sheet,
        availableStock,
        avgUnitCost: availableStock > 0 ? Math.round((weightedCost / availableStock) * 10000) / 10000 : null,
      }
    })

    return apiPaginated(withStock, page, pageSize, total)
  })
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'bom.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = sheetCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    // Vérifier que le niveau appartient au tenant
    const level = await db.bomLevel.findUnique({
      where: { id: parsed.data.levelId },
      include: { context: { select: { tenantId: true } } },
    })
    if (!level) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
    if (level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)

    // N1 = niveau ingrédients obligatoire — pas de fiche BOM/production possible dessus.
    // Les seules actions valides à ce niveau sont la création de fiches ingrédients et d'achats.
    if (level.order === 1) {
      return apiError(
        'FORBIDDEN',
        'Le niveau N1 (Ingrédients) ne peut pas contenir de fiches BOM — utilisez les fiches ingrédients et les achats',
        403
      )
    }

    // Guard doublon nom dans le niveau
    const existing = await db.bomSheet.findUnique({
      where: { levelId_name: { levelId: parsed.data.levelId, name: parsed.data.name } },
    })
    if (existing) {
      return apiError('CONFLICT', `Une fiche "${parsed.data.name}" existe déjà dans ce niveau`, 409)
    }

    // Guard doublon au sein même des lignes soumises (même ingrédient/sous-fiche deux fois)
    const seen = new Set<string>()
    for (const line of parsed.data.lines) {
      const key = line.inputType === 'INGREDIENT' ? `ING:${line.ingredientId}` : `SHEET:${line.subSheetId}`
      if (seen.has(key)) {
        return apiError('VALIDATION_ERROR', 'Un même ingrédient/fiche ne peut apparaître qu\'une fois', 400)
      }
      seen.add(key)
    }

    // Valider la hiérarchie de chaque ligne de type sous-fiche AVANT la transaction
    for (const line of parsed.data.lines) {
      if (line.inputType === 'SHEET' && line.subSheetId) {
        const check = await validateSubSheetHierarchy(db, line.subSheetId, level.order, ctx.tenantId)
        if (!check.ok) return apiError(check.code, check.message, check.status)
      }
    }

    const sheet = await db.$transaction(async (tx) => {
      const newSheet = await tx.bomSheet.create({
        data: {
          levelId: parsed.data.levelId,
          name: parsed.data.name,
          description: parsed.data.description,
          outputUnit: parsed.data.outputUnit,
          outputQty: parsed.data.outputQty,
          prepTime: parsed.data.prepTime,
          targetStock: parsed.data.targetStock,
        },
      })

      for (const line of parsed.data.lines) {
        await tx.bomLine.create({
          data: {
            sheetId: newSheet.id,
            inputType: line.inputType,
            ingredientId: line.ingredientId ?? null,
            subSheetId: line.subSheetId ?? null,
            quantity: line.quantity,
            unit: line.unit,
          },
        })
      }

      return tx.bomSheet.findUniqueOrThrow({
        where: { id: newSheet.id },
        include: { lines: true, _count: { select: { lines: true } } },
      })
    })

    return apiCreated(sheet)
  })
}
