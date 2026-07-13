import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError } from '@/lib/permissions';
import { calculateRecipeCost } from '@/lib/costs';
import { generateSlug } from '@/lib/utils/slug';

export const POST = withPermission('recipes:write', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    include: { ingredients: true },
  });

  if (!recipe) return apiError('NOT_FOUND', 'Recette introuvable', 404);

  const baseName = `${recipe.name} (copie)`;
  let slug = generateSlug(baseName);

  // Éviter doublon de slug
  const existing = await prisma.recipe.findFirst({ where: { tenantId: ctx.tenantId, slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const duplicated = await prisma.recipe.create({
    data: {
      tenantId: ctx.tenantId,
      name: baseName,
      slug,
      description: recipe.description,
      instructions: recipe.instructions as object,
      yield: recipe.yield,
      yieldUnit: recipe.yieldUnit,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      laborCostPerHour: recipe.laborCostPerHour,
      overheadPercent: recipe.overheadPercent,
      costHT: recipe.costHT,
      ingredients: {
        create: recipe.ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
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
  const cost = calculateRecipeCost(ingredientsForCalc, recipe.yield);
  const updated = await prisma.recipe.update({
    where: { id: duplicated.id },
    data: { costHT: cost.totalCost },
    include: { ingredients: { include: { ingredient: true } } },
  });

  return apiCreated(updated);
});
