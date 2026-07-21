import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Route publique — suivi de commande par token
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ tenantSlug: string; trackingToken: string }> }
) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true, name: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const order = await prisma.order.findFirst({
    where: {
      tenantId: tenant.id,
      trackingToken: params.trackingToken,
    },
    select: {
      orderNumber: true,
      status: true,
      totalTTC: true,
      pickupDate: true,
      pickupSlotStart: true,
      pickupSlotEnd: true,
      paidAt: true,
      statusHistory: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          totalTTC: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  if (!order) return apiError('NOT_FOUND', 'Commande introuvable', 404);

  return apiSuccess({
    orderNumber: order.orderNumber,
    status: order.status,
    totalTTC: Number(order.totalTTC),
    pickupDate: order.pickupDate ? format(order.pickupDate, 'EEEE d MMMM yyyy', { locale: fr }) : null,
    pickupSlot: order.pickupSlotStart
      ? `${format(order.pickupSlotStart, 'HH:mm')} – ${format(order.pickupSlotEnd!, 'HH:mm')}`
      : null,
    paidAt: order.paidAt,
    statusHistory: order.statusHistory,
    items: order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalTTC: Number(i.totalTTC),
    })),
    tenantName: tenant.name,
  });
}
