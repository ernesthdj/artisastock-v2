import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { calculateRecipeCost, calculatePriceTTC, recipeVatRateToPercent } from '@/lib/costs';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'recipes.read', async (ctx) => {
    const recipe = await prisma.recipe.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        ingredients: {
          include: { ingredient: true },
        },
      },
    });

    if (!recipe) return apiError('NOT_FOUND', 'Recette introuvable', 404);

    const { totalCost, costPerServing } = calculateRecipeCost(
      recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        quantity: Number(ri.quantity),
        unit: ri.unit,
        ingredient: {
          priceUnit: Number(ri.ingredient.priceUnit),
          unit: ri.ingredient.unit,
        },
      })),
      recipe.servings
    );

    const marginCoeff = Number(recipe.marginCoeff);
    const suggestedPriceHT = Math.round(costPerServing * marginCoeff * 100) / 100;
    const suggestedPriceTTC = calculatePriceTTC(suggestedPriceHT, recipeVatRateToPercent(recipe.vatRate));

    const lines = recipe.ingredients.map((ri) => {
      const qty = Number(ri.quantity);
      const price = Number(ri.ingredient.priceUnit);
      const lineCost = qty * price;
      return {
        ingredientId: ri.ingredientId,
        name: ri.ingredient.name,
        quantity: qty,
        unit: ri.unit,
        priceUnit: price,
        lineCost: Math.round(lineCost * 10000) / 10000,
        percentageOfTotal: totalCost > 0 ? Math.round((lineCost / totalCost) * 100 * 10) / 10 : 0,
      };
    });

    return apiSuccess({
      recipeId: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      totalCost,
      costPerServing,
      marginCoeff,
      suggestedPriceHT,
      suggestedPriceTTC,
      vatRate: recipe.vatRate,
      lines,
    });
  });
}
