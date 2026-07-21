import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ tenantSlug: string; slug: string }> }
) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const page = await prisma.page.findFirst({
    where: {
      tenantId: tenant.id,
      slug: params.slug,
      isVisible: true,
      deletedAt: null,
    },
  });

  if (!page) return apiError('NOT_FOUND', 'Page introuvable', 404);

  return apiSuccess(page);
}
