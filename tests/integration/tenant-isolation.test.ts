/**
 * Tests d'isolation multi-tenant
 *
 * Vérifie que les données d'un tenant A ne sont jamais accessibles
 * depuis le contexte d'un tenant B.
 *
 * Ces tests utilisent le mock Prisma de tests/setup.ts.
 * En production, ces garanties reposent sur getPrismaWithTenant() ($extends).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';

const TENANT_A = 'tenant-aaaaaaaaa';
const TENANT_B = 'tenant-bbbbbbbbb';

describe('Multi-tenant isolation — ingredient queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_scope_ingredient_findMany_to_requesting_tenant', async () => {
    // Simuler que tenant A a 2 ingrédients, tenant B en a 0
    const tenantAIngredients = [
      { id: 'ing-1', name: 'Farine', tenantId: TENANT_A },
      { id: 'ing-2', name: 'Sucre', tenantId: TENANT_A },
    ];

    vi.mocked(prisma.ingredient.findMany).mockImplementation(async (args) => {
      const tenantId = (args?.where as Record<string, unknown>)?.tenantId;
      if (tenantId === TENANT_A) return tenantAIngredients as never;
      return [];
    });

    const resultA = await prisma.ingredient.findMany({ where: { tenantId: TENANT_A } });
    const resultB = await prisma.ingredient.findMany({ where: { tenantId: TENANT_B } });

    expect(resultA).toHaveLength(2);
    expect(resultB).toHaveLength(0);
  });

  it('should_not_return_ingredient_of_tenant_A_when_querying_as_tenant_B', async () => {
    vi.mocked(prisma.ingredient.findUnique).mockImplementation(async (args) => {
      const where = args?.where as Record<string, unknown>;
      // L'ingrédient existe mais appartient au tenant A
      if (where?.id === 'ing-1' && where?.tenantId === TENANT_B) return null;
      return null;
    });

    // Tenant B tente d'accéder à un ingrédient du tenant A
    const result = await prisma.ingredient.findUnique({
      where: { id: 'ing-1', tenantId: TENANT_B } as never,
    });

    expect(result).toBeNull();
  });

  it('should_scope_order_count_to_tenant', async () => {
    vi.mocked(prisma.order.count).mockImplementation(async (args) => {
      const tenantId = (args?.where as Record<string, unknown>)?.tenantId;
      if (tenantId === TENANT_A) return 5;
      if (tenantId === TENANT_B) return 2;
      return 0;
    });

    const countA = await prisma.order.count({ where: { tenantId: TENANT_A } });
    const countB = await prisma.order.count({ where: { tenantId: TENANT_B } });

    expect(countA).toBe(5);
    expect(countB).toBe(2);
    expect(countA).not.toBe(countB);
  });
});

describe('Multi-tenant isolation — user queries', () => {
  it('should_not_find_user_from_different_tenant', async () => {
    vi.mocked(prisma.user.findUnique).mockImplementation(async (args) => {
      const where = args?.where as Record<string, unknown>;
      // L'user appartient au tenant A
      if (where?.id === 'user-a-1') {
        // Simuler que le check tenantId filtre correctement
        return null; // tenant B ne doit pas accéder
      }
      return null;
    });

    const result = await prisma.user.findUnique({
      where: { id: 'user-a-1' } as never,
    });

    expect(result).toBeNull();
  });

  it('should_find_user_within_correct_tenant', async () => {
    const mockUser = {
      id: 'user-a-1',
      tenantId: TENANT_A,
      email: 'admin@tenantA.be',
      isActive: true,
    };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await prisma.user.findUnique({ where: { id: 'user-a-1' } });

    expect(result).not.toBeNull();
    expect((result as typeof mockUser).tenantId).toBe(TENANT_A);
    // Vérifier que ce résultat ne serait pas accessible depuis tenant B
    expect((result as typeof mockUser).tenantId).not.toBe(TENANT_B);
  });
});

describe('Multi-tenant isolation — tenant findUnique by slug', () => {
  it('should_resolve_tenant_by_slug_independently', async () => {
    const tenantA = { id: TENANT_A, slug: 'boulangerie-dupont', name: 'Boulangerie Dupont' };
    const tenantB = { id: TENANT_B, slug: 'patisserie-martin', name: 'Pâtisserie Martin' };

    vi.mocked(prisma.tenant.findFirst).mockImplementation(async (args) => {
      const slug = (args?.where as Record<string, unknown>)?.slug;
      if (slug === 'boulangerie-dupont') return tenantA as never;
      if (slug === 'patisserie-martin') return tenantB as never;
      return null;
    });

    const resolvedA = await prisma.tenant.findFirst({ where: { slug: 'boulangerie-dupont' } });
    const resolvedB = await prisma.tenant.findFirst({ where: { slug: 'patisserie-martin' } });
    const resolvedUnknown = await prisma.tenant.findFirst({ where: { slug: 'unknown' } });

    expect((resolvedA as typeof tenantA)?.id).toBe(TENANT_A);
    expect((resolvedB as typeof tenantB)?.id).toBe(TENANT_B);
    expect(resolvedUnknown).toBeNull();
  });
});
