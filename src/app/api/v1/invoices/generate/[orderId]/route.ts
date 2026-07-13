import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError } from '@/lib/permissions';
import { generateInvoiceNumber } from '@/lib/costs';
import { buildVatBreakdown } from '@/lib/utils/vat';
import { VatRate } from '@prisma/client';

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  return withPermission(request, 'invoices.generate', async (ctx) => {
    const order = await prisma.order.findFirst({
      where: { id: params.orderId, tenantId: ctx.tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: true,
        tenant: true,
      },
    });

    if (!order) return apiError('NOT_FOUND', 'Commande introuvable', 404);
    if (order.invoice) return apiError('CONFLICT', 'Une facture existe déjà pour cette commande', 409);
    if (order.status === 'CANCELLED') return apiError('INVALID_STATUS', 'Impossible de facturer une commande annulée', 400);

    const invoiceNumber = await generateInvoiceNumber(ctx.tenantId);
    const tenantAddress = order.tenant.address as Record<string, string> | null;

    const lines = order.items.map((item) => {
      const vatRateEnum = item.vatRate as VatRate;
      const unitPriceHT = Number(item.unitPrice) / (vatRateEnum === 'FOOD_6' ? 1.06 : 1.21);
      const totalHT = unitPriceHT * item.quantity;
      const totalTTC = Number(item.unitPrice) * item.quantity;
      return {
        description: item.product.name,
        quantity: item.quantity,
        unitPriceHT: Math.round(unitPriceHT * 100) / 100,
        vatRate: vatRateEnum === 'FOOD_6' ? '6%' : '21%',
        totalHT: Math.round(totalHT * 100) / 100,
        totalTTC: Math.round(totalTTC * 100) / 100,
      };
    });

    const vatBreakdown = buildVatBreakdown(
      order.items.map((item) => ({
        totalHT: Number(order.totalHT) * (Number(item.totalHT) / Number(order.totalTTC)),
        vatRate: item.vatRate as VatRate,
      }))
    );

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        orderId: order.id,
        invoiceNumber,
        status: 'ISSUED',
        sellerName: order.tenant.name,
        sellerAddress: tenantAddress ?? {},
        sellerVat: order.tenant.vatNumber ?? 'Non fourni',
        buyerName: `${order.customer.firstName} ${order.customer.lastName}`,
        buyerEmail: order.customer.email,
        totalHT: Number(order.totalHT),
        totalTVA: Number(order.totalTVA),
        totalTTC: Number(order.totalTTC),
        vatBreakdown,
        lines,
      },
    });

    return apiCreated(invoice);
  });
}
