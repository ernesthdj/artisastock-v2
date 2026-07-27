// GET /api/v1/pos/vendeurs — Liste des vendeurs (picker comptoir + admin)
// POST /api/v1/pos/vendeurs — Créer un vendeur (admin)

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { vendeurCreateSchema } from '@/lib/validators/vendeur';
import { hashPassword } from '@/lib/auth';
import { isPinTaken } from '@/lib/pos/vendeur-auth';

export async function GET(request: NextRequest) {
  return withPermission(request, ['pos.sell', 'pos.manage'], async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip } = parsePagination(sp);

    const where: Record<string, unknown> = {};
    if (sp.get('activeOnly') === 'true') where['isActive'] = true;

    const [data, total] = await Promise.all([
      db.vendeur.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, isActive: true, lockedUntil: true, createdAt: true },
        orderBy: { firstName: 'asc' },
        skip,
        take: pageSize,
      }),
      db.vendeur.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'pos.manage', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = vendeurCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    if (await isPinTaken(ctx.tenantId, parsed.data.pin)) {
      return apiError('PIN_TAKEN', 'Ce PIN est déjà utilisé par un autre vendeur', 409);
    }

    const db = getPrismaWithTenant(ctx.tenantId);
    const pinHash = await hashPassword(parsed.data.pin);

    const vendeur = await db.vendeur.create({
      data: { tenantId: ctx.tenantId, firstName: parsed.data.firstName, lastName: parsed.data.lastName, pinHash },
      select: { id: true, firstName: true, lastName: true, isActive: true, createdAt: true },
    });

    return apiCreated(vendeur);
  });
}
