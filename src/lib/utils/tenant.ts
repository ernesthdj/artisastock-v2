import { prisma } from '../prisma';

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      locale: true,
      vatNumber: true,
      address: true,
      phone: true,
      email: true,
      description: true,
      openingHours: true,
      plan: true,
      trialEndsAt: true,
    },
  });
}

export async function isTenantActive(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { isActive: true, deletedAt: true },
  });
  return !!tenant?.isActive && !tenant?.deletedAt;
}
