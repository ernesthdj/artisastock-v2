// POST /api/v1/pos/vendeurs/[id]/clock-in — Pointer l'arrivée d'un vendeur (UC2)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiCreated, apiError } from '@/lib/permissions';
import { pointageActionSchema } from '@/lib/validators/pointage';
import { verifyVendeurPin } from '@/lib/pos/vendeur-auth';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'pos.sell', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = pointageActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const auth = await verifyVendeurPin(ctx.tenantId, params.id, parsed.data.pin);
    if (!auth.ok) {
      const status = auth.code === 'NOT_FOUND' ? 404 : 400;
      return apiError(auth.code, auth.message, status);
    }

    const db = getPrismaWithTenant(ctx.tenantId);
    const open = await db.pointageHoraire.findFirst({ where: { vendeurId: params.id, clockOut: null } });
    if (open) {
      return apiError('ALREADY_CLOCKED_IN', 'Ce vendeur a déjà pointé son arrivée', 400);
    }

    const pointage = await db.pointageHoraire.create({ data: { tenantId: ctx.tenantId, vendeurId: params.id } });
    return apiCreated(pointage);
  });
}
