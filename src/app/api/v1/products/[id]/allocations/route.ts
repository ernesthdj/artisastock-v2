// POST /api/v1/products/[id]/allocations — Répartit un lot BomStock entre canaux Vitrine/Direct (UC3)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { productChannelStockCreateSchema } from '@/lib/validators/product-channel-stock';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'products.allocate', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = productChannelStockCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!product) return apiError('NOT_FOUND', 'Produit introuvable', 404);

    const bomStock = await prisma.bomStock.findFirst({
      where: { id: parsed.data.bomStockId, tenantId: ctx.tenantId },
    });
    if (!bomStock) return apiError('NOT_FOUND', 'Lot de production introuvable', 404);
    if (bomStock.sheetId !== product.bomSheetId) {
      return apiError('VALIDATION_ERROR', "Ce lot n'appartient pas à la fiche BOM de ce produit", 400);
    }

    // Plafond = BomStock.qtyAvailable, partagé entre TOUS les produits/canaux déjà alloués sur ce lot —
    // pas de re-lecture de valeur côté client, tout est recalculé depuis la base au moment de l'écriture.
    const existingTotal = await prisma.productChannelStock.aggregate({
      where: { bomStockId: parsed.data.bomStockId },
      _sum: { qtyAllocated: true },
    });
    const alreadyAllocated = Number(existingTotal._sum.qtyAllocated ?? 0);
    const requested = parsed.data.allocations.reduce((sum, a) => sum + a.qty, 0);
    const qtyAvailable = Number(bomStock.qtyAvailable);

    if (alreadyAllocated + requested > qtyAvailable) {
      return apiError(
        'INSUFFICIENT_STOCK',
        `Allocation refusée : ${requested} demandé(s) + ${alreadyAllocated} déjà alloué(s) > ${qtyAvailable} disponible(s) sur ce lot`,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const alloc of parsed.data.allocations) {
        if (alloc.qty <= 0) continue;

        const existing = await tx.productChannelStock.findFirst({
          where: { productId: product.id, bomStockId: parsed.data.bomStockId, channel: alloc.channel },
        });

        if (existing) {
          await tx.productChannelStock.update({
            where: { id: existing.id },
            data: {
              qtyAllocated: { increment: alloc.qty },
              qtyRemaining: { increment: alloc.qty },
            },
          });
        } else {
          await tx.productChannelStock.create({
            data: {
              tenantId: ctx.tenantId,
              productId: product.id,
              bomStockId: parsed.data.bomStockId,
              channel: alloc.channel,
              qtyAllocated: alloc.qty,
              qtyRemaining: alloc.qty,
            },
          });
        }
      }

      return tx.productChannelStock.findMany({
        where: { productId: product.id, bomStockId: parsed.data.bomStockId },
      });
    });

    return apiSuccess(result);
  });
}
