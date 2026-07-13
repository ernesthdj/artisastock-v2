import { describe, it, expect } from 'vitest';
import { generateSlug, generateTenantSlug } from '@/lib/utils/slug';

// ─── generateSlug ─────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('should_lowercase_text', () => {
    expect(generateSlug('Boulangerie Dupont')).toBe('boulangerie-dupont');
  });

  it('should_replace_spaces_with_hyphens', () => {
    expect(generateSlug('pain au chocolat')).toBe('pain-au-chocolat');
  });

  it('should_remove_accents_and_special_chars', () => {
    // slugify with locale fr handles accents
    const result = generateSlug('crème brûlée');
    expect(result).not.toContain('è');
    expect(result).not.toContain('û');
    expect(result).not.toContain('é');
  });

  it('should_not_start_or_end_with_hyphen', () => {
    const result = generateSlug(' test ');
    expect(result).not.toMatch(/^-/);
    expect(result).not.toMatch(/-$/);
  });

  it('should_handle_copie_suffix', () => {
    // Used in duplicate route
    const result = generateSlug('Recette gateau (copie)');
    expect(result).toBeTruthy();
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
  });

  it('should_handle_numbers_in_slug', () => {
    const result = generateSlug('Gâteau 2024');
    expect(result).toContain('2024');
  });
});

// ─── generateTenantSlug ──────────────────────────────────────────────────────

describe('generateTenantSlug', () => {
  it('should_generate_slug_from_business_name', () => {
    const result = generateTenantSlug('Boulangerie Dupont');
    expect(result).toBe('boulangerie-dupont');
  });

  it('should_truncate_to_50_characters', () => {
    const longName = 'a'.repeat(200);
    const result = generateTenantSlug(longName);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('should_handle_short_names_without_truncation', () => {
    const result = generateTenantSlug('pain');
    expect(result).toBe('pain');
  });
});
