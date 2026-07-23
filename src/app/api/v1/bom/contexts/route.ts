// GET /api/v1/bom/contexts — Liste paginée des contextes BOM
// POST /api/v1/bom/contexts — Créer un contexte + ses niveaux (transaction atomique)

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
  activiteId: z.string().cuid(),
  // Noms des niveaux saisis dans le même formulaire de création (mirroring FrmBomContexteEdit).
  // Le premier élément nomme le niveau 1 — vide/absent → "Ingrédients" par défaut.
  levels: z.array(z.string().max(100)).default([]),
})

export async function GET(request: NextRequest) {
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(sp)

    const where: Record<string, unknown> = {}
    const isActiveParam = sp.get('isActive')
    if (isActiveParam !== null) where['isActive'] = isActiveParam === 'true'
    const activiteId = sp.get('activiteId')
    if (activiteId) where['activiteId'] = activiteId

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

    const db = getPrismaWithTenant(ctx.tenantId)

    const activite = await db.activite.findUnique({ where: { id: parsed.data.activiteId } })
    if (!activite) return apiError('NOT_FOUND', 'Activité introuvable', 404)

    const existing = await db.bomContext.findUnique({
      where: { activiteId_name: { activiteId: parsed.data.activiteId, name: parsed.data.name } },
    })
    if (existing) {
      return apiError('CONFLICT', `Un contexte BOM nommé "${parsed.data.name}" existe déjà pour cette activité`, 409)
    }

    // Noms de niveaux non vides, dans l'ordre saisi. Le niveau 1 défaut à "Ingrédients"
    // si son nom est vide/absent (mirroring BomContexteDAL.InsertAvecNiveaux).
    const rawNames = parsed.data.levels.map((n) => n.trim())
    const firstName = rawNames[0] || 'Ingrédients'
    const levelNames = [firstName, ...rawNames.slice(1).filter((n) => n.length > 0)]

    // Transaction atomique : contexte + tous ses niveaux, ordre commençant à 1
    const context = await prisma.$transaction(async (tx) => {
      const newContext = await tx.bomContext.create({
        data: {
          tenantId: ctx.tenantId,
          activiteId: parsed.data.activiteId,
          name: parsed.data.name,
          description: parsed.data.description,
        },
      })

      for (let i = 0; i < levelNames.length; i++) {
        await tx.bomLevel.create({
          data: {
            contextId: newContext.id,
            order: i + 1,
            name: levelNames[i],
          },
        })
      }

      return tx.bomContext.findUniqueOrThrow({
        where: { id: newContext.id },
        include: { levels: true },
      })
    })

    return apiCreated(context)
  })
}
