import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { recipeCreateSchema } from '@/lib/validators/recipe';
import { calculateRecipeCost } from '@/lib/costs';

export async function GET(request: NextRequest) {
  return withPermission(request, 'recipes.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId, isActive: true, deletedAt: null };
    if (sp.get('category')) where['category'] = sp.get('category');
    if (sp.get('search')) where['name'] = { contains: sp.get('search'), mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        include: {
          ingredients: {
            include: { ingredient: { select: { id: true, name: true, unit: true } } },
          },
          product: { select: { id: true, name: true, isVisible: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.recipe.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'recipes.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = recipeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.recipe.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    });
    if (existing) {
      return apiError('CONFLICT', `Une recette nommée "${parsed.data.name}" existe déjà`, 409);
    }

    // Vérifier que tous les ingrédients existent dans ce tenant
    const ingredientIds = parsed.data.ingredients.map((i) => i.ingredientId);
    const foundIngredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId: ctx.tenantId, isActive: true, deletedAt: null },
    });
    if (foundIngredients.length !== ingredientIds.length) {
      return apiError('NOT_FOUND', 'Un ou plusieurs ingrédients introuvables', 400);
    }

    // Pré-calcul du coût
    const { totalCost, costPerServing } = calculateRecipeCost(
      parsed.data.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        quantity: ri.quantity,
        unit: ri.unit,
        ingredient: {
          priceUnit: Number(foundIngredients.find((i) => i.id === ri.ingredientId)!.priceUnit),
          unit: foundIngredients.find((i) => i.id === ri.ingredientId)!.unit,
        },
      })),
      parsed.data.servings
    );

    const { ingredients, ...recipeData } = parsed.data;

    const recipe = await prisma.recipe.create({
      data: {
        ...recipeData,
        tenantId: ctx.tenantId,
        totalCost,
        costPerServing,
        ingredients: {
          create: ingredients.map((i) => ({
            ingredientId: i.ingredientId,
            quantity: i.quantity,
            unit: i.unit,
          })),
        },
      },
      include: {
        ingredients: {
          include: { ingredient: { select: { id: true, name: true, unit: true, priceUnit: true } } },
        },
      },
    });

    return apiCreated(recipe);
  });
}
