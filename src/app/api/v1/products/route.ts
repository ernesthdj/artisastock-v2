import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { productCreateSchema } from '@/lib/validators/product';
import { calculatePriceTTC } from '@/lib/costs';
import { generateSlug } from '@/lib/utils/slug';
import { checkAvailability } from '@/lib/bom/fifo';

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
          channelStock: { where: { qtyRemaining: { gt: 0 } }, select: { id: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { [sortBy]: sortOrder }],
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    // hasRemainingStock (UC10) : conditionne l'affichage du bouton "Clôturer la journée"
    // dans l'admin — un produit sans stock restant n'a rien à clôturer.
    const withClosureFlag = data.map(({ channelStock, ...p }) => ({
      ...p,
      hasRemainingStock: channelStock.length > 0,
    }));

    return apiPaginated(withClosureFlag, page, pageSize, total);
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

    // UC2 (révisé — vente à la demande POS, docs/modules/POS.md §0) : publier un produit
    // n'exige plus un stock produit pré-existant, seulement que la fiche soit productible
    // dès maintenant depuis le stock d'ingrédients réel — jamais depuis une fiche impossible
    // à produire. La Boutique Web (VITRINE) exige toujours une vraie allocation après coup.
    const availability = await checkAvailability(parsed.data.bomSheetId, 1, prisma);
    if (!availability.allSufficient) {
      return apiError(
        'NO_STOCK',
        `La fiche "${bomSheet.name}" n'est pas productible avec le stock d'ingrédients actuel — réapprovisionnez avant de publier ce produit`,
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
