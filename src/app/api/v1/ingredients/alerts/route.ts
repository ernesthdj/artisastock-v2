import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withPermission(request, 'ingredients.read', async (ctx) => {
    // Ingredients dont le stock est inférieur ou égal au seuil d'alerte
    const alerts = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        category: string | null;
        unit: string;
        stock: number;
        alertThreshold: number;
      }>
    >`
      SELECT id, name, category, unit::text, CAST(stock AS FLOAT) as stock, CAST("alertThreshold" AS FLOAT) as "alertThreshold"
      FROM "Ingredient"
      WHERE "tenantId" = ${ctx.tenantId}
        AND "isActive" = true
        AND "deletedAt" IS NULL
        AND "isAlertActive" = true
        AND stock <= "alertThreshold"
      ORDER BY (stock / NULLIF("alertThreshold", 0)) ASC
    `;

    return apiSuccess(alerts);
  });
}
