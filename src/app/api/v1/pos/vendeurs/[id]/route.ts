// PATCH /api/v1/pos/vendeurs/[id] — Modifier un vendeur (activer/désactiver, reset PIN)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { vendeurUpdateSchema } from '@/lib/validators/vendeur';
import { hashPassword } from '@/lib/auth';
import { isPinTaken } from '@/lib/pos/vendeur-auth';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'pos.manage', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = vendeurUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const db = getPrismaWithTenant(ctx.tenantId);
    const existing = await db.vendeur.findUnique({ where: { id: params.id } });
    if (!existing) return apiError('NOT_FOUND', 'Vendeur introuvable', 404);

    const { pin, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (pin) {
      if (await isPinTaken(ctx.tenantId, pin, params.id)) {
        return apiError('PIN_TAKEN', 'Ce PIN est déjà utilisé par un autre vendeur', 409);
      }
      data['pinHash'] = await hashPassword(pin);
      data['failedPinAttempts'] = 0;
      data['lockedUntil'] = null;
    }

    const vendeur = await db.vendeur.update({
      where: { id: params.id },
      data,
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });

    return apiSuccess(vendeur);
  });
}
