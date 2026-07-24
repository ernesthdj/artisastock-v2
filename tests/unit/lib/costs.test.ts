import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateRecipeCost,
  calculatePriceTTC,
  calculatePriceHT,
  calculateVatAmount,
  generateOrderNumber,
  generateInvoiceNumber,
} from '@/lib/costs';
import { prisma } from '@/lib/prisma';

// ─── calculateRecipeCost ─────────────────────────────────────────────────────

describe('calculateRecipeCost', () => {
  it('should_return_zero_cost_when_no_ingredients', () => {
    const result = calculateRecipeCost([], 10);
    expect(result.totalCost).toBe(0);
    expect(result.costPerServing).toBe(0);
  });

  it('should_calculate_cost_with_same_unit_as_ingredient', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 2,
        unit: 'KG' as const,
        ingredient: { priceUnit: 5, unit: 'KG' as const },
      },
    ];
    // 2 KG × 1 (factor KG→KG) × 5 €/kg = 10 €
    const result = calculateRecipeCost(ingredients, 4);
    expect(result.totalCost).toBe(10);
    expect(result.costPerServing).toBe(2.5);
  });

  it('should_convert_grams_to_kg_for_cost_calculation', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 500, // 500g = 0.5 kg
        unit: 'G' as const,
        ingredient: { priceUnit: 8, unit: 'KG' as const },
      },
    ];
    // 500 × 0.001 × 8 = 4 €
    const result = calculateRecipeCost(ingredients, 1);
    expect(result.totalCost).toBe(4);
  });

  it('should_convert_dozens_to_pieces_for_cost_calculation', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 2, // 2 douzaines = 24 pièces
        unit: 'DOZEN' as const,
        ingredient: { priceUnit: 0.5, unit: 'PIECE' as const },
      },
    ];
    // 2 × 12 × 0.5 = 12 €
    const result = calculateRecipeCost(ingredients, 6);
    expect(result.totalCost).toBe(12);
    expect(result.costPerServing).toBe(2);
  });

  it('should_convert_milliliters_to_liters_for_cost_calculation', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 250, // 250 mL = 0.25 L
        unit: 'ML' as const,
        ingredient: { priceUnit: 2, unit: 'L' as const },
      },
    ];
    // 250 × 0.001 × 2 = 0.5 €
    const result = calculateRecipeCost(ingredients, 1);
    expect(result.totalCost).toBe(0.5);
  });

  it('should_sum_cost_of_multiple_ingredients', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 1,
        unit: 'KG' as const,
        ingredient: { priceUnit: 3, unit: 'KG' as const },
      },
      {
        ingredientId: 'i2',
        quantity: 200,
        unit: 'G' as const,
        ingredient: { priceUnit: 10, unit: 'KG' as const },
      },
      {
        ingredientId: 'i3',
        quantity: 6,
        unit: 'PIECE' as const,
        ingredient: { priceUnit: 0.3, unit: 'PIECE' as const },
      },
    ];
    // 1 × 3 + 0.2 × 10 + 6 × 0.3 = 3 + 2 + 1.8 = 6.8
    const result = calculateRecipeCost(ingredients, 4);
    expect(result.totalCost).toBe(6.8);
    expect(result.costPerServing).toBe(1.7);
  });

  it('should_return_totalCost_as_costPerServing_when_servings_is_zero', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 1,
        unit: 'KG' as const,
        ingredient: { priceUnit: 5, unit: 'KG' as const },
      },
    ];
    const result = calculateRecipeCost(ingredients, 0);
    expect(result.costPerServing).toBe(result.totalCost);
  });

  it('should_round_result_to_4_decimal_places', () => {
    const ingredients = [
      {
        ingredientId: 'i1',
        quantity: 1,
        unit: 'G' as const,
        ingredient: { priceUnit: 3.333, unit: 'KG' as const },
      },
    ];
    // 0.001 × 3.333 = 0.003333
    const result = calculateRecipeCost(ingredients, 1);
    expect(result.totalCost).toBe(0.0033);
  });
});

// ─── calculatePriceTTC ───────────────────────────────────────────────────────

describe('calculatePriceTTC', () => {
  it('should_apply_6_percent_vat_for_rate_6', () => {
    expect(calculatePriceTTC(10, 6)).toBe(10.6);
  });

  it('should_apply_21_percent_vat_for_rate_21', () => {
    expect(calculatePriceTTC(10, 21)).toBe(12.1);
  });

  it('should_round_to_2_decimal_places', () => {
    // 3.33 × 1.06 = 3.5298 → 3.53
    expect(calculatePriceTTC(3.33, 6)).toBe(3.53);
  });

  it('should_return_zero_for_zero_price', () => {
    expect(calculatePriceTTC(0, 6)).toBe(0);
    expect(calculatePriceTTC(0, 21)).toBe(0);
  });
});

// ─── calculatePriceHT ───────────────────────────────────────────────────────

describe('calculatePriceHT', () => {
  it('should_reverse_6_percent_vat_for_rate_6', () => {
    // 10.6 / 1.06 = 10
    expect(calculatePriceHT(10.6, 6)).toBe(10);
  });

  it('should_reverse_21_percent_vat_for_rate_21', () => {
    // 12.1 / 1.21 = 10
    expect(calculatePriceHT(12.1, 21)).toBe(10);
  });

  it('should_be_inverse_of_calculatePriceTTC', () => {
    const priceHT = 8.5;
    const priceTTC = calculatePriceTTC(priceHT, 21);
    expect(calculatePriceHT(priceTTC, 21)).toBe(priceHT);
  });
});

// ─── calculateVatAmount ──────────────────────────────────────────────────────

describe('calculateVatAmount', () => {
  it('should_calculate_6_percent_vat_amount', () => {
    expect(calculateVatAmount(100, 6)).toBe(6);
  });

  it('should_calculate_21_percent_vat_amount', () => {
    expect(calculateVatAmount(100, 21)).toBe(21);
  });

  it('should_round_to_2_decimal_places', () => {
    // 3.33 × 0.21 = 0.6993 → 0.70
    expect(calculateVatAmount(3.33, 21)).toBe(0.7);
  });

  it('should_return_zero_for_zero_base', () => {
    expect(calculateVatAmount(0, 6)).toBe(0);
  });
});

// ─── generateOrderNumber ─────────────────────────────────────────────────────

describe('generateOrderNumber', () => {
  beforeEach(() => {
    vi.mocked(prisma.order.count).mockResolvedValue(0);
  });

  it('should_generate_first_order_number_of_year', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    const year = new Date().getFullYear();
    const result = await generateOrderNumber('tenant-1');
    expect(result).toBe(`CMD-${year}-0001`);
  });

  it('should_pad_order_number_to_4_digits', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(9);
    const year = new Date().getFullYear();
    const result = await generateOrderNumber('tenant-1');
    expect(result).toBe(`CMD-${year}-0010`);
  });

  it('should_include_tenant_id_in_count_query', async () => {
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    await generateOrderNumber('my-tenant');
    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'my-tenant' }) })
    );
  });
});

// ─── generateInvoiceNumber ───────────────────────────────────────────────────

describe('generateInvoiceNumber', () => {
  it('should_generate_invoice_number_with_FACT_prefix', async () => {
    vi.mocked(prisma.invoice?.count ?? vi.fn()).mockResolvedValue(2);
    const year = new Date().getFullYear();
    const result = await generateInvoiceNumber('tenant-1');
    expect(result).toMatch(new RegExp(`^FACT-${year}-\\d{4}$`));
  });
});
