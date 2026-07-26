// GET /api/v1/pos/pointages — Historique des pointages horaires (UC12)
// Admin uniquement pour l'instant (pos.read) — pas d'accès direct Vendeur au POS
// (identité PIN, pas de compte User), donc pas de RBAC "voit les siens" à ce stade.

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withPermission(request, 'pos.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const sp = request.nextUrl.searchParams;

    const where: { vendeurId?: string } = {};
    if (sp.get('vendeurId')) where.vendeurId = sp.get('vendeurId')!;

    const pointages = await db.pointageHoraire.findMany({
      where,
      include: { vendeur: { select: { firstName: true, lastName: true } } },
      orderBy: { clockIn: 'desc' },
      take: 200,
    });

    return apiSuccess(pointages);
  });
}
