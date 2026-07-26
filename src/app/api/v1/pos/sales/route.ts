// POST /api/v1/pos/sales — Finalise une vente comptoir : déclenche une vraie production BOM
// à la volée pour chaque ligne (checkAvailability/calculateBomCost/consumeFIFO — mêmes
// fonctions que "Lancer une production" en BOM), crée PosSale/PosSaleItem avec le coût réel
// snapshoté (UC4, UC5, UC6). Décision de cadrage 2026-07-26 (voir docs/modules/POS.md) :
// vente à la demande, jamais de stock pré-produit pour ce canal — le BomStock créé a
// qtyAvailable=0 (produit et vendu dans le même instant, jamais en inventaire). Rejet
// direct 400 si stock insuffisant, jamais de statut STOCK_CONFLICT : tout-ou-rien, aucune
// écriture partielle (le rollback de la transaction couvre aussi les lignes déjà traitées).

import { NextRequest } from 'next/server';
import { getPrismaWithTenant, prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiSuccess, apiError } from '@/lib/permissions';
import { posSaleSchema } from '@/lib/validators/pos-sale';
import { verifyVendeurPin } from '@/lib/pos/vendeur-auth';
import { consumeFIFO } from '@/lib/bom/fifo';
import { calculateBomCost } from '@/lib/bom/cost';

// GET /api/v1/pos/sales?vendeurId=&sessionCaisseId= — Historique des ventes (UC9)
export async function GET(request: NextRequest) {
  return withPermission(request, 'pos.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const sp = request.nextUrl.searchParams;

    const where: { vendeurId?: string; sessionCaisseId?: string } = {};
    if (sp.get('vendeurId')) where.vendeurId = sp.get('vendeurId')!;
    if (sp.get('sessionCaisseId')) where.sessionCaisseId = sp.get('sessionCaisseId')!;

    const sales = await db.posSale.findMany({
      where,
      include: {
        vendeur: { select: { firstName: true, lastName: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return apiSuccess(sales);
  });
}

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
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null },
      include: { bomSheet: { select: { id: true, levelId: true, outputQty: true } } },
    });
    if (products.length !== productIds.length) {
      return apiError('PRODUCT_UNAVAILABLE', 'Un ou plusieurs produits ne sont plus disponibles', 400);
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    // Coûts calculés hors transaction (lecture seule, même précédent que /bom/sheets/[id]/produce)
    const costByItem = new Map<number, Awaited<ReturnType<typeof calculateBomCost>>>();
    for (let i = 0; i < items.length; i++) {
      const product = productById.get(items[i].productId)!;
      costByItem.set(i, await calculateBomCost(product.bomSheet.id, items[i].quantity, prisma));
    }

    try {
      const sale = await prisma.$transaction(async (tx) => {
        const saleItemsData: Array<{
          productId: string;
          productionId: string;
          quantity: number;
          unitCost: number;
          unitPriceTTC: number;
          totalTTC: number;
        }> = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const product = productById.get(item.productId)!;
          const sheetId = product.bomSheet.id;
          const nBatches = item.quantity;
          const costResult = costByItem.get(i)!;
          const outputQty = Number(product.bomSheet.outputQty) * nBatches;

          const production = await tx.bomProduction.create({
            data: {
              tenantId: ctx.tenantId,
              levelId: product.bomSheet.levelId,
              sheetId,
              nBatches,
              outputQty,
              ingredientsCost: costResult.totalCost,
              unitCost: costResult.unitCost,
              notes: 'Production automatique — vente comptoir POS',
            },
          });

          // Re-vérification anti-TOCTOU réelle : consumeFIFO relit les lots à l'instant présent
          // et lève une erreur (capturée plus bas) si le stock a changé depuis le calcul du coût.
          await consumeFIFO({ sheetId, productionId: production.id, nBatches }, tx);

          await tx.bomStock.create({
            data: {
              tenantId: ctx.tenantId,
              sheetId,
              productionId: production.id,
              qtyAvailable: 0, // produit et vendu dans le même instant — jamais en inventaire
              unitCost: costResult.unitCost,
              producedAt: new Date(),
            },
          });

          const unitPriceTTC = Number(product.priceTTC);
          saleItemsData.push({
            productId: item.productId,
            productionId: production.id,
            quantity: item.quantity,
            unitCost: costResult.unitCost,
            unitPriceTTC,
            totalTTC: unitPriceTTC * item.quantity,
          });
        }

        const totalTTC = saleItemsData.reduce((sum, l) => sum + l.totalTTC, 0);

        return tx.posSale.create({
          data: { tenantId: ctx.tenantId, vendeurId, sessionCaisseId, paymentMethod, totalTTC, items: { create: saleItemsData } },
          include: { items: true },
        });
      });

      return apiCreated(sale);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Stock insuffisant')) {
        return apiError('INSUFFICIENT_STOCK', message, 400);
      }
      throw err;
    }
  });
}
