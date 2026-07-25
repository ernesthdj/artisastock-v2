// GET /api/v1/pos/caisse?vendeurId=... — Session de caisse ouverte courante pour un vendeur (UC3/UC7)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withPermission(request, ['pos.sell', 'pos.manage'], async (ctx) => {
    const vendeurId = request.nextUrl.searchParams.get('vendeurId');
    if (!vendeurId) {
      return apiError('VALIDATION_ERROR', 'vendeurId requis', 400);
    }

    const db = getPrismaWithTenant(ctx.tenantId);
    const session = await db.sessionCaisse.findFirst({
      where: { vendeurId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    return apiSuccess(session);
  });
}
