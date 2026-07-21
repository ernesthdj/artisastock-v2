import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError } from '@/lib/permissions';
import { calculateRecipeCost } from '@/lib/costs';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'recipes.write', async (ctx) => {
    const recipe = await prisma.recipe.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: { ingredients: true },
    });

    if (!recipe) return apiError('NOT_FOUND', 'Recette introuvable', 404);

    let baseName = `${recipe.name} (copie)`;
    const existing = await prisma.recipe.findFirst({ where: { tenantId: ctx.tenantId, name: baseName } });
    if (existing) baseName = `${baseName} ${Date.now()}`;

    const duplicated = await prisma.recipe.create({
      data: {
        tenantId: ctx.tenantId,
        name: baseName,
        description: recipe.description,
        category: recipe.category,
        imageUrl: recipe.imageUrl,
        servings: recipe.servings,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        steps: recipe.steps as object,
        marginCoeff: recipe.marginCoeff,
        vatRate: recipe.vatRate,
        ingredients: {
          create: recipe.ingredients.map((ing) => ({
            ingredientId: ing.ingredientId,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        },
      },
      include: { ingredients: { include: { ingredient: true } } },
    });

    // Recalculer le coût de la copie avec les prix actuels
    const ingredientsForCalc = duplicated.ingredients.map((ri) => ({
      ingredientId: ri.ingredientId,
      quantity: Number(ri.quantity),
      unit: ri.unit,
      ingredient: {
        priceUnit: Number(ri.ingredient.priceUnit),
        unit: ri.ingredient.unit,
      },
    }));
    const cost = calculateRecipeCost(ingredientsForCalc, duplicated.servings);
    const updated = await prisma.recipe.update({
      where: { id: duplicated.id },
      data: { totalCost: cost.totalCost, costPerServing: cost.costPerServing },
      include: { ingredients: { include: { ingredient: true } } },
    });

    return apiCreated(updated);
  });
}
