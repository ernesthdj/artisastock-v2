// GET/PATCH /api/v1/activites/[id]

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiSuccess, apiError } from '@/lib/permissions'

const activiteUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'activites.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const activite = await db.activite.findUnique({
      where: { id },
      include: {
        stocks: { include: { stock: true } },
      },
    })

    if (!activite) return apiError('NOT_FOUND', 'Activité introuvable', 404)

    return apiSuccess(activite)
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'activites.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = activiteUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.activite.findUnique({ where: { id } })
    if (!existing) return apiError('NOT_FOUND', 'Activité introuvable', 404)

    if (parsed.data.name && parsed.data.name !== existing.name) {
      const duplicate = await db.activite.findUnique({
        where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
      })
      if (duplicate) {
        return apiError('CONFLICT', `Une activité nommée "${parsed.data.name}" existe déjà`, 409)
      }
    }

    const activite = await db.activite.update({
      where: { id },
      data: parsed.data,
    })

    return apiSuccess(activite)
  })
}
