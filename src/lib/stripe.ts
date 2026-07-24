import Stripe from 'stripe';

// Instanciation paresseuse : Stripe n'est pas encore activé en production, la clé peut être
// absente. Ne jamais lever au chargement du module — ça casserait le build/toute route qui
// importe ce fichier, même sans jamais appeler Stripe (même bug déjà corrigé pour email.ts).
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not defined');
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }
  return _stripe;
}

// Convertit un montant TTC en centimes pour Stripe
export function toCents(amountTTC: number): number {
  return Math.round(amountTTC * 100);
}

export interface CheckoutLineItem {
  name: string;
  quantity: number;
  unitPriceTTC: number;
}

export async function createCheckoutSession(params: {
  tenantSlug: string;
  stripeAccountId: string;
  lineItems: CheckoutLineItem[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const { tenantSlug, stripeAccountId, lineItems, customerEmail, successUrl, cancelUrl, metadata } = params;

  const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lineItems.map((item) => ({
    price_data: {
      currency: 'eur',
      product_data: { name: item.name },
      unit_amount: toCents(item.unitPriceTTC),
    },
    quantity: item.quantity,
  }));

  return getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card', 'bancontact', 'ideal'],
      customer_email: customerEmail,
      line_items: stripeLineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        tenantSlug,
      },
      payment_intent_data: {
        application_fee_amount: toCents(
          lineItems.reduce((sum, i) => sum + i.unitPriceTTC * i.quantity, 0) * 0.02
        ),
        transfer_data: { destination: stripeAccountId },
      },
    },
    { stripeAccount: stripeAccountId }
  );
}

export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
  return getStripe().webhooks.constructEvent(body, signature, secret);
}
