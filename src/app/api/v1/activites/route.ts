// GET /api/v1/activites — Liste des activités (inclut les inactives, comme FrmActivites en v1)
// POST /api/v1/activites — Créer une activité

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant } from '@/lib/prisma'
import {
  withPermission,
  apiCreated,
  apiError,
  apiPaginated,
  parsePagination,
} from '@/lib/permissions'

const activiteCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
})

export async function GET(request: NextRequest) {
  return withPermission(request, 'activites.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const [data, total] = await Promise.all([
      db.activite.findMany({
        include: { _count: { select: { stocks: true, bomContexts: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.activite.count({}),
    ])

    return apiPaginated(data, page, pageSize, total)
  })
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'activites.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = activiteCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.activite.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    })
    if (existing) {
      return apiError('CONFLICT', `Une activité nommée "${parsed.data.name}" existe déjà`, 409)
    }

    const activite = await db.activite.create({
      data: {
        tenantId: ctx.tenantId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    })

    return apiCreated(activite)
  })
}
