import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';

export const GET = withPermission('recipes:read', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });

  if (!recipe) return apiError('NOT_FOUND', 'Recette introuvable', 404);

  const versions = await prisma.recipeVersion.findMany({
    where: { recipeId: params.id },
    orderBy: { version: 'desc' },
    select: {
      id: true, version: true, costHT: true, createdAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return apiSuccess(versions);
});
