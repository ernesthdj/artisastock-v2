import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  return withPermission(request, 'cms.publish', async (ctx) => {
    // Publier la config du site
    const config = await prisma.siteConfig.update({
      where: { tenantId: ctx.tenantId },
      data: { isPublished: true, publishedAt: new Date() },
      select: { isPublished: true, publishedAt: true },
    });

    return apiSuccess({ published: true, publishedAt: config.publishedAt });
  });
}
