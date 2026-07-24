import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { productCreateSchema } from '@/lib/validators/product';
import { calculatePriceTTC } from '@/lib/costs';
import { generateSlug } from '@/lib/utils/slug';

export async function GET(request: NextRequest) {
  return withPermission(request, 'products.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId, isActive: true, deletedAt: null };
    if (sp.get('category')) where['category'] = sp.get('category');
    if (sp.get('isVisible')) where['isVisible'] = sp.get('isVisible') === 'true';
    if (sp.get('search')) where['name'] = { contains: sp.get('search'), mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          bomSheet: { select: { id: true, name: true } },
          vatRate: { select: { id: true, label: true, ratePercent: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { [sortBy]: sortOrder }],
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'products.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const slug = parsed.data.slug ?? generateSlug(parsed.data.name);

    const vatRate = await prisma.tenantVatRate.findFirst({
      where: { id: parsed.data.vatRateId, tenantId: ctx.tenantId },
    });
    if (!vatRate) return apiError('NOT_FOUND', 'Taux de TVA introuvable', 404);

    const priceTTC = calculatePriceTTC(parsed.data.priceHT, Number(vatRate.ratePercent));

    const existing = await prisma.product.findUnique({
      where: { tenantId_slug: { tenantId: ctx.tenantId, slug } },
    });
    if (existing) return apiError('CONFLICT', `Un produit avec le slug "${slug}" existe déjà`, 409);

    // NOTE endpoint de transition (étape 1) : la vérification de stock BomStock
    // disponible (UC1/UC2, docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md étape 3)
    // n'est pas encore branchée ici.
    const product = await prisma.product.create({
      data: { ...parsed.data, slug, priceTTC, tenantId: ctx.tenantId },
      include: {
        bomSheet: { select: { id: true, name: true } },
        vatRate: { select: { id: true, label: true, ratePercent: true } },
      },
    });

    return apiCreated(product);
  });
}
