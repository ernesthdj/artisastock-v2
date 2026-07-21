import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess, apiError } from '@/lib/permissions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true },
  });
  if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);

  const settings = tenant.settings as Record<string, string>;
  const accountId = settings?.stripeAccountId;

  if (!accountId) {
    return apiSuccess({ connected: false, accountId: null, chargesEnabled: false, payoutsEnabled: false });
  }

  const account = await stripe.accounts.retrieve(accountId);

  return apiSuccess({
    connected: true,
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
    requirementsEventuallyDue: account.requirements?.eventually_due ?? [],
      detailsSubmitted: account.details_submitted,
    });
  });
}
