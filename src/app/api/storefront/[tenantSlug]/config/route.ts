import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';

export async function GET(_request: NextRequest, props: { params: Promise<{ tenantSlug: string }> }) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true, name: true, description: true, openingHours: true, address: true, phone: true, email: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const config = await prisma.siteConfig.findUnique({
    where: { tenantId: tenant.id },
    select: { template: true, logo: true, favicon: true, colors: true, fonts: true, socialLinks: true, isPublished: true },
  });

  const pages = await prisma.page.findMany({
    where: { tenantId: tenant.id, isVisible: true, deletedAt: null },
    select: { id: true, title: true, slug: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });

  return apiSuccess({ tenant, config, pages });
}
