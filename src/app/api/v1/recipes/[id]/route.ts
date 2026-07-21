import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiNoContent, apiError } from '@/lib/permissions';
import { recipeUpdateSchema } from '@/lib/validators/recipe';
import { calculateRecipeCost } from '@/lib/costs';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'recipes.read', async (ctx) => {
    const recipe = await prisma.recipe.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        ingredients: {
          include: { ingredient: true },
        },
        product: { select: { id: true, name: true, slug: true, priceHT: true, priceTTC: true } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });

    if (!recipe) return apiError('NOT_FOUND', 'Recette introuvable', 404);
    return apiSuccess(recipe);
  });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'recipes.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = recipeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.recipe.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!existing) return apiError('NOT_FOUND', 'Recette introuvable', 404);

    // Snapshot de la version actuelle avant modification
    await prisma.recipeVersion.create({
      data: {
        recipeId: existing.id,
        version: existing.version,
        name: existing.name,
        ingredients: existing.ingredients.map((ri) => ({
          ingredientId: ri.ingredientId,
          name: ri.ingredient.name,
          quantity: Number(ri.quantity),
          unit: ri.unit,
          priceAtTime: Number(ri.ingredient.priceUnit),
        })),
        steps: existing.steps as object,
        servings: existing.servings,
        totalCost: existing.totalCost ? Number(existing.totalCost) : null,
        costPerServing: existing.costPerServing ? Number(existing.costPerServing) : null,
        createdById: ctx.userId,
      },
    });

    const { ingredients, ...recipeData } = parsed.data;

    let totalCost = existing.totalCost ? Number(existing.totalCost) : null;
    let costPerServing = existing.costPerServing ? Number(existing.costPerServing) : null;

    // Recalcul si les ingrédients ou les portions changent
    if (ingredients !== undefined || recipeData.servings !== undefined) {
      const ingredientsList = ingredients ?? existing.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        quantity: Number(ri.quantity),
        unit: ri.unit,
      }));

      const ingredientIds = ingredientsList.map((i) => i.ingredientId);
      const foundIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId: ctx.tenantId },
      });

      const costs = calculateRecipeCost(
        ingredientsList.map((ri) => ({
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
          ingredient: {
            priceUnit: Number(foundIngredients.find((i) => i.id === ri.ingredientId)!.priceUnit),
            unit: foundIngredients.find((i) => i.id === ri.ingredientId)!.unit,
          },
        })),
        recipeData.servings ?? existing.servings
      );

      totalCost = costs.totalCost;
      costPerServing = costs.costPerServing;
    }

    const recipe = await prisma.$transaction(async (tx) => {
      if (ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: params.id } });
        await tx.recipeIngredient.createMany({
          data: ingredients.map((i) => ({
            recipeId: params.id,
            ingredientId: i.ingredientId,
            quantity: i.quantity,
            unit: i.unit,
          })),
        });
      }

      return tx.recipe.update({
        where: { id: params.id },
        data: {
          ...recipeData,
          ...(totalCost !== null ? { totalCost } : {}),
          ...(costPerServing !== null ? { costPerServing } : {}),
          version: { increment: 1 },
        },
        include: { ingredients: { include: { ingredient: true } } },
      });
    });

    return apiSuccess(recipe);
  });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'recipes.delete', async (ctx) => {
    const existing = await prisma.recipe.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: { product: { select: { id: true, isActive: true } } },
    });
    if (!existing) return apiError('NOT_FOUND', 'Recette introuvable', 404);

    if (existing.product?.isActive) {
      return apiError('CONSTRAINT', 'Cette recette est liée à un produit actif. Désactivez le produit d\'abord.', 409);
    }

    await prisma.recipe.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return apiNoContent();
  });
}
