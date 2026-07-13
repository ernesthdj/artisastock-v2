import { describe, it, expect } from 'vitest';
import { formatPrice, formatDate, formatDateTime, formatDuration } from '@/lib/utils/format';

// ─── formatPrice ─────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('should_format_integer_price_with_two_decimals', () => {
    const result = formatPrice(10, 'fr-BE');
    expect(result).toContain('10');
    expect(result).toContain('€');
  });

  it('should_format_decimal_price_correctly', () => {
    const result = formatPrice(12.5, 'fr-BE');
    expect(result).toContain('12');
    expect(result).toContain('€');
  });

  it('should_format_zero_price', () => {
    const result = formatPrice(0, 'fr-BE');
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('should_include_two_decimal_places', () => {
    const result = formatPrice(10, 'fr-BE');
    // Intl formats 10 as "10,00 €" in fr-BE
    expect(result).toMatch(/00/);
  });
});

// ─── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('should_format_date_as_dd_mm_yyyy', () => {
    const date = new Date('2026-07-14');
    const result = formatDate(date, 'fr-BE');
    expect(result).toMatch(/14\/07\/2026/);
  });

  it('should_accept_string_date', () => {
    const result = formatDate('2026-01-01', 'fr-BE');
    expect(result).toContain('2026');
  });

  it('should_pad_day_and_month_with_zero', () => {
    const date = new Date('2026-03-05');
    const result = formatDate(date, 'fr-BE');
    expect(result).toMatch(/05\/03\/2026/);
  });
});

// ─── formatDateTime ──────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('should_include_date_and_time', () => {
    const date = new Date('2026-07-14T10:30:00');
    const result = formatDateTime(date, 'fr-BE');
    expect(result).toContain('2026');
    expect(result).toMatch(/[0-9]{2}:[0-9]{2}/);
  });
});

// ─── formatDuration ──────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('should_return_minutes_only_when_less_than_60', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(59)).toBe('59 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('should_return_hours_only_when_divisible_by_60', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(180)).toBe('3h');
  });

  it('should_return_hours_and_minutes_when_not_divisible_by_60', () => {
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(65)).toBe('1h05');
    expect(formatDuration(125)).toBe('2h05');
  });

  it('should_pad_minutes_to_2_digits_in_hours_format', () => {
    expect(formatDuration(61)).toBe('1h01');
    expect(formatDuration(69)).toBe('1h09');
  });
});
