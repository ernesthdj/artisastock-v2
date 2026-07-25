// POST /api/v1/pos/caisse/open — Ouvrir une session de caisse pour un vendeur (UC3)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiCreated, apiError } from '@/lib/permissions';
import { caisseOpenSchema } from '@/lib/validators/session-caisse';
import { verifyVendeurPin } from '@/lib/pos/vendeur-auth';

export async function POST(request: NextRequest) {
  return withPermission(request, 'pos.sell', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = caisseOpenSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const { vendeurId, pin, openingFloat } = parsed.data;
    const auth = await verifyVendeurPin(ctx.tenantId, vendeurId, pin);
    if (!auth.ok) {
      // Même règle que verify-pin : jamais 401 sur un rejet de PIN (réservé au refresh JWT
      // silencieux de apiClient, qui doublerait sinon failedPinAttempts).
      const status = auth.code === 'NOT_FOUND' ? 404 : 400;
      return apiError(auth.code, auth.message, status);
    }

    const db = getPrismaWithTenant(ctx.tenantId);
    const existing = await db.sessionCaisse.findFirst({ where: { vendeurId, status: 'OPEN' } });
    if (existing) {
      return apiError('ALREADY_OPEN', 'Ce vendeur a déjà une session de caisse ouverte', 400);
    }

    const session = await db.sessionCaisse.create({
      data: { tenantId: ctx.tenantId, vendeurId, openingFloat },
    });

    return apiCreated(session);
  });
}
