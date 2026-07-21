import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx) => {
    // Ingrédients dont le stock est inférieur ou égal au seuil d'alerte
    const alerts = await prisma.$queryRaw<Array<{
      id: string; name: string; stock: number; alertThreshold: number; unit: string;
    }>>`
      SELECT id, name, stock, "alertThreshold", unit
      FROM "Ingredient"
      WHERE "tenantId" = ${ctx.tenantId}
        AND "isActive" = true
        AND "isAlertActive" = true
        AND stock <= "alertThreshold"
      ORDER BY (stock - "alertThreshold") ASC
      LIMIT 20
    `;

    return apiSuccess(alerts);
  });
}
