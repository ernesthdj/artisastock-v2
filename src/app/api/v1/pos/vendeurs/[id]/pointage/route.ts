// GET /api/v1/pos/vendeurs/[id]/pointage — Pointage en cours (non clôturé) d'un vendeur

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, ['pos.sell', 'pos.manage'], async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const pointage = await db.pointageHoraire.findFirst({
      where: { vendeurId: params.id, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });

    return apiSuccess(pointage);
  });
}
