// GET /api/v1/stocks — Liste des stocks (emplacements physiques)
// POST /api/v1/stocks — Créer un stock

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

const stockCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(500).optional(),
})

export async function GET(request: NextRequest) {
  return withPermission(request, 'stocks.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const [data, total] = await Promise.all([
      db.stock.findMany({
        include: { activites: { include: { activite: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.stock.count({}),
    ])

    return apiPaginated(data, page, pageSize, total)
  })
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'stocks.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = stockCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.stock.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    })
    if (existing) {
      return apiError('CONFLICT', `Un stock nommé "${parsed.data.name}" existe déjà`, 409)
    }

    const stock = await db.stock.create({
      data: {
        tenantId: ctx.tenantId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    })

    return apiCreated(stock)
  })
}
