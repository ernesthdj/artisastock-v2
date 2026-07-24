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

// ─── Calcul TVA ─────────────────────────────────────────────────────────────
// Taux exprimé en pourcentage (ex. 6 pour 6%), lu depuis TenantVatRate.ratePercent
// (bibliothèque configurable par tenant — voir docs/modules/BOUTIQUE-PRODUITS.md).
// Le modèle Recipe (legacy, non touché par le module Boutique/Produits) garde son
// enum VatRate figé — voir recipeVatRateToPercent() ci-dessous pour la conversion.

export function calculatePriceTTC(priceHT: number, ratePercent: number): number {
  return Math.round(priceHT * (1 + ratePercent / 100) * 100) / 100;
}

export function calculatePriceHT(priceTTC: number, ratePercent: number): number {
  return Math.round((priceTTC / (1 + ratePercent / 100)) * 100) / 100;
}

export function calculateVatAmount(priceHT: number, ratePercent: number): number {
  return Math.round(priceHT * (ratePercent / 100) * 100) / 100;
}

// ─── Indicateur de marge (confort, UC7) ─────────────────────────────────────
// Jamais utilisé pour préremplir le prix de vente — uniquement pour afficher
// à l'admin si son prix saisi manuellement respecte le facteur cible configuré.

export function calculateMarginRatio(priceHT: number, unitCost: number): number | null {
  if (unitCost <= 0) return null;
  return Math.round((priceHT / unitCost) * 100) / 100;
}

// ─── Conversion legacy Recipe.vatRate (enum figé) → pourcentage ────────────
// Recipe reste sur l'ancien enum VatRate — non migré par le module Boutique/Produits.

export function recipeVatRateToPercent(vatRate: 'FOOD_6' | 'STANDARD_21'): number {
  return vatRate === 'FOOD_6' ? 6 : 21;
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
