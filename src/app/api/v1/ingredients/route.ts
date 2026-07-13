import { NextRequest } from 'next/server';
import { prisma, getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { ingredientCreateSchema } from '@/lib/validators/ingredient';

export async function GET(request: NextRequest) {
  return withPermission(request, 'ingredients.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { isActive: true, deletedAt: null };
    if (sp.get('category')) where['category'] = sp.get('category');
    if (sp.get('supplierId')) where['supplierId'] = sp.get('supplierId');
    if (sp.get('search')) where['name'] = { contains: sp.get('search'), mode: 'insensitive' };
    if (sp.get('alertOnly') === 'true') where['AND'] = [
      { isAlertActive: true },
      { stock: { lte: prisma.ingredient.fields.alertThreshold } },
    ];

    const [data, total] = await Promise.all([
      db.ingredient.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      db.ingredient.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'ingredients.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = ingredientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.ingredient.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    });
    if (existing) {
      return apiError('CONFLICT', `Un ingrédient nommé "${parsed.data.name}" existe déjà`, 409);
    }

    const ingredient = await prisma.ingredient.create({
      data: { ...parsed.data, tenantId: ctx.tenantId },
      include: { supplier: { select: { id: true, name: true } } },
    });

    return apiCreated(ingredient);
  });
}
