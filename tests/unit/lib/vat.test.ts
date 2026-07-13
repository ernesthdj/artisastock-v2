import { describe, it, expect } from 'vitest';
import { buildVatBreakdown, vatRateToPercent } from '@/lib/utils/vat';

// ─── vatRateToPercent ────────────────────────────────────────────────────────

describe('vatRateToPercent', () => {
  it('should_return_6_percent_string_for_FOOD_6', () => {
    expect(vatRateToPercent('FOOD_6')).toBe('6%');
  });

  it('should_return_21_percent_string_for_STANDARD_21', () => {
    expect(vatRateToPercent('STANDARD_21')).toBe('21%');
  });
});

// ─── buildVatBreakdown ───────────────────────────────────────────────────────

describe('buildVatBreakdown', () => {
  it('should_return_empty_array_for_no_items', () => {
    expect(buildVatBreakdown([])).toEqual([]);
  });

  it('should_build_breakdown_for_single_vat_rate', () => {
    const items = [
      { totalHT: 10, vatRate: 'FOOD_6' as const },
      { totalHT: 5, vatRate: 'FOOD_6' as const },
    ];
    const result = buildVatBreakdown(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      rate: '6%',
      base: 15,
      amount: 0.9,
    });
  });

  it('should_build_separate_lines_for_each_vat_rate', () => {
    const items = [
      { totalHT: 100, vatRate: 'FOOD_6' as const },
      { totalHT: 50, vatRate: 'STANDARD_21' as const },
    ];
    const result = buildVatBreakdown(items);
    expect(result).toHaveLength(2);

    const food = result.find((l) => l.rate === '6%');
    const std = result.find((l) => l.rate === '21%');

    expect(food).toMatchObject({ base: 100, amount: 6 });
    expect(std).toMatchObject({ base: 50, amount: 10.5 });
  });

  it('should_accumulate_base_for_same_vat_rate', () => {
    const items = [
      { totalHT: 10.5, vatRate: 'STANDARD_21' as const },
      { totalHT: 9.5, vatRate: 'STANDARD_21' as const },
      { totalHT: 20, vatRate: 'STANDARD_21' as const },
    ];
    const result = buildVatBreakdown(items);
    expect(result).toHaveLength(1);
    expect(result[0].base).toBe(40);
    expect(result[0].amount).toBe(8.4);
  });

  it('should_round_base_and_amount_to_2_decimal_places', () => {
    const items = [
      { totalHT: 3.333, vatRate: 'FOOD_6' as const },
    ];
    const result = buildVatBreakdown(items);
    // base: Math.round(3.333 * 100) / 100 = 3.33
    // amount: Math.round(3.333 * 0.06 * 100) / 100 = Math.round(0.19998 * 100) / 100 = 0.2
    expect(result[0].base).toBe(3.33);
    expect(result[0].amount).toBe(0.2);
  });

  it('should_use_vatRateToPercent_for_rate_label', () => {
    const items = [{ totalHT: 10, vatRate: 'FOOD_6' as const }];
    const result = buildVatBreakdown(items);
    expect(result[0].rate).toBe('6%');
  });
});
