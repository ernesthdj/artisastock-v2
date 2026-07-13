import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiNoContent, apiError } from '@/lib/permissions';
import { ingredientUpdateSchema } from '@/lib/validators/ingredient';
import { recalculateRecipesCascade } from '@/lib/costs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withPermission(request, 'ingredients.read', async (ctx) => {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: { supplier: { select: { id: true, name: true } } },
    });

    if (!ingredient) return apiError('NOT_FOUND', 'Ingrédient introuvable', 404);
    return apiSuccess(ingredient);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withPermission(request, 'ingredients.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = ingredientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!existing) return apiError('NOT_FOUND', 'Ingrédient introuvable', 404);

    const ingredient = await prisma.ingredient.update({
      where: { id: params.id },
      data: parsed.data,
      include: { supplier: { select: { id: true, name: true } } },
    });

    // Recalcul en cascade si le prix unitaire a changé
    if (parsed.data.priceUnit !== undefined) {
      await recalculateRecipesCascade(ctx.tenantId, params.id);
    }

    return apiSuccess(ingredient);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withPermission(request, 'ingredients.delete', async (ctx) => {
    const existing = await prisma.ingredient.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!existing) return apiError('NOT_FOUND', 'Ingrédient introuvable', 404);

    // Vérifier qu'aucune recette active n'utilise cet ingrédient
    const usedInRecipe = await prisma.recipeIngredient.findFirst({
      where: { ingredientId: params.id },
    });
    if (usedInRecipe) {
      return apiError(
        'CONSTRAINT',
        'Cet ingrédient est utilisé dans une ou plusieurs recettes. Retirez-le d\'abord des recettes.',
        409
      );
    }

    // Soft delete
    await prisma.ingredient.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return apiNoContent();
  });
}
