// POST /api/v1/pos/caisse/[id]/close — Fermer une session de caisse, calcule l'écart (UC7)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { caisseCloseSchema } from '@/lib/validators/session-caisse';
import { verifyVendeurPin } from '@/lib/pos/vendeur-auth';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'pos.sell', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = caisseCloseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const { vendeurId, pin, closingFloat } = parsed.data;
    const auth = await verifyVendeurPin(ctx.tenantId, vendeurId, pin);
    if (!auth.ok) {
      const status = auth.code === 'NOT_FOUND' ? 404 : 400;
      return apiError(auth.code, auth.message, status);
    }

    const db = getPrismaWithTenant(ctx.tenantId);
    const session = await db.sessionCaisse.findUnique({ where: { id: params.id } });
    if (!session) {
      return apiError('NOT_FOUND', 'Session de caisse introuvable', 404);
    }
    if (session.vendeurId !== vendeurId) {
      return apiError('FORBIDDEN', "Cette session n'appartient pas à ce vendeur", 403);
    }
    if (session.status !== 'OPEN') {
      return apiError('ALREADY_CLOSED', 'Cette session de caisse est déjà fermée', 400);
    }

    const cashSales = await db.posSale.aggregate({
      where: { sessionCaisseId: session.id, paymentMethod: 'CASH' },
      _sum: { totalTTC: true },
    });
    const expected = Number(session.openingFloat) + Number(cashSales._sum.totalTTC ?? 0);
    const variance = closingFloat - expected;

    const updated = await db.sessionCaisse.update({
      where: { id: session.id },
      data: { closingFloat, variance, status: 'CLOSED', closedAt: new Date() },
    });

    return apiSuccess(updated);
  });
}
