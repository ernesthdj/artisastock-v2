import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess, apiError } from '@/lib/permissions';
import { updateProfileSchema } from '@/lib/validators/auth';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { role: true, tenant: { select: { id: true, name: true, slug: true, plan: true } } },
    });

    if (!user) return apiError('NOT_FOUND', 'Utilisateur introuvable', 404);

    return apiSuccess({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      emailVerified: user.emailVerified,
      onboardingDone: user.onboardingDone,
      role: user.role ? { id: user.role.id, name: user.role.name, permissions: user.role.permissions } : null,
      tenant: user.tenant,
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const user = await prisma.user.update({
      where: { id: ctx.userId },
      data: parsed.data,
    });

    return apiSuccess({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
    });
  });
}
