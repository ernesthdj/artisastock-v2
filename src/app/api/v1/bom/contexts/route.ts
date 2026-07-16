// GET /api/v1/bom/contexts — Liste paginée des contextes BOM
// POST /api/v1/bom/contexts — Créer un contexte + niveau N0 (transaction atomique)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant, prisma } from '@/lib/prisma'
import {
  withPermission,
  apiCreated,
  apiError,
  apiPaginated,
  parsePagination,
} from '@/lib/permissions'

const contextCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
})

export async function GET(request: NextRequest) {
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const where: Record<string, unknown> = {}
    const isActiveParam = sp.get('isActive')
    if (isActiveParam !== null) where['isActive'] = isActiveParam === 'true'

    const [data, total] = await Promise.all([
      db.bomContext.findMany({
        where,
        include: {
          _count: { select: { levels: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.bomContext.count({ where }),
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

    const parsed = contextCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const existing = await prisma.bomContext.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    })
    if (existing) {
      return apiError('CONFLICT', `Un contexte BOM nommé "${parsed.data.name}" existe déjà`, 409)
    }

    // Transaction atomique : contexte + niveau N0
    const context = await prisma.$transaction(async (tx) => {
      const newContext = await tx.bomContext.create({
        data: {
          tenantId: ctx.tenantId,
          name: parsed.data.name,
          description: parsed.data.description,
        },
      })

      await tx.bomLevel.create({
        data: {
          contextId: newContext.id,
          order: 0,
          name: 'Stock ingrédients',
          description: 'Niveau de base — ingrédients bruts (non supprimable)',
        },
      })

      return tx.bomContext.findUniqueOrThrow({
        where: { id: newContext.id },
        include: { levels: true },
      })
    })

    return apiCreated(context)
  })
}
