import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError, apiNoContent } from '@/lib/permissions';
import { z } from 'zod';

const slotUpdateSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxOrders: z.number().int().min(1).optional(),
  minAdvanceHours: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'settings.write', async (ctx) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = slotUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const slot = await prisma.pickupSlot.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!slot) return apiError('NOT_FOUND', 'Créneau introuvable', 404);

  const updated = await prisma.pickupSlot.update({
    where: { id: params.id },
    data: parsed.data,
  });

    return apiSuccess(updated);
  });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'settings.write', async (ctx) => {
  const slot = await prisma.pickupSlot.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!slot) return apiError('NOT_FOUND', 'Créneau introuvable', 404);

  await prisma.pickupSlot.delete({ where: { id: params.id } });

    return apiNoContent();
  });
}
