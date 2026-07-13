import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiSuccess, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { ALL_PERMISSIONS, PERMISSIONS } from '@/lib/constants/permissions';
import { z } from 'zod';

const roleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).refine(
    (perms) => perms.every((p) => ALL_PERMISSIONS.includes(p as never)),
    { message: 'Une ou plusieurs permissions sont invalides' }
  ),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'team.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where = { tenantId: ctx.tenantId };
    const [data, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: { _count: { select: { users: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.role.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'team.manage', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const existing = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    });
    if (existing) return apiError('CONFLICT', `Un rôle nommé "${parsed.data.name}" existe déjà`, 409);

    const role = await prisma.role.create({
      data: { ...parsed.data, tenantId: ctx.tenantId },
    });

    return apiCreated(role);
  });
}

// Route séparée pour lister toutes les permissions disponibles
export async function OPTIONS() {
  return apiSuccess(
    Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label }))
  );
}
