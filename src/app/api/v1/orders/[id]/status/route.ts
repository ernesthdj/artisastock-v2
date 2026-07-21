import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { orderStatusSchema } from '@/lib/validators/order';
import { isValidTransition } from '@/lib/constants/order-status';
import { sendOrderReadyEmail } from '@/lib/email';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'orders.manage', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = orderStatusSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const order = await prisma.order.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
      include: { customer: true, tenant: true },
    });
    if (!order) return apiError('NOT_FOUND', 'Commande introuvable', 404);

    if (!isValidTransition(order.status, parsed.data.status)) {
      return apiError(
        'INVALID_TRANSITION',
        `Impossible de passer de "${order.status}" à "${parsed.data.status}"`,
        400
      );
    }

    const statusHistory = [
      ...(order.statusHistory as object[]),
      { status: parsed.data.status, timestamp: new Date().toISOString(), userId: ctx.userId },
    ];

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: { status: parsed.data.status, statusHistory },
    });

    // Email automatique quand la commande est prête
    if (parsed.data.status === 'READY') {
      const address = order.tenant.address as Record<string, string> | null;
      const addressStr = address
        ? `${address['street']} ${address['number']}, ${address['zip']} ${address['city']}`
        : order.tenant.name;

      await sendOrderReadyEmail({
        to: order.customer.email,
        firstName: order.customer.firstName,
        orderNumber: order.orderNumber,
        tenantName: order.tenant.name,
        tenantAddress: addressStr,
      }).catch(() => {
        // Ne pas bloquer si l'email échoue
      });
    }

    return apiSuccess({ id: updated.id, status: updated.status, statusHistory: updated.statusHistory });
  });
}
