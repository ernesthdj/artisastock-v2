import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError, apiNoContent } from '@/lib/permissions';
import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/lib/constants/permissions';

const roleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

export const GET = withPermission('roles:read', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const role = await prisma.role.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    include: { _count: { select: { users: true } } },
  });

  if (!role) return apiError('NOT_FOUND', 'Rôle introuvable', 404);

  return apiSuccess(role);
});

export const PATCH = withPermission('roles:manage', async (
  request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = roleUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const existing = await prisma.role.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!existing) return apiError('NOT_FOUND', 'Rôle introuvable', 404);

  // Vérifier doublon de nom
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.role.findFirst({
      where: { tenantId: ctx.tenantId, name: parsed.data.name, id: { not: params.id } },
    });
    if (duplicate) return apiError('DUPLICATE', 'Un rôle avec ce nom existe déjà', 409);
  }

  const updated = await prisma.role.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.permissions && { permissions: parsed.data.permissions }),
    },
  });

  return apiSuccess(updated);
});

export const DELETE = withPermission('roles:manage', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const role = await prisma.role.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    include: { _count: { select: { users: true } } },
  });

  if (!role) return apiError('NOT_FOUND', 'Rôle introuvable', 404);
  if (role._count.users > 0) {
    return apiError('ROLE_IN_USE', `Ce rôle est assigné à ${role._count.users} utilisateur(s)`, 409);
  }

  await prisma.role.delete({ where: { id: params.id } });

  return apiNoContent();
});
