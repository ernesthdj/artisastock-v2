import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';
import { addressSchema, vatNumberSchema } from '@/lib/validators/common';

const tenantUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  vatNumber: vatNumberSchema,
  address: addressSchema,
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  description: z.string().max(1000).optional(),
  openingHours: z.record(z.union([
    z.object({ open: z.string(), close: z.string() }),
    z.null(),
  ])).optional(),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'settings.read', async (ctx) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: {
        id: true, name: true, slug: true, plan: true, locale: true,
        vatNumber: true, address: true, phone: true, email: true,
        description: true, openingHours: true, settings: true,
        trialEndsAt: true, isActive: true, createdAt: true,
      },
    });

    if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);
    return apiSuccess(tenant);
  });
}

export async function PATCH(request: NextRequest) {
  return withPermission(request, 'settings.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = tenantUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const tenant = await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: parsed.data,
      select: {
        id: true, name: true, slug: true, plan: true, locale: true,
        vatNumber: true, address: true, phone: true, email: true,
        description: true, openingHours: true,
      },
    });

    return apiSuccess(tenant);
  });
}
