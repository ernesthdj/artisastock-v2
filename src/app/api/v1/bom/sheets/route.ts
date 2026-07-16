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

const sheetCreateSchema = z.object({
  levelId: z.string().cuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  outputUnit: z.nativeEnum(UnitOfMeasure),
  outputQty: z.number().positive(),
  prepTime: z.number().int().positive().optional(),
  targetStock: z.number().positive().optional(),
})

export async function GET(request: NextRequest) {
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const levelId = sp.get('levelId')
    if (!levelId) return apiError('VALIDATION_ERROR', 'Paramètre levelId requis', 400)

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

    // Guard doublon nom dans le niveau
    const existing = await db.bomSheet.findUnique({
      where: { levelId_name: { levelId: parsed.data.levelId, name: parsed.data.name } },
    })
    if (existing) {
      return apiError('CONFLICT', `Une fiche "${parsed.data.name}" existe déjà dans ce niveau`, 409)
    }

    const sheet = await db.bomSheet.create({
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

    return apiCreated(sheet)
  })
}
