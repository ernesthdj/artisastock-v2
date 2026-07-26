// POST /api/v1/pos/sales — Finalise une vente comptoir : décrémente ProductChannelStock
// canal DIRECT (consumeChannelStockOrFlagConflict, déjà utilisé par le webhook Stripe pour
// VITRINE), crée PosSale/PosSaleItem (UC4, UC5, UC6). Aucun paiement externe déjà capturé
// à ce stade (contrairement à Stripe) — rejet direct 400 si stock insuffisant, jamais de
// statut STOCK_CONFLICT : tout-ou-rien, aucune écriture partielle.

import { NextRequest } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiCreated, apiError } from '@/lib/permissions';
import { posSaleSchema } from '@/lib/validators/pos-sale';
import { verifyVendeurPin } from '@/lib/pos/vendeur-auth';
import { consumeChannelStockOrFlagConflict } from '@/lib/products/channel-stock';

const INSUFFICIENT_STOCK = Symbol('INSUFFICIENT_STOCK');

export async function POST(request: NextRequest) {
  return withPermission(request, 'pos.sell', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = posSaleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const { vendeurId, pin, sessionCaisseId, paymentMethod, items } = parsed.data;

    const auth = await verifyVendeurPin(ctx.tenantId, vendeurId, pin);
    if (!auth.ok) {
      const status = auth.code === 'NOT_FOUND' ? 404 : 400;
      return apiError(auth.code, auth.message, status);
    }

    const db = getPrismaWithTenant(ctx.tenantId);

    const session = await db.sessionCaisse.findUnique({ where: { id: sessionCaisseId } });
    if (!session) return apiError('NOT_FOUND', 'Session de caisse introuvable', 404);
    if (session.vendeurId !== vendeurId) {
      return apiError('FORBIDDEN', "Cette session n'appartient pas à ce vendeur", 403);
    }
    if (session.status !== 'OPEN') {
      return apiError('SESSION_CLOSED', 'Cette session de caisse est fermée', 400);
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await db.product.findMany({ where: { id: { in: productIds }, isActive: true, deletedAt: null } });
    if (products.length !== productIds.length) {
      return apiError('PRODUCT_UNAVAILABLE', 'Un ou plusieurs produits ne sont plus disponibles', 400);
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    try {
      const sale = await db.$transaction(async (tx) => {
        const ok = await consumeChannelStockOrFlagConflict(
          items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          tx as unknown as PrismaClient,
          'DIRECT'
        );
        if (!ok) throw INSUFFICIENT_STOCK;

        const saleItems = items.map((item) => {
          const product = productById.get(item.productId)!;
          const unitPriceTTC = Number(product.priceTTC);
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPriceTTC,
            totalTTC: unitPriceTTC * item.quantity,
          };
        });
        const totalTTC = saleItems.reduce((sum, l) => sum + l.totalTTC, 0);

        return tx.posSale.create({
          data: { tenantId: ctx.tenantId, vendeurId, sessionCaisseId, paymentMethod, totalTTC, items: { create: saleItems } },
          include: { items: true },
        });
      });

      return apiCreated(sale);
    } catch (err) {
      if (err === INSUFFICIENT_STOCK) {
        return apiError('INSUFFICIENT_STOCK', 'Stock insuffisant pour finaliser la vente', 400);
      }
      throw err;
    }
  });
}
