import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export const POST = withPermission('cms:publish', async (
  _request: NextRequest,
  ctx: { tenantId: string }
) => {
  // Publier la config du site
  const config = await prisma.siteConfig.update({
    where: { tenantId: ctx.tenantId },
    data: { isPublished: true, publishedAt: new Date() },
    select: { isPublished: true, publishedAt: true },
  });

  return apiSuccess({ published: true, publishedAt: config.publishedAt });
});
