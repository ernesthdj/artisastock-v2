import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  return withPermission(request, 'settings.write', async (ctx) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true },
  });
  if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);

  const settings = tenant.settings as Record<string, string>;
  const accountId = settings?.stripeAccountId;

  if (!accountId) {
    return apiError('NOT_CONNECTED', 'Aucun compte Stripe connecté', 400);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return apiError('NOT_CONFIGURED', 'Stripe n\'est pas configuré sur cette instance', 501);
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

  // Déconnecter le compte Express de la plateforme
  await stripe.oauth.deauthorize({ client_id: process.env.STRIPE_CLIENT_ID!, stripe_user_id: accountId });

  // Supprimer l'ID du compte des settings
  const { stripeAccountId: _, ...remainingSettings } = settings;
  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { settings: remainingSettings },
  });

    return apiSuccess({ disconnected: true });
  });
}
