import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export const GET = withPermission('dashboard:read', async (
  _request: NextRequest,
  ctx: { tenantId: string }
) => {
  // Ingrédients dont le stock est inférieur ou égal au seuil d'alerte
  const alerts = await prisma.$queryRaw<Array<{
    id: string; name: string; stockQuantity: number; alertThreshold: number; unit: string;
  }>>`
    SELECT id, name, "stockQuantity", "alertThreshold", unit
    FROM "Ingredient"
    WHERE "tenantId" = ${ctx.tenantId}
      AND "isActive" = true
      AND "alertThreshold" IS NOT NULL
      AND "stockQuantity" IS NOT NULL
      AND "stockQuantity" <= "alertThreshold"
    ORDER BY ("stockQuantity" - "alertThreshold") ASC
    LIMIT 20
  `;

  return apiSuccess(alerts);
});
