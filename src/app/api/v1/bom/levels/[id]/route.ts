// GET/POST/PATCH/DELETE /api/v1/bom/levels/[id]
// POST crée un nouveau niveau dans le contexte du niveau [id] (contextId partagé)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getPrismaWithTenant } from '@/lib/prisma'
import {
  withPermission,
  apiSuccess,
  apiNoContent,
  apiError,
} from '@/lib/permissions'

const levelUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const level = await db.bomLevel.findUnique({
      where: { id },
      include: {
        context: { select: { id: true, name: true, tenantId: true } },
        sheets: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!level) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
    if (level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)

    return apiSuccess(level)
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

    const parsed = levelUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues)
    }

    const db = getPrismaWithTenant(ctx.tenantId)
    const level = await db.bomLevel.findUnique({
      where: { id },
      include: { context: { select: { tenantId: true } } },
    })

    if (!level) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
    if (level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)

    const updated = await db.bomLevel.update({
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

    const level = await db.bomLevel.findUnique({
      where: { id },
      include: {
        context: { select: { tenantId: true } },
        _count: { select: { sheets: true, productions: true } },
      },
    })

    if (!level) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)
    if (level.context.tenantId !== ctx.tenantId) return apiError('NOT_FOUND', 'Niveau BOM introuvable', 404)

    // N1 = niveau ingrédients obligatoire — jamais supprimable, quel que soit son rang
    // (décision produit explicite, distincte de la règle v1 "dernier niveau uniquement" qui
    // s'applique aux niveaux N2+).
    if (level.order === 1) {
      return apiError(
        'FORBIDDEN',
        'Le niveau N1 (Ingrédients) est obligatoire et ne peut pas être supprimé',
        403
      )
    }

    // Guard productions
    if (level._count.productions > 0) {
      return apiError(
        'CONFLICT',
        `Impossible de supprimer : ${level._count.productions} production(s) référencent ce niveau`,
        409
      )
    }

    // Règle réelle v1 (BomNiveauDAL.Delete) : uniquement le niveau d'ordre maximum du contexte,
    // aucune protection spécifique par rang — un niveau intermédiaire ne peut jamais être supprimé.
    const higherLevelsCount = await db.bomLevel.count({
      where: { contextId: level.contextId, order: { gt: level.order } },
    })
    if (higherLevelsCount > 0) {
      return apiError(
        'CONFLICT',
        'Impossible de supprimer un niveau intermédiaire. Supprimez d\'abord les niveaux supérieurs.',
        409
      )
    }

    await db.bomLevel.delete({ where: { id } })

    return apiNoContent()
  })
}
