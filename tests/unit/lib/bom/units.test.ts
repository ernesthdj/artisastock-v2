import { describe, it, expect } from 'vitest';
import { convert, compatibleUnits, formatQty } from '@/lib/bom/units';
import { UnitOfMeasure } from '@prisma/client';

describe('convert', () => {
  // ─── Masse ───────────────────────────────────────────────────────────────────

  it('should_convert_kg_to_g_correctly', () => {
    expect(convert(1, 'KG', 'G')).toBe(1000);
  });

  it('should_convert_g_to_kg_correctly', () => {
    expect(convert(500, 'G', 'KG')).toBe(0.5);
  });

  it('should_convert_mg_to_g_correctly', () => {
    expect(convert(1000, 'MG', 'G')).toBe(1);
  });

  it('should_convert_cg_to_g_correctly', () => {
    expect(convert(50, 'CG', 'G')).toBe(0.5);
  });

  it('should_convert_kg_to_mg_correctly', () => {
    expect(convert(1, 'KG', 'MG')).toBe(1_000_000);
  });

  // ─── Volume ──────────────────────────────────────────────────────────────────

  it('should_convert_l_to_ml_correctly', () => {
    expect(convert(1, 'L', 'ML')).toBe(1000);
  });

  it('should_convert_cl_to_ml_correctly', () => {
    expect(convert(10, 'CL', 'ML')).toBe(100);
  });

  it('should_convert_dl_to_l_correctly', () => {
    expect(convert(10, 'DL', 'L')).toBe(1);
  });

  it('should_convert_ml_to_cl_correctly', () => {
    expect(convert(100, 'ML', 'CL')).toBe(10);
  });

  // ─── Pièce ───────────────────────────────────────────────────────────────────

  it('should_convert_dozen_to_piece_correctly', () => {
    expect(convert(2, 'DOZEN', 'PIECE')).toBe(24);
  });

  it('should_convert_piece_to_dozen_correctly', () => {
    expect(convert(12, 'PIECE', 'DOZEN')).toBe(1);
  });

  // ─── Identité ────────────────────────────────────────────────────────────────

  it('should_return_same_value_when_from_equals_to', () => {
    expect(convert(42, 'G', 'G')).toBe(42);
    expect(convert(3.5, 'L', 'L')).toBe(3.5);
  });

  // ─── Incompatibilité inter-groupe ────────────────────────────────────────────

  it('should_throw_when_converting_mass_to_volume', () => {
    expect(() => convert(1, 'KG', 'L')).toThrow('Conversion impossible');
  });

  it('should_throw_when_converting_volume_to_piece', () => {
    expect(() => convert(1, 'ML', 'PIECE')).toThrow('Conversion impossible');
  });

  it('should_throw_when_converting_piece_to_mass', () => {
    expect(() => convert(1, 'PIECE', 'G')).toThrow('Conversion impossible');
  });
});

describe('compatibleUnits', () => {
  it('should_return_all_mass_units_for_kg', () => {
    const result = compatibleUnits('KG');
    expect(result).toContain('KG');
    expect(result).toContain('G');
    expect(result).toContain('MG');
    expect(result).toContain('CG');
    expect(result).not.toContain('L');
    expect(result).not.toContain('PIECE');
  });

  it('should_return_all_volume_units_for_ml', () => {
    const result = compatibleUnits('ML');
    expect(result).toContain('ML');
    expect(result).toContain('CL');
    expect(result).toContain('DL');
    expect(result).toContain('L');
    expect(result).not.toContain('G');
  });

  it('should_return_all_count_units_for_piece', () => {
    const result = compatibleUnits('PIECE');
    expect(result).toContain('PIECE');
    expect(result).toContain('DOZEN');
    expect(result).not.toContain('G');
  });
});

describe('formatQty', () => {
  it('should_format_grams_when_under_1kg', () => {
    expect(formatQty(500, 'G')).toBe('500 g');
  });

  it('should_format_as_kg_when_1000g_or_more', () => {
    expect(formatQty(1000, 'G')).toBe('1 kg');
    expect(formatQty(1500, 'G')).toBe('1.5 kg');
  });

  it('should_format_ml_when_under_10ml', () => {
    expect(formatQty(5, 'ML')).toBe('5 mL');
  });

  it('should_format_as_liters_when_1000ml_or_more', () => {
    expect(formatQty(1000, 'ML')).toBe('1 L');
  });

  it('should_format_pieces_correctly', () => {
    expect(formatQty(1, 'PIECE')).toBe('1 pcs');
    expect(formatQty(24, 'PIECE')).toBe('2 dz');
  });
});
