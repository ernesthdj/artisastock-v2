// GET /api/v1/bom/productions?contextId=xxx&pageSize=20&page=1 — Liste productions BOM

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, apiPaginated, apiError, parsePagination } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  return withPermission(request, 'bom.read', async (ctx) => {
    const { searchParams } = request.nextUrl
    const contextId = searchParams.get('contextId')

    if (!contextId) {
      return apiError('VALIDATION_ERROR', 'contextId est requis', 400)
    }

    const { page, pageSize, skip } = parsePagination(searchParams)

    const where = {
      tenantId: ctx.tenantId,
      sheet: {
        level: {
          contextId,
          context: { tenantId: ctx.tenantId },
        },
      },
    }

    const [productions, total] = await Promise.all([
      prisma.bomProduction.findMany({
        where,
        include: {
          sheet: {
            select: {
              name: true,
              outputUnit: true,
              outputQty: true,
            },
          },
          level: {
            select: {
              name: true,
              order: true,
            },
          },
        },
        orderBy: { producedAt: 'desc' },
        take: pageSize,
        skip,
      }),
      prisma.bomProduction.count({ where }),
    ])

    return apiPaginated(productions, page, pageSize, total)
  })
}
