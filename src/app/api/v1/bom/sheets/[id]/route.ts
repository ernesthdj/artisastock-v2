// GET/PATCH/DELETE /api/v1/bom/sheets/[id]

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { UnitOfMeasure } from '@prisma/client'
import { getPrismaWithTenant } from '@/lib/prisma'
import {
  withPermission,
  apiSuccess,
  apiNoContent,
  apiError,
} from '@/lib/permissions'

const sheetUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
  outputUnit: z.nativeEnum(UnitOfMeasure).optional(),
  outputQty: z.number().positive().optional(),
  prepTime: z.number().int().positive().nullable().optional(),
  targetStock: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})

async function getSheetWithTenantCheck(id: string, tenantId: string) {
  const db = getPrismaWithTenant(tenantId)
  const sheet = await db.bomSheet.findUnique({
    where: { id },
    include: { level: { include: { context: { select: { tenantId: true } } } } },
  })
  if (!sheet) return null
  if (sheet.level.context.tenantId !== tenantId) return null
  return sheet
}

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
          include: { context: { select: { id: true, name: true, tenantId: true } } },
        },
        lines: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true, priceUnit: true } },
            subSheet: { select: { id: true, name: true, outputQty: true, outputUnit: true } },
          },
          orderBy: { id: 'asc' },
        },
        _count: { select: { productions: true } },
      },
    })

    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    if (sheet.level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    return apiSuccess(sheet)
  })
}

export async function PATCH(
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

    const parsed = sheetUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const sheet = await getSheetWithTenantCheck(id, ctx.tenantId)
    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    const db = getPrismaWithTenant(ctx.tenantId)
    const updated = await db.bomSheet.update({
      where: { id },
      data: parsed.data,
    })

    return apiSuccess(updated)
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.write', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const sheet = await db.bomSheet.findUnique({
      where: { id },
      include: {
        level: { include: { context: { select: { tenantId: true } } } },
        _count: { select: { productions: true, asInputLines: true } },
      },
    })

    if (!sheet) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    if (sheet.level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)

    if (sheet._count.productions > 0) {
      return apiError(
        'CONFLICT',
        `Impossible de supprimer : ${sheet._count.productions} production(s) utilisent cette fiche`,
        409
      )
    }

    if (sheet._count.asInputLines > 0) {
      return apiError(
        'CONFLICT',
        `Impossible de supprimer : cette fiche est utilisée comme ingrédient dans ${sheet._count.asInputLines} autre(s) fiche(s)`,
        409
      )
    }

    await db.bomSheet.delete({ where: { id } })

    return apiNoContent()
  })
}
