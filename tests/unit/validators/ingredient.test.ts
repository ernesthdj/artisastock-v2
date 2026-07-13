import { describe, it, expect } from 'vitest';
import {
  ingredientCreateSchema,
  ingredientUpdateSchema,
  stockUpdateSchema,
} from '@/lib/validators/ingredient';

// ─── ingredientCreateSchema ──────────────────────────────────────────────────

describe('ingredientCreateSchema', () => {
  const validPayload = {
    name: 'Farine T55',
    unit: 'KG' as const,
    priceUnit: 1.2,
    stock: 10,
    alertThreshold: 2,
  };

  it('should_accept_minimal_valid_ingredient', () => {
    expect(() => ingredientCreateSchema.parse(validPayload)).not.toThrow();
  });

  it('should_accept_full_ingredient_with_all_fields', () => {
    const full = {
      ...validPayload,
      category: 'Farines',
      pricePack: 5.5,
      packSize: 5,
      isAlertActive: true,
      supplierId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      supplierRef: 'REF-001',
      notes: 'Stocker au sec',
    };
    expect(() => ingredientCreateSchema.parse(full)).not.toThrow();
  });

  it('should_reject_empty_name', () => {
    expect(() => ingredientCreateSchema.parse({ ...validPayload, name: '' })).toThrow();
  });

  it('should_reject_negative_priceUnit', () => {
    expect(() => ingredientCreateSchema.parse({ ...validPayload, priceUnit: -1 })).toThrow();
  });

  it('should_reject_zero_priceUnit', () => {
    expect(() => ingredientCreateSchema.parse({ ...validPayload, priceUnit: 0 })).toThrow();
  });

  it('should_reject_negative_stock', () => {
    expect(() => ingredientCreateSchema.parse({ ...validPayload, stock: -1 })).toThrow();
  });

  it('should_reject_invalid_unit', () => {
    expect(() =>
      ingredientCreateSchema.parse({ ...validPayload, unit: 'INVALID_UNIT' })
    ).toThrow();
  });

  it('should_accept_all_valid_units', () => {
    const units = ['KG', 'G', 'L', 'ML', 'PIECE', 'DOZEN'] as const;
    for (const unit of units) {
      expect(() => ingredientCreateSchema.parse({ ...validPayload, unit })).not.toThrow();
    }
  });

  it('should_default_stock_to_0_when_not_provided', () => {
    const { stock: _, ...withoutStock } = validPayload;
    const result = ingredientCreateSchema.parse(withoutStock);
    expect(result.stock).toBe(0);
  });

  it('should_default_alertThreshold_to_0', () => {
    const { alertThreshold: _, ...withoutThreshold } = validPayload;
    const result = ingredientCreateSchema.parse(withoutThreshold);
    expect(result.alertThreshold).toBe(0);
  });

  it('should_default_isAlertActive_to_true', () => {
    const result = ingredientCreateSchema.parse(validPayload);
    expect(result.isAlertActive).toBe(true);
  });

  it('should_reject_name_longer_than_200_chars', () => {
    expect(() =>
      ingredientCreateSchema.parse({ ...validPayload, name: 'a'.repeat(201) })
    ).toThrow();
  });

  it('should_reject_notes_longer_than_1000_chars', () => {
    expect(() =>
      ingredientCreateSchema.parse({ ...validPayload, notes: 'a'.repeat(1001) })
    ).toThrow();
  });
});

// ─── ingredientUpdateSchema ──────────────────────────────────────────────────

describe('ingredientUpdateSchema', () => {
  it('should_accept_empty_object_as_partial_update', () => {
    expect(() => ingredientUpdateSchema.parse({})).not.toThrow();
  });

  it('should_accept_partial_update_with_only_priceUnit', () => {
    expect(() => ingredientUpdateSchema.parse({ priceUnit: 2.5 })).not.toThrow();
  });

  it('should_still_reject_invalid_fields', () => {
    expect(() => ingredientUpdateSchema.parse({ priceUnit: -5 })).toThrow();
  });
});

// ─── stockUpdateSchema ───────────────────────────────────────────────────────

describe('stockUpdateSchema', () => {
  it('should_accept_valid_stock_update', () => {
    expect(() => stockUpdateSchema.parse({ stock: 15 })).not.toThrow();
  });

  it('should_accept_zero_stock', () => {
    expect(() => stockUpdateSchema.parse({ stock: 0 })).not.toThrow();
  });

  it('should_reject_negative_stock', () => {
    expect(() => stockUpdateSchema.parse({ stock: -1 })).toThrow();
  });

  it('should_accept_optional_reason', () => {
    expect(() =>
      stockUpdateSchema.parse({ stock: 5, reason: 'Inventaire mensuel' })
    ).not.toThrow();
  });

  it('should_reject_reason_longer_than_500_chars', () => {
    expect(() =>
      stockUpdateSchema.parse({ stock: 5, reason: 'a'.repeat(501) })
    ).toThrow();
  });
});
