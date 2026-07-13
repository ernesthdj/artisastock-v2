import { VatRate } from '@prisma/client';

export const VAT_RATES: Record<VatRate, number> = {
  FOOD_6: 0.06,
  STANDARD_21: 0.21,
};

export const VAT_LABELS: Record<VatRate, string> = {
  FOOD_6: '6% (alimentaire)',
  STANDARD_21: '21% (standard)',
};

export function vatRateToPercent(rate: VatRate): string {
  return `${Math.round(VAT_RATES[rate] * 100)}%`;
}

export interface VatBreakdownLine {
  rate: string;
  base: number;
  amount: number;
}

export function buildVatBreakdown(
  items: Array<{ totalHT: number; vatRate: VatRate }>
): VatBreakdownLine[] {
  const byRate = new Map<VatRate, number>();

  for (const item of items) {
    byRate.set(item.vatRate, (byRate.get(item.vatRate) ?? 0) + item.totalHT);
  }

  return Array.from(byRate.entries()).map(([rate, base]) => ({
    rate: vatRateToPercent(rate),
    base: Math.round(base * 100) / 100,
    amount: Math.round(base * VAT_RATES[rate] * 100) / 100,
  }));
}
