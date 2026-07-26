// GET /api/v1/pos/caisse-sessions — Historique des sessions de caisse avec écarts (UC10)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withPermission(request, 'pos.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const sp = request.nextUrl.searchParams;

    const where: { vendeurId?: string } = {};
    if (sp.get('vendeurId')) where.vendeurId = sp.get('vendeurId')!;

    const sessions = await db.sessionCaisse.findMany({
      where,
      include: { vendeur: { select: { firstName: true, lastName: true } } },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });

    return apiSuccess(sessions);
  });
}
