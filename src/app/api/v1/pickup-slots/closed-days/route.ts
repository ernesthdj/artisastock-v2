import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiCreated, apiError } from '@/lib/permissions';
import { z } from 'zod';
import { parseISO, addMonths, format } from 'date-fns';

const closedDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  reason: z.string().max(200).optional(),
});

export const GET = withPermission('settings:read', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from') ? parseISO(sp.get('from')!) : new Date();
  const to = sp.get('to') ? parseISO(sp.get('to')!) : addMonths(from, 3);

  const closedDays = await prisma.closedDay.findMany({
    where: { tenantId: ctx.tenantId, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });

  return apiSuccess(closedDays.map((d) => ({ ...d, date: format(d.date, 'yyyy-MM-dd') })));
});

export const POST = withPermission('settings:write', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = closedDaySchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const date = parseISO(parsed.data.date);

  const existing = await prisma.closedDay.findFirst({
    where: { tenantId: ctx.tenantId, date },
  });
  if (existing) return apiError('DUPLICATE', 'Ce jour est déjà marqué comme fermé', 409);

  const closedDay = await prisma.closedDay.create({
    data: { tenantId: ctx.tenantId, date, reason: parsed.data.reason ?? null },
  });

  return apiCreated({ ...closedDay, date: format(closedDay.date, 'yyyy-MM-dd') });
});

export const DELETE = withPermission('settings:write', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  const date = request.nextUrl.searchParams.get('date');
  if (!date) return apiError('MISSING_PARAM', 'Paramètre date requis', 400);

  const parsedDate = parseISO(date);
  const deleted = await prisma.closedDay.deleteMany({
    where: { tenantId: ctx.tenantId, date: parsedDate },
  });

  if (deleted.count === 0) return apiError('NOT_FOUND', 'Jour fermé introuvable', 404);

  return apiSuccess({ deleted: deleted.count });
});
