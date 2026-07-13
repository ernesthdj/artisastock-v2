import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiCreated, apiError, parsePagination } from '@/lib/permissions';
import { z } from 'zod';

const gdprRequestSchema = z.object({
  type: z.enum(['EXPORT', 'DELETE', 'RECTIFICATION']),
  customerEmail: z.string().email(),
  details: z.string().max(1000).optional(),
});

// Liste des demandes RGPD — côté admin
export const GET = withPermission('settings:read', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  const sp = request.nextUrl.searchParams;
  const { page, pageSize, skip } = parsePagination(sp);
  const status = sp.get('status') ?? undefined;

  const where: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (status) where['status'] = status;

  const [data, total] = await Promise.all([
    prisma.gdprRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.gdprRequest.count({ where }),
  ]);

  return apiSuccess({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});

// Créer une demande RGPD manuellement (admin)
export const POST = withPermission('settings:write', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = gdprRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const customer = await prisma.customer.findFirst({
    where: { tenantId: ctx.tenantId, email: parsed.data.customerEmail },
  });
  if (!customer) return apiError('NOT_FOUND', 'Client introuvable', 404);

  const gdprRequest = await prisma.gdprRequest.create({
    data: {
      tenantId: ctx.tenantId,
      customerId: customer.id,
      type: parsed.data.type,
      status: 'PENDING',
      details: parsed.data.details ?? null,
    },
  });

  return apiCreated(gdprRequest);
});
