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

    const bomSheet = await prisma.bomSheet.findUnique({
      where: { id: parsed.data.bomSheetId },
      include: { level: { select: { context: { select: { tenantId: true } } } } },
    });
    if (!bomSheet || bomSheet.level.context.tenantId !== ctx.tenantId) {
      return apiError('NOT_FOUND', 'Fiche BOM introuvable', 404);
    }

    // UC2 : publier un produit exige un stock de départ réel — jamais depuis une fiche à sec.
    const stockAgg = await prisma.bomStock.aggregate({
      where: { tenantId: ctx.tenantId, sheetId: parsed.data.bomSheetId, qtyAvailable: { gt: 0 } },
      _sum: { qtyAvailable: true },
    });
    if (Number(stockAgg._sum.qtyAvailable ?? 0) <= 0) {
      return apiError(
        'NO_STOCK',
        `Aucun stock disponible pour la fiche "${bomSheet.name}" — produisez-la d'abord via le module BOM avant de publier ce produit`,
        400
      );
    }

    const priceTTC = calculatePriceTTC(parsed.data.priceHT, Number(vatRate.ratePercent));

    const existing = await prisma.product.findUnique({
      where: { tenantId_slug: { tenantId: ctx.tenantId, slug } },
    });
    if (existing) return apiError('CONFLICT', `Un produit avec le slug "${slug}" existe déjà`, 409);

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
