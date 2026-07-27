// GET /api/v1/activites/[id]/flow-summary — agrégation lecture seule pour la Vue Flux
// (docs/modules/FLUX.md) : stocks liés (alerte calculée), résumé activité (fiches BOM
// actives), état des canaux de vente POS/Boutique. Aucun champ stocké dédié — tout est
// dérivé des relations existantes (ActiviteStock, Lot→Ingredient, Product→BomSheet→
// BomLevel→BomContext.activiteId, ProductChannelStock).

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'flow.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);

    const activite = await db.activite.findUnique({
      where: { id: params.id },
      include: { stocks: { include: { stock: true } } },
    });
    if (!activite) return apiError('NOT_FOUND', 'Activité introuvable', 404);

    const stockIds = activite.stocks.map((s) => s.stock.id);

    // Alerte par stock : au moins un ingrédient ayant un lot dans ce stock est sous seuil.
    const lots = stockIds.length
      ? await db.lot.findMany({
          where: { stockId: { in: stockIds } },
          select: { stockId: true, ingredientId: true },
          distinct: ['stockId', 'ingredientId'],
        })
      : [];
    const ingredientIds = [...new Set(lots.map((l) => l.ingredientId))];
    const ingredients = ingredientIds.length
      ? await db.ingredient.findMany({
          where: { id: { in: ingredientIds } },
          select: { id: true, stock: true, alertThreshold: true, isAlertActive: true },
        })
      : [];
    const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
    const isIngredientInAlert = (id: string) => {
      const ing = ingredientById.get(id);
      return !!ing && ing.isAlertActive && Number(ing.stock) <= Number(ing.alertThreshold);
    };

    const stocks = activite.stocks.map(({ stock }) => {
      const linkedIngredientIds = lots.filter((l) => l.stockId === stock.id).map((l) => l.ingredientId);
      return {
        id: stock.id,
        name: stock.name,
        alerte: linkedIngredientIds.some(isIngredientInAlert),
      };
    });
    const alertesCount = new Set(lots.map((l) => l.ingredientId).filter(isIngredientInAlert)).size;

    // Fiches BOM actives de cette activité (BomLevel/BomSheet scopés via BomContext, pas
    // de tenantId propre — voir TENANT_SCOPED_VIA_PARENT dans lib/prisma.ts).
    const ficheCount = await db.bomSheet.count({
      where: { isActive: true, level: { context: { activiteId: activite.id } } },
    });

    // Produits vendables issus de cette activité, ventilés par canal (DIRECT = POS,
    // VITRINE = Boutique) — Product n'a pas de FK directe vers Activite.
    const products = await db.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        bomSheet: { level: { context: { activiteId: activite.id } } },
      },
      select: { channelStock: { select: { channel: true, qtyRemaining: true } } },
    });

    const channelSummary = (channel: 'DIRECT' | 'VITRINE') => {
      let productCount = 0;
      let qtyTotal = 0;
      for (const p of products) {
        const qty = p.channelStock
          .filter((c) => c.channel === channel)
          .reduce((sum, c) => sum + Number(c.qtyRemaining), 0);
        if (qty > 0) {
          productCount += 1;
          qtyTotal += qty;
        }
      }
      return { productCount, qtyTotal };
    };

    // Sessions de caisse ouvertes — pas de lien Activité↔SessionCaisse dans le schéma
    // (Vendeur/SessionCaisse sont tenant-scoped, pas activité-scoped), donc tenant-wide
    // comme le reste du concept "Point de vente" dans cette vue.
    const openCaisseSessions = await db.sessionCaisse.findMany({
      where: { status: 'OPEN' },
      select: { vendeurId: true, openedAt: true, vendeur: { select: { firstName: true, lastName: true } } },
      orderBy: { openedAt: 'asc' },
    });

    return apiSuccess({
      activite: { id: activite.id, name: activite.name, ficheCount, alertesCount },
      stocks,
      pos: {
        ...channelSummary('DIRECT'),
        openSessions: openCaisseSessions.map((s) => ({
          vendeurId: s.vendeurId,
          vendeurName: `${s.vendeur.firstName} ${s.vendeur.lastName}`,
          openedAt: s.openedAt,
        })),
      },
      boutique: channelSummary('VITRINE'),
    });
  });
}
