import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';

const gdprRequestSchema = z.object({
  type: z.enum(['EXPORT', 'DELETE', 'RECTIFICATION']),
  email: z.string().email(),
  details: z.string().max(1000).optional(),
});

// Route publique — demande RGPD côté vitrine
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantSlug: string } }
) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = gdprRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const customer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, email: parsed.data.email },
  });

  // Ne pas révéler si l'email existe — toujours répondre 201
  if (customer) {
    await prisma.gdprRequest.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        type: parsed.data.type,
        status: 'PENDING',
        details: parsed.data.details ?? null,
      },
    });
  }

  return apiSuccess({ submitted: true });
}
