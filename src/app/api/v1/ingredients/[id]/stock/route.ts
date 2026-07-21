import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { stockUpdateSchema } from '@/lib/validators/ingredient';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'ingredients.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = stockUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!existing) return apiError('NOT_FOUND', 'Ingrédient introuvable', 404);

    const ingredient = await prisma.ingredient.update({
      where: { id: params.id },
      data: { stock: parsed.data.stock },
    });

    return apiSuccess({ id: ingredient.id, stock: ingredient.stock });
  });
}
