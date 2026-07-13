import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiNoContent, apiError } from '@/lib/permissions';
import { productUpdateSchema } from '@/lib/validators/product';
import { calculatePriceTTC } from '@/lib/costs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withPermission(request, 'products.read', async (ctx) => {
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
    });

    if (!product) return apiError('NOT_FOUND', 'Produit introuvable', 404);
    return apiSuccess(product);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    if (parsed.data.priceHT !== undefined) {
      updateData['priceTTC'] = calculatePriceTTC(
        parsed.data.priceHT,
        parsed.data.vatRate ?? existing.vatRate
      );
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
      include: { recipe: { select: { id: true, name: true } } },
    });

    return apiSuccess(product);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
