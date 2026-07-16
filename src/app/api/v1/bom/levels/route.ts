// POST /api/v1/bom/levels — Créer un nouveau niveau dans un contexte BOM

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiCreated, apiError } from '@/lib/permissions'

const levelCreateSchema = z.object({
  contextId: z.string().cuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  return withPermission(request, 'bom.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = levelCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const context = await db.bomContext.findUnique({ where: { id: parsed.data.contextId } })
    if (!context) return apiError('NOT_FOUND', 'Contexte BOM introuvable', 404)

    const maxLevel = await db.bomLevel.findFirst({
      where: { contextId: parsed.data.contextId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const nextOrder = (maxLevel?.order ?? 0) + 1

    const level = await db.bomLevel.create({
      data: {
        contextId: parsed.data.contextId,
        order: nextOrder,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    })

    return apiCreated(level)
  })
}
