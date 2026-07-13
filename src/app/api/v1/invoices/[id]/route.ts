import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { buildVatBreakdown } from '@/lib/utils/vat';

export const GET = withPermission('invoices:read', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    include: {
      order: {
        include: {
          customer: true,
          items: { include: { product: { select: { name: true, vatRate: true } } } },
        },
      },
    },
  });

  if (!invoice) return apiError('NOT_FOUND', 'Facture introuvable', 404);

  const vatBreakdown = buildVatBreakdown(invoice.order.items.map((item) => ({
    totalHT: Number(item.totalHT),
    totalTTC: Number(item.totalTTC),
    vatRate: item.product.vatRate,
  })));

  return apiSuccess({ ...invoice, vatBreakdown });
});
