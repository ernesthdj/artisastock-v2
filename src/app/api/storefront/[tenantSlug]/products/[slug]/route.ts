import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';

// Route publique — pas d'auth requise
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ tenantSlug: string; slug: string }> }
) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const product = await prisma.product.findFirst({
    where: {
      tenantId: tenant.id,
      slug: params.slug,
      isActive: true,
      isVisible: true,
      isClickCollect: true,
      deletedAt: null,
    },
    select: {
      id: true, name: true, slug: true, description: true,
      category: true, images: true, priceHT: true, priceTTC: true,
      vatRate: true, allergens: true, stockType: true, stockQuantity: true,
    },
  });

  if (!product) return apiError('NOT_FOUND', 'Produit introuvable', 404);

  return apiSuccess(product);
}
