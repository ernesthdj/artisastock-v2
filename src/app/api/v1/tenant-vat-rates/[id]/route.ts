// GET/PATCH /api/v1/tenant-vat-rates/[id]

import { NextRequest } from 'next/server';
import { getPrismaWithTenant } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { tenantVatRateUpdateSchema } from '@/lib/validators/tenant-vat-rate';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withPermission(request, 'tenant-vat-rates.read', async (ctx) => {
    const db = getPrismaWithTenant(ctx.tenantId);

    const vatRate = await db.tenantVatRate.findUnique({ where: { id } });
    if (!vatRate) return apiError('NOT_FOUND', 'Taux de TVA introuvable', 404);

    return apiSuccess(vatRate);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withPermission(request, 'tenant-vat-rates.write', async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = tenantVatRateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const db = getPrismaWithTenant(ctx.tenantId);

    const existing = await db.tenantVatRate.findUnique({ where: { id } });
    if (!existing) return apiError('NOT_FOUND', 'Taux de TVA introuvable', 404);

    if (parsed.data.label && parsed.data.label !== existing.label) {
      const duplicate = await db.tenantVatRate.findUnique({
        where: { tenantId_label: { tenantId: ctx.tenantId, label: parsed.data.label } },
      });
      if (duplicate) {
        return apiError('CONFLICT', `Un taux de TVA nommé "${parsed.data.label}" existe déjà`, 409);
      }
    }

    const vatRate = await db.tenantVatRate.update({
      where: { id },
      data: parsed.data,
    });

    return apiSuccess(vatRate);
  });
}
