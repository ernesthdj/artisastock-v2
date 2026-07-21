import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx) => {
  const limit = Math.min(20, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '10', 10)));

  const orders = await prisma.order.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, orderNumber: true, status: true, totalTTC: true, createdAt: true, pickupDate: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
    },
  });

    return apiSuccess(orders);
  });
}
