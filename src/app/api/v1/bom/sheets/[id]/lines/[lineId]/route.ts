// DELETE /api/v1/bom/sheets/[id]/lines/[lineId]

import { NextRequest } from 'next/server'
import { getPrismaWithTenant } from '@/lib/prisma'
import { withPermission, apiNoContent, apiError } from '@/lib/permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id, lineId } = await params
  return withPermission(request, 'bom.write', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId)

    const line = await db.bomLine.findUnique({
      where: { id: lineId },
      include: {
        sheet: {
          include: { level: { include: { context: { select: { tenantId: true } } } } },
        },
      },
    })

    if (!line) return apiError('NOT_FOUND', 'Ligne BOM introuvable', 404)
    if (line.sheetId !== id) return apiError('NOT_FOUND', 'Ligne BOM introuvable', 404)
    if (line.sheet.level.context.tenantId !== ctx.tenantId)
      return apiError('NOT_FOUND', 'Ligne BOM introuvable', 404)

    await db.bomLine.delete({ where: { id: lineId } })

    return apiNoContent()
  })
}
