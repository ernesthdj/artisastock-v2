import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withPermission(request, 'orders.read', async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        pickupDate: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { pickupSlotStart: 'asc' },
    });

    return apiSuccess(orders);
  });
}
