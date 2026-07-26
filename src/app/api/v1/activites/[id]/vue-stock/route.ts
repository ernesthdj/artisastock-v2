// GET /api/v1/activites/[id]/vue-stock — agrégation lecture seule pour la Vue Stock Global
// (3 niveaux : ingrédients par stock physique, produits intermédiaires (fiches BOM produites
// mais non publiées), produits finaux (Products) avec leur disponibilité par canal). Même
// convention d'agrégation activité-scopée que flow-summary — aucun champ stocké dédié, tout
// est dérivé des relations existantes (ActiviteStock→Lot→Ingredient, BomStock, ProductChannelStock).

import { NextRequest } from 'next/server';
import { getPrismaWithTenant, prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { checkAvailability } from '@/lib/bom/fifo';

const DLC_SOON_DAYS = 7;

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'stocks.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);

    const activite = await db.activite.findUnique({
      where: { id: params.id },
      include: { stocks: { include: { stock: true } } },
    });
    if (!activite) return apiError('NOT_FOUND', 'Activité introuvable', 404);

    const now = new Date();
    const dlcSoonLimit = new Date(now.getTime() + DLC_SOON_DAYS * 24 * 60 * 60 * 1000);

    // ═══ 1. Ingrédients — regroupés par stock physique lié à l'activité ═══
    const stockIds = activite.stocks.map((s) => s.stock.id);

    const lots = stockIds.length
      ? await db.lot.findMany({
          where: { stockId: { in: stockIds }, quantityAvailable: { gt: 0 } },
          select: {
            id: true, stockId: true, ingredientId: true, purchaseDate: true, expiryDate: true,
            quantityAvailable: true, quantityInitial: true, totalPriceHT: true,
          },
          orderBy: { purchaseDate: 'asc' },
        })
      : [];

    const ingredientIds = [...new Set(lots.map((l) => l.ingredientId))];
    const ingredients = ingredientIds.length
      ? await db.ingredient.findMany({
          where: { id: { in: ingredientIds } },
          select: {
            id: true, name: true, unit: true, category: true, priceUnit: true,
            stock: true, alertThreshold: true, isAlertActive: true,
          },
        })
      : [];
    const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

    // Alerte calculée sur le stock GLOBAL de l'ingrédient (même logique que flow-summary/Hub) —
    // pas un seuil par emplacement, qui n'existe pas dans le modèle.
    const isIngredientInAlert = (id: string) => {
      const ing = ingredientById.get(id);
      return !!ing && ing.isAlertActive && Number(ing.stock) <= Number(ing.alertThreshold);
    };

    const stocks = activite.stocks.map(({ stock }) => {
      const stockLots = lots.filter((l) => l.stockId === stock.id);
      const byIngredient = new Map<string, typeof stockLots>();
      for (const lot of stockLots) {
        const arr = byIngredient.get(lot.ingredientId) ?? [];
        arr.push(lot);
        byIngredient.set(lot.ingredientId, arr);
      }

      const ingredientRows = [...byIngredient.entries()].map(([ingredientId, ingLots]) => {
        const ing = ingredientById.get(ingredientId)!;
        const qty = ingLots.reduce((sum, l) => sum + Number(l.quantityAvailable), 0);
        const nearestExpiry = ingLots
          .filter((l) => l.expiryDate)
          .map((l) => l.expiryDate!.getTime())
          .sort((a, b) => a - b)[0];

        return {
          id: ing.id,
          name: ing.name,
          unit: ing.unit,
          category: ing.category,
          qty,
          priceUnit: Number(ing.priceUnit),
          valorisation: Math.round(qty * Number(ing.priceUnit) * 100) / 100,
          inAlert: isIngredientInAlert(ingredientId),
          lotsCount: ingLots.length,
          nearestExpiry: nearestExpiry ? new Date(nearestExpiry).toISOString() : null,
          lots: ingLots.map((l) => ({
            id: l.id,
            purchaseDate: l.purchaseDate,
            expiryDate: l.expiryDate,
            quantityAvailable: Number(l.quantityAvailable),
            unitCost: Number(l.quantityInitial) > 0 ? Number(l.totalPriceHT) / Number(l.quantityInitial) : 0,
          })),
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: stock.id,
        name: stock.name,
        valorisation: Math.round(ingredientRows.reduce((s, i) => s + i.valorisation, 0) * 100) / 100,
        ingredients: ingredientRows,
      };
    });

    // ═══ 2. Produits intermédiaires — fiches BOM produites (BomStock > 0) non publiées ═══
    const sheets = await db.bomSheet.findMany({
      where: { isActive: true, level: { context: { activiteId: activite.id } } },
      include: {
        stocks: {
          where: { qtyAvailable: { gt: 0 } },
          select: {
            id: true, qtyAvailable: true, unitCost: true, producedAt: true, dlcDate: true,
            stockId: true, stock: { select: { id: true, name: true } },
          },
        },
        products: { select: { id: true } },
      },
    });

    const intermediaires = sheets
      .filter((s) => s.products.length === 0 && s.stocks.length > 0)
      .map((s) => {
        const totalQty = s.stocks.reduce((sum, b) => sum + Number(b.qtyAvailable), 0);
        const weightedCost = s.stocks.reduce((sum, b) => sum + Number(b.qtyAvailable) * Number(b.unitCost), 0);
        const distinctStockIds = new Set(s.stocks.map((b) => b.stockId ?? 'NONE'));
        const mixedStock = distinctStockIds.size > 1;
        const stockName = mixedStock || distinctStockIds.size === 0 ? null : (s.stocks[0].stock?.name ?? null);
        const nearestExpiry = s.stocks
          .filter((b) => b.dlcDate)
          .map((b) => b.dlcDate!.getTime())
          .sort((a, b) => a - b)[0];

        return {
          sheetId: s.id,
          name: s.name,
          outputUnit: s.outputUnit,
          totalQty,
          avgUnitCost: totalQty > 0 ? Math.round((weightedCost / totalQty) * 10000) / 10000 : 0,
          valorisation: Math.round(weightedCost * 100) / 100,
          batchesCount: s.stocks.length,
          nearestExpiry: nearestExpiry ? new Date(nearestExpiry).toISOString() : null,
          stockName,
          mixedStock,
          batches: s.stocks
            .map((b) => ({
              id: b.id,
              qty: Number(b.qtyAvailable),
              unitCost: Number(b.unitCost),
              producedAt: b.producedAt,
              dlcDate: b.dlcDate,
              stockName: b.stock?.name ?? null,
            }))
            .sort((a, b) => a.producedAt.getTime() - b.producedAt.getTime()),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // ═══ 3. Produits finaux — Products publiés, dispo POS (à la demande) + Boutique (VITRINE) ═══
    const products = await db.product.findMany({
      where: { isActive: true, deletedAt: null, bomSheet: { level: { context: { activiteId: activite.id } } } },
      select: {
        id: true, name: true, priceTTC: true, bomSheetId: true,
        channelStock: {
          where: { channel: 'VITRINE' },
          select: {
            qtyAllocated: true, qtyRemaining: true,
            bomStock: { select: { unitCost: true, stockId: true, stock: { select: { name: true } } } },
          },
        },
      },
    });

    const finaux = await Promise.all(
      products.map(async (p) => {
        const availability = await checkAvailability(p.bomSheetId, 1, prisma);
        const maxBatches = availability.lines.length
          ? Math.min(
              ...availability.lines.map((l) =>
                l.required > 0 ? Math.floor(l.availableInUnit / l.required) : Number.POSITIVE_INFINITY
              )
            )
          : 0;

        const vitrineAllocated = p.channelStock.reduce((s, c) => s + Number(c.qtyAllocated), 0);
        const vitrineRemaining = p.channelStock.reduce((s, c) => s + Number(c.qtyRemaining), 0);
        const vitrineValorisation = p.channelStock.reduce(
          (s, c) => s + Number(c.qtyRemaining) * Number(c.bomStock.unitCost),
          0
        );
        const distinctStockIds = new Set(p.channelStock.map((c) => c.bomStock.stockId ?? 'NONE'));
        const vitrineMixedStock = distinctStockIds.size > 1;
        const vitrineStockName =
          vitrineMixedStock || distinctStockIds.size === 0 ? null : (p.channelStock[0]?.bomStock.stock?.name ?? null);

        return {
          productId: p.id,
          name: p.name,
          priceTTC: Number(p.priceTTC),
          pos: { maxBatchesNow: Number.isFinite(maxBatches) ? Math.max(0, maxBatches) : 0 },
          vitrine: vitrineAllocated > 0
            ? {
                allocated: vitrineAllocated,
                remaining: vitrineRemaining,
                valorisation: Math.round(vitrineValorisation * 100) / 100,
                stockName: vitrineStockName,
                mixedStock: vitrineMixedStock,
              }
            : null,
        };
      })
    );
    finaux.sort((a, b) => a.name.localeCompare(b.name));

    // ═══ Résumé global ═══
    const ingredientsValue = stocks.reduce((s, st) => s + st.valorisation, 0);
    const intermediairesValue = intermediaires.reduce((s, i) => s + i.valorisation, 0);
    const finauxValue = finaux.reduce((s, f) => s + (f.vitrine?.valorisation ?? 0), 0);

    const alertesCount = new Set(lots.map((l) => l.ingredientId).filter(isIngredientInAlert)).size;

    const dlcSoonCount =
      lots.filter((l) => l.expiryDate && l.expiryDate <= dlcSoonLimit && l.expiryDate >= now).length +
      intermediaires.reduce(
        (sum, i) => sum + i.batches.filter((b) => b.dlcDate && b.dlcDate <= dlcSoonLimit && b.dlcDate >= now).length,
        0
      );

    return apiSuccess({
      activite: { id: activite.id, name: activite.name },
      summary: {
        ingredientsValue: Math.round(ingredientsValue * 100) / 100,
        intermediairesValue: Math.round(intermediairesValue * 100) / 100,
        finauxValue: Math.round(finauxValue * 100) / 100,
        totalValue: Math.round((ingredientsValue + intermediairesValue + finauxValue) * 100) / 100,
        alertesCount,
        dlcSoonCount,
      },
      stocks,
      intermediaires,
      finaux,
    });
  });
}
