import { prisma } from './prisma';
import { convertToBase } from './constants/units';
import type { UnitOfMeasure } from '@prisma/client';

// ─── Calcul du coût d'une recette ───────────────────────────────────────────

interface RecipeIngredientWithPrice {
  ingredientId: string;
  quantity: number;
  unit: UnitOfMeasure;
  ingredient: {
    priceUnit: number; // Prix par unité de base
    unit: UnitOfMeasure;
  };
}

export function calculateRecipeCost(
  ingredients: RecipeIngredientWithPrice[],
  servings: number
): { totalCost: number; costPerServing: number } {
  let totalCost = 0;

  for (const ri of ingredients) {
    // Convertir la quantité utilisée en unité de base
    const quantityInBase = convertToBase(ri.quantity, ri.unit);
    // Coût = quantité (en unité de base) × prix unitaire
    const lineCost = quantityInBase * Number(ri.ingredient.priceUnit);
    totalCost += lineCost;
  }

  const costPerServing = servings > 0 ? totalCost / servings : totalCost;

  return {
    totalCost: Math.round(totalCost * 10000) / 10000,
    costPerServing: Math.round(costPerServing * 10000) / 10000,
  };
}

// ─── Recalcul en cascade (quand un prix d'ingrédient change) ────────────────

export async function recalculateRecipesCascade(
  tenantId: string,
  ingredientId: string
): Promise<void> {
  // Trouver toutes les recettes qui utilisent cet ingrédient
  const affectedRecipes = await prisma.recipe.findMany({
    where: {
      tenantId,
      isActive: true,
      ingredients: { some: { ingredientId } },
    },
    include: {
      ingredients: {
        include: { ingredient: true },
      },
    },
  });

  for (const recipe of affectedRecipes) {
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

    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { totalCost, costPerServing },
    });
  }
}

// ─── Calcul TVA belge ───────────────────────────────────────────────────────

const VAT_RATES = {
  FOOD_6: 0.06,
  STANDARD_21: 0.21,
};

export function calculatePriceTTC(priceHT: number, vatRate: keyof typeof VAT_RATES): number {
  const rate = VAT_RATES[vatRate];
  return Math.round(priceHT * (1 + rate) * 100) / 100;
}

export function calculatePriceHT(priceTTC: number, vatRate: keyof typeof VAT_RATES): number {
  const rate = VAT_RATES[vatRate];
  return Math.round((priceTTC / (1 + rate)) * 100) / 100;
}

export function calculateVatAmount(priceHT: number, vatRate: keyof typeof VAT_RATES): number {
  return Math.round(priceHT * VAT_RATES[vatRate] * 100) / 100;
}

// ─── Génération numéro de commande / facture ────────────────────────────────

export async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({
    where: { tenantId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  return `CMD-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { tenantId, issuedAt: { gte: new Date(`${year}-01-01`) } },
  });
  return `FACT-${year}-${String(count + 1).padStart(4, '0')}`;
}
