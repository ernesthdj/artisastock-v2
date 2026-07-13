import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiSuccess, apiError } from '@/lib/permissions';
import { DayOfWeek } from '@prisma/client';
import { z } from 'zod';

const pickupSlotSchema = z.object({
  dayOfWeek: z.nativeEnum(DayOfWeek),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDuration: z.number().int().min(10).max(120).default(30),
  maxOrders: z.number().int().min(1).max(100).default(5),
  minAdvanceHours: z.number().int().min(0).max(168).default(24),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'settings.read', async (ctx) => {
    const slots = await prisma.pickupSlot.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return apiSuccess(slots);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'settings.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = pickupSlotSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const slot = await prisma.pickupSlot.create({
      data: { ...parsed.data, tenantId: ctx.tenantId },
    });

    return apiCreated(slot);
  });
}
