import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiError } from '@/lib/permissions';
import { generateInvoicePdf } from '@/lib/pdf';
import { buildVatBreakdown } from '@/lib/utils/vat';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'invoices.read', async (ctx) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    include: {
      order: {
        include: {
          customer: true,
          items: { include: { product: { select: { name: true } } } },
        },
      },
      tenant: { select: { name: true, email: true, phone: true, address: true, vatNumber: true } },
    },
  });

  if (!invoice) return apiError('NOT_FOUND', 'Facture introuvable', 404);

  const vatBreakdown = buildVatBreakdown(invoice.order.items.map((item) => ({
    totalHT: Number(item.totalHT),
    totalTTC: Number(item.totalTTC),
    vatRatePercent: Number(item.vatRatePercent),
  })));

  const pdfBuffer = await generateInvoicePdf({ invoice, vatBreakdown });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  });
}
