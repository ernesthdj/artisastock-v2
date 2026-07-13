import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructWebhookEvent } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber } from '@/lib/costs';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { VatRate } from '@prisma/client';

// Stripe webhooks — pas d'auth JWT, vérification par signature
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  // Idempotence — vérifier si l'événement a déjà été traité
  const alreadyProcessed = await prisma.auditLog.findFirst({
    where: { action: 'stripe_event', entityId: event.id },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // Événements non gérés — ignorer silencieusement
        break;
    }

    // Marquer l'événement comme traité
    await prisma.auditLog.create({
      data: {
        tenantId: (event.data.object as { metadata?: { tenantId?: string } }).metadata?.tenantId ?? 'stripe',
        action: 'stripe_event',
        entity: event.type,
        entityId: event.id,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!metadata?.tenantId) throw new Error('Missing tenantId in metadata');

  const tenant = await prisma.tenant.findUnique({
    where: { id: metadata.tenantId },
    include: { siteConfig: false },
  });
  if (!tenant) throw new Error(`Tenant ${metadata.tenantId} not found`);

  const items = JSON.parse(metadata.items) as Array<{ productId: string; quantity: number }>;

  // Upsert customer
  const customer = await prisma.customer.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: metadata.customerEmail } },
    update: {
      firstName: metadata.customerFirstName,
      lastName: metadata.customerLastName,
      phone: metadata.customerPhone || null,
    },
    create: {
      tenantId: tenant.id,
      email: metadata.customerEmail,
      firstName: metadata.customerFirstName,
      lastName: metadata.customerLastName,
      phone: metadata.customerPhone || null,
      locale: metadata.locale ?? 'fr',
      gdprConsent: true,
      gdprConsentAt: new Date(),
    },
  });

  // Récupérer les produits
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: tenant.id },
  });

  // Calculer les totaux
  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;

  const orderItemsData = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const vatFactor = product.vatRate === VatRate.FOOD_6 ? 1.06 : 1.21;
    const unitPriceTTC = Number(product.priceTTC);
    const unitPriceHT = unitPriceTTC / vatFactor;
    const lineTTC = unitPriceTTC * item.quantity;
    const lineHT = unitPriceHT * item.quantity;
    const lineTVA = lineTTC - lineHT;

    totalHT += lineHT;
    totalTVA += lineTVA;
    totalTTC += lineTTC;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: unitPriceTTC,
      vatRate: product.vatRate,
      totalHT: Math.round(lineHT * 100) / 100,
      totalTTC: Math.round(lineTTC * 100) / 100,
    };
  });

  const orderNumber = await generateOrderNumber(tenant.id);
  const pickupDate = new Date(metadata.pickupDate);
  const pickupStart = new Date(`${metadata.pickupDate}T${metadata.pickupStartTime}:00`);
  const pickupEnd = new Date(`${metadata.pickupDate}T${metadata.pickupEndTime}:00`);

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      orderNumber,
      customerId: customer.id,
      totalHT: Math.round(totalHT * 100) / 100,
      totalTVA: Math.round(totalTVA * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
      pickupDate,
      pickupSlotStart: pickupStart,
      pickupSlotEnd: pickupEnd,
      stripeSessionId: session.id,
      stripePaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      paidAt: new Date(),
      cgvAcceptedAt: new Date(),
      notes: metadata.notes || null,
      statusHistory: [{ status: 'NEW', timestamp: new Date().toISOString() }],
      items: { create: orderItemsData },
    },
    include: { items: { include: { product: true } } },
  });

  // Email de confirmation au client
  await sendOrderConfirmationEmail({
    to: customer.email,
    firstName: customer.firstName,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
    totalTTC: Number(order.totalTTC),
    pickupDate: format(pickupDate, 'EEEE d MMMM yyyy', { locale: fr }),
    pickupSlot: `${metadata.pickupStartTime} – ${metadata.pickupEndTime}`,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
  }).catch((err: unknown) => {
    console.error('[Stripe Webhook] Email error:', err);
  });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Logger uniquement — pas de commande créée
  console.warn('[Stripe Webhook] Payment failed:', paymentIntent.id);
}
