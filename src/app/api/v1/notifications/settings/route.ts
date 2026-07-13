import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';

const notificationSettingsSchema = z.object({
  emailOnNewOrder: z.boolean().optional(),
  emailOnStockAlert: z.boolean().optional(),
  emailOnOrderReady: z.boolean().optional(),
  stockAlertThresholdOverride: z.number().int().min(0).optional(),
});

export const GET = withAuth(async (
  _request: NextRequest,
  ctx: { tenantId: string }
) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true },
  });
  if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);

  const settings = tenant.settings as Record<string, unknown>;
  const notifications = (settings?.notifications ?? {
    emailOnNewOrder: true,
    emailOnStockAlert: true,
    emailOnOrderReady: true,
  }) as Record<string, unknown>;

  return apiSuccess(notifications);
});

export const PATCH = withAuth(async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = notificationSettingsSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true },
  });
  if (!tenant) return apiError('NOT_FOUND', 'Tenant introuvable', 404);

  const settings = tenant.settings as Record<string, unknown>;
  const currentNotifications = (settings?.notifications ?? {}) as Record<string, unknown>;

  const updatedNotifications = { ...currentNotifications, ...parsed.data };

  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { settings: { ...settings, notifications: updatedNotifications } },
  });

  return apiSuccess(updatedNotifications);
});
