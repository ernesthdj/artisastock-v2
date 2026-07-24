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

// Consommé par les factures de commande (Order/OrderItem), qui utilisent depuis
// docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md étape 1 un snapshot numérique
// (OrderItem.vatRatePercent) plutôt que l'enum VatRate — resté en place ci-dessus
// uniquement pour le module Achats/Lot (non touché par le module Boutique/Produits).
export function buildVatBreakdown(
  items: Array<{ totalHT: number; vatRatePercent: number }>
): VatBreakdownLine[] {
  const byRate = new Map<number, number>();

  for (const item of items) {
    byRate.set(item.vatRatePercent, (byRate.get(item.vatRatePercent) ?? 0) + item.totalHT);
  }

  return Array.from(byRate.entries()).map(([ratePercent, base]) => ({
    rate: `${ratePercent}%`,
    base: Math.round(base * 100) / 100,
    amount: Math.round(base * (ratePercent / 100) * 100) / 100,
  }));
}
