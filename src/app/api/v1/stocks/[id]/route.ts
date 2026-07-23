// GET/PATCH /api/v1/stocks/[id]
//
// Pas de DELETE définitif exposé : la garde réelle v1 (StockDAL.Delete vérifie l'absence de
// lots_ingredients liés) n'est pas reproductible tant que le module Achats/Lots n'existe pas —
// un hard-delete non gardé serait risqué. isActive permet de "retirer" un stock sans le
// supprimer physiquement (même logique que pour Activite).

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiSuccess, apiError } from '@/lib/permissions'

const stockUpdateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'stocks.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const stock = await db.stock.findUnique({
      where: { id },
      include: { activites: { include: { activite: true } } },
    })

    if (!stock) return apiError('NOT_FOUND', 'Stock introuvable', 404)

    return apiSuccess(stock)
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'stocks.write', async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400)
    }

    const parsed = stockUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)

    const existing = await db.stock.findUnique({ where: { id } })
    if (!existing) return apiError('NOT_FOUND', 'Stock introuvable', 404)

    if (parsed.data.name && parsed.data.name !== existing.name) {
      const duplicate = await db.stock.findUnique({
        where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
      })
      if (duplicate) {
        return apiError('CONFLICT', `Un stock nommé "${parsed.data.name}" existe déjà`, 409)
      }
    }

    const stock = await db.stock.update({
      where: { id },
      data: parsed.data,
    })

    return apiSuccess(stock)
  })
}
