// GET /api/v1/pos/products — produits vendables au comptoir + quantité servable calculée
// en direct depuis le stock d'ingrédients (UC4). Décision de cadrage 2026-07-26 : le POS
// vend des recettes à la demande, pas du stock pré-produit — voir docs/modules/POS.md
// § Vente à la demande. Le canal DIRECT (ProductChannelStock) n'est plus utilisé ici,
// seule la Boutique Web (canal VITRINE) continue de reposer sur du stock pré-produit.

import { NextRequest } from 'next/server';
import { getPrismaWithTenant, prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';
import { checkAvailability } from '@/lib/bom/fifo';

export async function GET(request: NextRequest) {
  return withPermission(request, ['pos.sell', 'pos.manage'], async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);

    const products = await db.product.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        category: true,
        priceTTC: true,
        sortOrder: true,
        bomSheetId: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const withAvailability = await Promise.all(
      products.map(async ({ bomSheetId, ...product }) => {
        // nBatches=1 : chaque AvailabilityLine.required devient le besoin par unité vendue,
        // ce qui permet de dériver le nombre maximum d'unités servables par ingrédient limitant.
        const availability = await checkAvailability(bomSheetId, 1, prisma);
        const maxBatches = availability.lines.length
          ? Math.min(
              ...availability.lines.map((l) =>
                l.required > 0 ? Math.floor(l.availableInUnit / l.required) : Number.POSITIVE_INFINITY
              )
            )
          : 0;

        return {
          ...product,
          directQtyRemaining: Number.isFinite(maxBatches) ? Math.max(0, maxBatches) : 0,
        };
      })
    );

    return apiSuccess(withAvailability);
  });
}
