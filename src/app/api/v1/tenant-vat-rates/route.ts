// GET /api/v1/tenant-vat-rates — Liste des taux de TVA de l'Activité (inclut les inactifs)
// POST /api/v1/tenant-vat-rates — Créer un taux de TVA

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { tenantVatRateCreateSchema } from '@/lib/validators/tenant-vat-rate';

export async function GET(request: NextRequest) {
  return withPermission(request, 'tenant-vat-rates.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip } = parsePagination(sp);

    const [data, total] = await Promise.all([
      db.tenantVatRate.findMany({
        orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
        skip,
        take: pageSize,
      }),
      db.tenantVatRate.count({}),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'tenant-vat-rates.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = tenantVatRateCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const db = getPrismaWithTenant(ctx.tenantId);

    const existing = await db.tenantVatRate.findUnique({
      where: { tenantId_label: { tenantId: ctx.tenantId, label: parsed.data.label } },
    });
    if (existing) {
      return apiError('CONFLICT', `Un taux de TVA nommé "${parsed.data.label}" existe déjà`, 409);
    }

    const vatRate = await db.tenantVatRate.create({
      data: {
        tenantId: ctx.tenantId,
        label: parsed.data.label,
        ratePercent: parsed.data.ratePercent,
        isActive: parsed.data.isActive,
      },
    });

    return apiCreated(vatRate);
  });
}
