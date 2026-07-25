// src/lib/products/channel-stock.ts — Décrément FIFO de ProductChannelStock (canal Vitrine)
// Distinct du FIFO ingrédients/BOM (src/lib/bom/fifo.ts) : ici on consomme une allocation
// déjà réservée par canal (Product+BomStock+channel), pas un stock d'ingrédient ou de sous-fiche.

import { PrismaClient, StockChannel } from '@prisma/client';

const TOLERANCE = 0.0001;

export interface ChannelStockRequest {
  productId: string;
  quantity: number;
}

/**
 * Vérifie et consomme, dans la transaction fournie, l'allocation Vitrine de chaque produit
 * demandé — anti-TOCTOU (re-lecture fraîche des ProductChannelStock.qtyRemaining ici, jamais
 * une valeur lue plus tôt côté client). Tout-ou-rien au niveau de la commande entière : si un
 * seul produit est insuffisant, RIEN n'est décrémenté et la fonction renvoie false — jamais de
 * décrément partiel silencieux (voir décision du 2026-07-24, STOCK_CONFLICT géré par l'appelant).
 */
export async function consumeChannelStockOrFlagConflict(
  items: ChannelStockRequest[],
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  channel: StockChannel = 'VITRINE'
): Promise<boolean> {
  const plans: Array<{ productId: string; required: number; rows: Array<{ id: string; qtyRemaining: number }> }> = [];

  for (const item of items) {
    const rows = await tx.productChannelStock.findMany({
      where: { productId: item.productId, channel, qtyRemaining: { gt: 0 } },
      orderBy: { bomStock: { producedAt: 'asc' } },
    });

    const totalAvailable = rows.reduce((sum, r) => sum + Number(r.qtyRemaining), 0);
    if (totalAvailable < item.quantity - TOLERANCE) {
      return false;
    }

    plans.push({
      productId: item.productId,
      required: item.quantity,
      rows: rows.map((r) => ({ id: r.id, qtyRemaining: Number(r.qtyRemaining) })),
    });
  }

  for (const plan of plans) {
    let remaining = plan.required;
    for (const row of plan.rows) {
      if (remaining <= TOLERANCE) break;
      const consumed = Math.min(row.qtyRemaining, remaining);
      await tx.productChannelStock.update({
        where: { id: row.id },
        data: { qtyRemaining: { decrement: consumed } },
      });
      remaining -= consumed;
    }
  }

  return true;
}
