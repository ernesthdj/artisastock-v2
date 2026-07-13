import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess, apiError } from '@/lib/permissions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' });

// Initier l'onboarding Stripe Connect
export const POST = withAuth(async (
  _request: NextRequest,
  ctx: { tenantId: string }
) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true, email: true, settings: true },
  });
  if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);

  const settings = tenant.settings as Record<string, string>;

  let accountId: string;

  if (settings?.stripeAccountId) {
    accountId = settings.stripeAccountId;
  } else {
    // Créer un compte Express
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BE',
      email: tenant.email ?? undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: tenant.name },
    });

    accountId = account.id;

    // Sauvegarder l'ID du compte
    await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { settings: { ...settings, stripeAccountId: accountId } },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/admin/settings/payments?stripe=refresh`,
    return_url: `${appUrl}/admin/settings/payments?stripe=success`,
    type: 'account_onboarding',
  });

  return apiSuccess({ url: accountLink.url });
});
