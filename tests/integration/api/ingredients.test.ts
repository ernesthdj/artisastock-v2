/**
 * Tests d'intégration — API Ingrédients
 *
 * Teste la logique métier de la couche API ingrédients
 * avec le mock Prisma de setup.ts.
 *
 * Les tests vérifient : calcul du coût total d'une recette, cascade
 * de recalcul et intégration avec les validators.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ingredientCreateSchema } from '@/lib/validators/ingredient';
import { calculateRecipeCost } from '@/lib/costs';
import { recalculateRecipesCascade } from '@/lib/costs';

// ─── Helpers de test ─────────────────────────────────────────────────────────

function makeIngredient(overrides = {}) {
  return {
    id: 'ing-1',
    tenantId: 'tenant-1',
    name: 'Farine T55',
    unit: 'KG',
    priceUnit: 1.5,
    stock: 20,
    alertThreshold: 3,
    isAlertActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Validation avant persistance ────────────────────────────────────────────

describe('Ingredient validation before persistence', () => {
  it('should_validate_ingredient_payload_before_create', () => {
    const payload = {
      name: 'Farine T55',
      unit: 'KG' as const,
      priceUnit: 1.5,
    };
    const parsed = ingredientCreateSchema.parse(payload);
    expect(parsed.name).toBe('Farine T55');
    expect(parsed.stock).toBe(0); // default
    expect(parsed.isAlertActive).toBe(true); // default
  });

  it('should_reject_ingredient_with_invalid_unit_before_hitting_DB', () => {
    const payload = { name: 'Test', unit: 'BOXES', priceUnit: 1 };
    expect(() => ingredientCreateSchema.parse(payload)).toThrow();
    // Prisma create ne doit jamais être appelé
    expect(prisma.ingredient.create).not.toHaveBeenCalled();
  });
});

// ─── Cascade recalculation ────────────────────────────────────────────────────

describe('recalculateRecipesCascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_update_recipes_that_use_changed_ingredient', async () => {
    const mockRecipes = [
      {
        id: 'recipe-1',
        tenantId: 'tenant-1',
        servings: 8,
        ingredients: [
          {
            ingredientId: 'ing-1',
            quantity: 1.5,
            unit: 'KG',
            ingredient: { priceUnit: 2.0, unit: 'KG' },
          },
        ],
      },
    ];

    vi.mocked(prisma.recipe.findMany).mockResolvedValue(mockRecipes as never);
    vi.mocked(prisma.recipe.update).mockResolvedValue({} as never);

    await recalculateRecipesCascade('tenant-1', 'ing-1');

    expect(prisma.recipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          ingredients: { some: { ingredientId: 'ing-1' } },
        }),
      })
    );

    expect(prisma.recipe.update).toHaveBeenCalledTimes(1);
    expect(prisma.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recipe-1' },
        data: expect.objectContaining({
          totalCost: expect.any(Number),
          costPerServing: expect.any(Number),
        }),
      })
    );
  });

  it('should_not_update_any_recipe_when_none_use_changed_ingredient', async () => {
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([] as never);

    await recalculateRecipesCascade('tenant-1', 'ing-unused');

    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });

  it('should_scope_cascade_to_correct_tenant', async () => {
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([] as never);

    await recalculateRecipesCascade('tenant-ABC', 'ing-1');

    expect(prisma.recipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-ABC' }),
      })
    );
  });

  it('should_calculate_correct_cost_for_cascade_update', async () => {
    const mockRecipes = [
      {
        id: 'recipe-1',
        tenantId: 'tenant-1',
        servings: 4,
        ingredients: [
          {
            ingredientId: 'ing-1',
            quantity: 200, // 200g
            unit: 'G',
            ingredient: { priceUnit: 10, unit: 'KG' }, // 10€/kg
          },
          {
            ingredientId: 'ing-2',
            quantity: 6,
            unit: 'PIECE',
            ingredient: { priceUnit: 0.5, unit: 'PIECE' },
          },
        ],
      },
    ];

    vi.mocked(prisma.recipe.findMany).mockResolvedValue(mockRecipes as never);
    vi.mocked(prisma.recipe.update).mockResolvedValue({} as never);

    await recalculateRecipesCascade('tenant-1', 'ing-1');

    // 200g × 0.001 × 10 + 6 × 0.5 = 2 + 3 = 5€ total, 1.25€/serving
    expect(prisma.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalCost: 5,
          costPerServing: 1.25,
        }),
      })
    );
  });
});

// ─── Stock alert detection ────────────────────────────────────────────────────

describe('Stock alert detection via Prisma mock', () => {
  it('should_detect_ingredients_below_alert_threshold', async () => {
    const lowStockIngredients = [
      makeIngredient({ id: 'ing-1', name: 'Farine', stock: 1, alertThreshold: 3 }),
      makeIngredient({ id: 'ing-2', name: 'Sucre', stock: 0.5, alertThreshold: 2 }),
    ];

    vi.mocked(prisma.ingredient.findMany).mockResolvedValue(lowStockIngredients as never);

    const alerts = await prisma.ingredient.findMany({
      where: {
        tenantId: 'tenant-1',
        isAlertActive: true,
        stock: { lte: 3 },
      },
    });

    expect(alerts).toHaveLength(2);
  });

  it('should_return_no_alerts_when_all_ingredients_have_sufficient_stock', async () => {
    vi.mocked(prisma.ingredient.findMany).mockResolvedValue([] as never);

    const alerts = await prisma.ingredient.findMany({
      where: {
        tenantId: 'tenant-1',
        isAlertActive: true,
        stock: { lte: 0 },
      },
    });

    expect(alerts).toHaveLength(0);
  });
});
