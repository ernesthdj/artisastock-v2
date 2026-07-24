import { OrderStatus } from '@prisma/client';
import type { PillTone } from '@/components/ui/Pill';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  CONFIRMED: 'Confirmée',
  STOCK_CONFLICT: 'Conflit de stock',
  IN_PREPARATION: 'En préparation',
  READY: 'Prête',
  PICKED_UP: 'Retirée',
  CANCELLED: 'Annulée',
};

// Source de vérité unique pour la couleur des statuts commande — consommé via <Pill tone={ORDER_STATUS_TONE[status]}>
export const ORDER_STATUS_TONE: Record<OrderStatus, PillTone> = {
  NEW: 'info',
  CONFIRMED: 'ok',
  STOCK_CONFLICT: 'crit',
  IN_PREPARATION: 'warn',
  READY: 'gold',
  PICKED_UP: 'neutral',
  CANCELLED: 'crit',
};

// Transitions valides : état actuel → états suivants autorisés
// STOCK_CONFLICT n'est jamais atteint par une transition admin — uniquement posé
// par le webhook Stripe (docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md étape 10).
// Depuis ce statut, l'admin résout manuellement vers CONFIRMED ou CANCELLED.
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PREPARATION', 'CANCELLED'],
  STOCK_CONFLICT: ['CONFIRMED', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: [],
  CANCELLED: [],
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
