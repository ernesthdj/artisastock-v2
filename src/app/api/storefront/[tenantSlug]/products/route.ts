import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, apiPaginated, parsePagination } from '@/lib/permissions';

// Route publique — pas d'auth requise
export async function GET(request: NextRequest, props: { params: Promise<{ tenantSlug: string }> }) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const sp = request.nextUrl.searchParams;
  const { page, pageSize, skip } = parsePagination(sp);

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    isActive: true,
    isVisible: true,
    isClickCollect: true,
    deletedAt: null,
  };

  if (sp.get('category')) where['category'] = sp.get('category');
  if (sp.get('search')) where['name'] = { contains: sp.get('search'), mode: 'insensitive' };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true, name: true, slug: true, description: true,
        category: true, images: true, priceHT: true, priceTTC: true,
        vatRate: true, allergens: true, stockType: true, stockQuantity: true, sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return apiPaginated(data, page, pageSize, total);
}
