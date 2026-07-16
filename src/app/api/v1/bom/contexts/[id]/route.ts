// GET/PATCH/DELETE /api/v1/bom/contexts/[id]

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant, prisma } from '@/lib/prisma'
import {
  withPermission,
  apiSuccess,
  apiNoContent,
  apiError,
} from '@/lib/permissions'

const contextUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const context = await db.bomContext.findUnique({
      where: { id },
      include: {
        levels: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { sheets: true } },
          },
        },
      },
    })

    if (!context) return apiError('NOT_FOUND', 'Contexte BOM introuvable', 404)

    return apiSuccess(context)
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

    const parsed = contextUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)
    const existing = await db.bomContext.findUnique({ where: { id } })
    if (!existing) return apiError('NOT_FOUND', 'Contexte BOM introuvable', 404)

    const updated = await db.bomContext.update({
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

    const context = await db.bomContext.findUnique({ where: { id } })
    if (!context) return apiError('NOT_FOUND', 'Contexte BOM introuvable', 404)

    // Guard : productions existantes
    const productionCount = await prisma.bomProduction.count({
      where: { tenantId: ctx.tenantId, level: { contextId: id } },
    })
    if (productionCount > 0) {
      return apiError(
        'CONFLICT',
        `Impossible de supprimer : ${productionCount} production(s) référencent ce contexte`,
        409
      )
    }

    await db.bomContext.delete({ where: { id } })

    return apiNoContent()
  })
}
