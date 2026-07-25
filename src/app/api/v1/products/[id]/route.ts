import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiNoContent, apiError } from '@/lib/permissions';
import { productUpdateSchema } from '@/lib/validators/product';
import { calculatePriceTTC } from '@/lib/costs';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'products.read', async (ctx) => {
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        bomSheet: {
          include: {
            lines: { include: { ingredient: true, subSheet: true } },
            stocks: { where: { qtyAvailable: { gt: 0 } }, orderBy: { producedAt: 'asc' } },
          },
        },
        vatRate: { select: { id: true, label: true, ratePercent: true } },
        channelStock: true,
      },
    });

    if (!product) return apiError('NOT_FOUND', 'Produit introuvable', 404);
    return apiSuccess(product);
  });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'products.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.product.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!existing) return apiError('NOT_FOUND', 'Produit introuvable', 404);

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.priceHT !== undefined || parsed.data.vatRateId !== undefined) {
      const vatRateId = parsed.data.vatRateId ?? existing.vatRateId;
      const vatRate = await prisma.tenantVatRate.findFirst({
        where: { id: vatRateId, tenantId: ctx.tenantId },
      });
      if (!vatRate) return apiError('NOT_FOUND', 'Taux de TVA introuvable', 404);

      const priceHT = parsed.data.priceHT ?? Number(existing.priceHT);
      updateData['priceTTC'] = calculatePriceTTC(priceHT, Number(vatRate.ratePercent));
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
      include: {
        bomSheet: { select: { id: true, name: true } },
        vatRate: { select: { id: true, label: true, ratePercent: true } },
      },
    });

    return apiSuccess(product);
  });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'products.delete', async (ctx) => {
    const existing = await prisma.product.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!existing) return apiError('NOT_FOUND', 'Produit introuvable', 404);

    await prisma.product.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false, isVisible: false },
    });

    return apiNoContent();
  });
}
