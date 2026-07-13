import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withPermission(request, 'orders.read', async (ctx) => {
    const order = await prisma.order.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: { select: { id: true, invoiceNumber: true, pdfUrl: true, status: true } },
      },
    });

    if (!order) return apiError('NOT_FOUND', 'Commande introuvable', 404);
    return apiSuccess(order);
  });
}
