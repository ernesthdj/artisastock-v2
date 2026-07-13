import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiError } from '@/lib/permissions';
import { generateInvoicePdf } from '@/lib/pdf';
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
      tenant: { select: { name: true, email: true, phone: true, address: true, vatNumber: true } },
    },
  });

  if (!invoice) return apiError('NOT_FOUND', 'Facture introuvable', 404);

  const vatBreakdown = buildVatBreakdown(invoice.order.items.map((item) => ({
    totalHT: Number(item.totalHT),
    totalTTC: Number(item.totalTTC),
    vatRate: item.product.vatRate,
  })));

  const pdfBuffer = await generateInvoicePdf({ invoice, vatBreakdown });

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.byteLength.toString(),
    },
  });
});
