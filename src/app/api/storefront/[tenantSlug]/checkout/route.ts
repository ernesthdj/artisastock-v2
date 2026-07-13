import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';
import { checkoutSchema } from '@/lib/validators/order';
import { createCheckoutSession } from '@/lib/stripe';
import { parseISO } from 'date-fns';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantSlug: string } }
) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    include: { siteConfig: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  // Vérifier les produits et leur disponibilité
  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: tenant.id, isActive: true, isVisible: true, isClickCollect: true, deletedAt: null },
  });

  if (products.length !== productIds.length) {
    return apiError('PRODUCT_UNAVAILABLE', 'Un ou plusieurs produits ne sont plus disponibles', 400);
  }

  // Vérifier les stocks daily
  for (const item of parsed.data.items) {
    const product = products.find((p) => p.id === item.productId)!;
    if (product.stockType === 'limited' && product.stockQuantity !== null) {
      if (product.stockQuantity < item.quantity) {
        return apiError('STOCK_INSUFFICIENT', `Stock insuffisant pour "${product.name}"`, 400);
      }
    }
  }

  // Vérifier que le jour de retrait n'est pas fermé
  const pickupDate = parseISO(parsed.data.pickupSlot.date);
  const isClosed = await prisma.closedDay.findFirst({
    where: { tenantId: tenant.id, date: pickupDate },
  });
  if (isClosed) {
    return apiError('CLOSED_DAY', 'Le commerce est fermé à cette date', 400);
  }

  // Vérifier que le tenant a Stripe configuré
  const tenantSettings = tenant.settings as Record<string, string>;
  const stripeAccountId = tenantSettings?.['stripeAccountId'];
  if (!stripeAccountId) {
    return apiError('STRIPE_NOT_CONFIGURED', 'Le paiement en ligne n\'est pas encore configuré pour ce commerce', 400);
  }

  // Construire les lignes de commande
  const lineItems = parsed.data.items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return {
      name: product.name,
      quantity: item.quantity,
      unitPriceTTC: Number(product.priceTTC),
      vatRate: product.vatRate as 'FOOD_6' | 'STANDARD_21',
    };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Créer la session Stripe Checkout
  const session = await createCheckoutSession({
    tenantSlug: params.tenantSlug,
    stripeAccountId,
    lineItems,
    customerEmail: parsed.data.customer.email,
    successUrl: `${appUrl}/storefront/${params.tenantSlug}/order/pending?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/storefront/${params.tenantSlug}/cart`,
    metadata: {
      tenantId: tenant.id,
      customerFirstName: parsed.data.customer.firstName,
      customerLastName: parsed.data.customer.lastName,
      customerEmail: parsed.data.customer.email,
      customerPhone: parsed.data.customer.phone ?? '',
      pickupDate: parsed.data.pickupSlot.date,
      pickupStartTime: parsed.data.pickupSlot.startTime,
      pickupEndTime: parsed.data.pickupSlot.endTime,
      locale: parsed.data.locale,
      notes: parsed.data.notes ?? '',
      items: JSON.stringify(parsed.data.items),
    },
  });

  return apiSuccess({ stripeCheckoutUrl: session.url });
}
