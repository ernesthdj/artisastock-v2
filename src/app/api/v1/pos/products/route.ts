// GET /api/v1/pos/products — produits vendables au comptoir + stock DIRECT restant (UC4)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

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
        images: true,
        sortOrder: true,
        channelStock: { where: { channel: 'DIRECT' }, select: { qtyRemaining: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Rupture (UC4/UC5) = somme des allocations DIRECT restantes, jamais une valeur
    // par défaut optimiste — même règle que vitrineQtyRemaining côté storefront.
    const withStock = products.map(({ channelStock, ...product }) => ({
      ...product,
      directQtyRemaining: channelStock.reduce((sum, c) => sum + Number(c.qtyRemaining), 0),
    }));

    return apiSuccess(withStock);
  });
}
