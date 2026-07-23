// POST /api/v1/bom/sheets/[id]/duplicate — mirroring BomFicheDAL.Duplicate v1
// Copie l'en-tête + toutes les lignes dans une nouvelle fiche du même niveau,
// avec un nom "Copie de X" (suffixé (2), (3)... si déjà pris).

import { NextRequest } from 'next/server'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiCreated, apiError } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withPermission(request, 'bom.write', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const source = await db.bomSheet.findUnique({
      where: { id },
      include: {
        level: { include: { context: { select: { tenantId: true } } } },
        lines: true,
      },
    })

    if (!source) return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    if (source.level.context.tenantId !== ctx.tenantId) {
      return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404)
    }

    const baseName = `Copie de ${source.name}`
    let name = baseName
    let suffix = 2
    while (
      await db.bomSheet.findUnique({ where: { levelId_name: { levelId: source.levelId, name } } })
    ) {
      name = `${baseName} (${suffix++})`
    }

    const duplicate = await db.$transaction(async (tx) => {
      const newSheet = await tx.bomSheet.create({
        data: {
          levelId: source.levelId,
          name,
          description: source.description,
          outputUnit: source.outputUnit,
          outputQty: source.outputQty,
          prepTime: source.prepTime,
          targetStock: source.targetStock,
        },
      })

      for (const line of source.lines) {
        await tx.bomLine.create({
          data: {
            sheetId: newSheet.id,
            inputType: line.inputType,
            ingredientId: line.ingredientId,
            subSheetId: line.subSheetId,
            quantity: line.quantity,
            unit: line.unit,
          },
        })
      }

      return tx.bomSheet.findUniqueOrThrow({
        where: { id: newSheet.id },
        include: { lines: true, _count: { select: { lines: true } } },
      })
    })

    return apiCreated(duplicate)
  })
}
