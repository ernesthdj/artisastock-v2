// GET /api/v1/bom/sheets?levelId= — Liste fiches d'un niveau
// POST /api/v1/bom/sheets — Créer une fiche BOM

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { UnitOfMeasure } from '@prisma/client'
import { getPrismaWithTenant } from '@/lib/prisma'
import {
  withPermission,
  apiCreated,
  apiError,
  apiPaginated,
  parsePagination,
} from '@/lib/permissions'
import { validateSubSheetHierarchy } from '@/lib/bom/validateLine'

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
    if (!levelId) return apiError('VALIDATION_ERROR', 'Paramètre levelId requis', 400)

    // Vérifier que le niveau appartient au tenant avant de lister ses fiches
    const level = await db.bomLevel.findUnique({
      where: { id: levelId },
      include: { context: { select: { tenantId: true } } },
    })
    if (!level) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
    if (level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)

    const where: Record<string, unknown> = { levelId }
    if (sp.get('isActive') !== null) where['isActive'] = sp.get('isActive') === 'true'

    const [data, total] = await Promise.all([
      db.bomSheet.findMany({
        where,
        include: { _count: { select: { lines: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      db.bomSheet.count({ where }),
    ])

    return apiPaginated(data, page, pageSize, total)
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
