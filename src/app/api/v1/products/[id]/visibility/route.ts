import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { productVisibilitySchema } from '@/lib/validators/product';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'products.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = productVisibilitySchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const existing = await prisma.product.findFirst({ where: { id: params.id, tenantId: ctx.tenantId } });
    if (!existing) return apiError('NOT_FOUND', 'Produit introuvable', 404);

    const product = await prisma.product.update({
      where: { id: params.id },
      data: { isVisible: parsed.data.isVisible },
      select: { id: true, isVisible: true },
    });

    return apiSuccess(product);
  });
}
