// GET /api/v1/bom/sheets/[id]/lines — Toutes les lignes de la fiche
// POST /api/v1/bom/sheets/[id]/lines — Ajouter une ligne

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { UnitOfMeasure } from '@prisma/client'
import { getPrismaWithTenant } from '@/lib/prisma'
import {
  withPermission,
  apiSuccess,
  apiCreated,
  apiError,
} from '@/lib/permissions'

const lineCreateSchema = z
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
    {
      message:
        'INGREDIENT requiert ingredientId seul ; SHEET requiert subSheetId seul',
    }
  )

async function resolveSheet(id: string, tenantId: string) {
  const db = getPrismaWithTenant(tenantId)
  const sheet = await db.bomSheet.findUnique({
    where: { id },
    include: {
      level: {
        include: { context: { select: { tenantId: true } } },
      },
    },
  })
  if (!sheet || sheet.level.context.tenantId !== tenantId) return null
  return sheet
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.read', async (ctx) => {
    const sheet = await resolveSheet(id, ctx.tenantId)
    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    const db = getPrismaWithTenant(ctx.tenantId)
    const lines = await db.bomLine.findMany({
      where: { sheetId: id },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, priceUnit: true, stock: true } },
        subSheet: { select: { id: true, name: true, outputQty: true, outputUnit: true } },
      },
      orderBy: { id: 'asc' },
    })

    return apiSuccess(lines)
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = lineCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const sheet = await resolveSheet(id, ctx.tenantId)
    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    const db = getPrismaWithTenant(ctx.tenantId)

    // Guard doublon
    const duplicateWhere =
      parsed.data.inputType === 'INGREDIENT'
        ? { sheetId: id, ingredientId: parsed.data.ingredientId }
        : { sheetId: id, subSheetId: parsed.data.subSheetId }

    const duplicate = await db.bomLine.findFirst({ where: duplicateWhere })
    if (duplicate) {
      return apiError('CONFLICT', 'Cet ingrédient/fiche est déjà présent dans la fiche', 409)
    }

    // Guard hiérarchie : sous-fiche doit être d'un niveau inférieur
    if (parsed.data.inputType === 'SHEET' && parsed.data.subSheetId) {
      const subSheet = await db.bomSheet.findUnique({
        where: { id: parsed.data.subSheetId },
        include: { level: { select: { order: true } } },
      })

      if (!subSheet) return apiError('NOT_FOUND', 'Sous-fiche BOM introuvable', 404)

      if (subSheet.level.order >= sheet.level.order) {
        return apiError(
          'VALIDATION_ERROR',
          `Hiérarchie invalide : la sous-fiche (N${subSheet.level.order}) doit être d'un niveau inférieur à la fiche courante (N${sheet.level.order})`,
          422
        )
      }
    }

    const line = await db.bomLine.create({
      data: {
        sheetId: id,
        inputType: parsed.data.inputType,
        ingredientId: parsed.data.ingredientId ?? null,
        subSheetId: parsed.data.subSheetId ?? null,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
      },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, priceUnit: true } },
        subSheet: { select: { id: true, name: true, outputQty: true, outputUnit: true } },
      },
    })

    return apiCreated(line)
  })
}
