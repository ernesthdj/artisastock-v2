import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';

const userUpdateSchema = z.object({
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'team.read', async (ctx) => {
  const user = await prisma.user.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      isActive: true, emailVerified: true, createdAt: true, lastLoginAt: true,
      role: { select: { id: true, name: true, permissions: true } },
    },
  });

  if (!user) return apiError('NOT_FOUND', 'Utilisateur introuvable', 404);

    return apiSuccess(user);
  });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'team.manage', async (ctx) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const user = await prisma.user.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!user) return apiError('NOT_FOUND', 'Utilisateur introuvable', 404);

  // Empêcher la désactivation de soi-même
  if (parsed.data.isActive === false && params.id === ctx.userId) {
    return apiError('SELF_DEACTIVATE', 'Impossible de désactiver votre propre compte', 400);
  }

  // Vérifier que le rôle cible appartient au tenant
  if (parsed.data.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: parsed.data.roleId, tenantId: ctx.tenantId },
    });
    if (!role) return apiError('NOT_FOUND', 'Rôle introuvable', 404);
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.roleId && { roleId: parsed.data.roleId }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.firstName && { firstName: parsed.data.firstName }),
      ...(parsed.data.lastName && { lastName: parsed.data.lastName }),
    },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      isActive: true, roleId: true, updatedAt: true,
    },
  });

  // Si désactivation, révoquer toutes les sessions
  if (parsed.data.isActive === false) {
    await prisma.session.deleteMany({ where: { userId: params.id } });
  }

    return apiSuccess(updated);
  });
}
