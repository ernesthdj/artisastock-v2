// POST /api/v1/products/[id]/closure — Clôture quotidienne d'un canal (UC10)
// Répartit un ou plusieurs motifs (WASTE/STAFF/OTHER) sur tout le stock restant d'un canal,
// même si ce stock est réparti sur plusieurs lots (ProductChannelStock) — pilier anti-fraude :
// jamais de clôture sans motif, jamais un écart entre la somme des motifs et le stock réel.

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { stockClosureCreateSchema } from '@/lib/validators/stock-closure';

const TOLERANCE = 0.0001;

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'products.close', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = stockClosureCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!product) return apiError('NOT_FOUND', 'Produit introuvable', 404);

    const rows = await prisma.productChannelStock.findMany({
      where: { productId: product.id, channel: parsed.data.channel, qtyRemaining: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });

    const totalRemaining = rows.reduce((sum, r) => sum + Number(r.qtyRemaining), 0);
    const totalRequested = parsed.data.lines.reduce((sum, l) => sum + l.qty, 0);

    if (Math.abs(totalRemaining - totalRequested) > TOLERANCE) {
      return apiError(
        'VALIDATION_ERROR',
        `La somme des motifs (${totalRequested}) doit correspondre exactement au stock restant (${totalRemaining}) sur ce canal`,
        400
      );
    }
    if (totalRemaining <= TOLERANCE) {
      return apiError('VALIDATION_ERROR', 'Aucun stock restant à clôturer sur ce canal', 400);
    }

    // Répartition motifs (lines) × lots (rows) — chaque intersection non nulle devient une
    // StockClosure ; une ligne motif peut se scinder sur plusieurs lots si elle en chevauche
    // plusieurs, un lot peut recevoir plusieurs motifs si l'admin a scindé.
    const closures = await prisma.$transaction(async (tx) => {
      const created = [];
      let rowIdx = 0;
      let rowRemaining = rows.length ? Number(rows[0].qtyRemaining) : 0;

      for (const line of parsed.data.lines) {
        let lineRemaining = line.qty;
        while (lineRemaining > TOLERANCE && rowIdx < rows.length) {
          const consumed = Math.min(rowRemaining, lineRemaining);
          if (consumed > TOLERANCE) {
            created.push(
              await tx.stockClosure.create({
                data: {
                  tenantId: ctx.tenantId,
                  productChannelStockId: rows[rowIdx].id,
                  qty: consumed,
                  reason: line.reason,
                  note: line.note,
                  closedByUserId: ctx.userId,
                },
              })
            );
          }
          lineRemaining -= consumed;
          rowRemaining -= consumed;
          if (rowRemaining <= TOLERANCE) {
            rowIdx += 1;
            rowRemaining = rowIdx < rows.length ? Number(rows[rowIdx].qtyRemaining) : 0;
          }
        }
      }

      for (const row of rows) {
        await tx.productChannelStock.update({ where: { id: row.id }, data: { qtyRemaining: 0 } });
      }

      return created;
    });

    return apiSuccess(closures);
  });
}
