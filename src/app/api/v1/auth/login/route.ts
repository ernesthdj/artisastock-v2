import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';
import { loginSchema } from '@/lib/validators/auth';
import { apiSuccess, apiError } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
  }

  const { email, password, rememberMe } = parsed.data;

  // Chercher l'utilisateur (email peut exister dans plusieurs tenants — on prend le premier actif)
  const user = await prisma.user.findFirst({
    where: { email, isActive: true, deletedAt: null },
    include: { tenant: true, role: true },
  });

  // Réponse générique pour ne pas divulguer si l'email existe
  if (!user) {
    return apiError('INVALID_CREDENTIALS', 'Email ou mot de passe incorrect', 401);
  }

  if (!user.tenant.isActive) {
    return apiError('ACCOUNT_SUSPENDED', 'Ce compte a été désactivé', 403);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return apiError('INVALID_CREDENTIALS', 'Email ou mot de passe incorrect', 401);
  }

  const { accessToken, refreshToken } = await createSession(
    user.id,
    rememberMe,
    request.headers.get('user-agent') ?? undefined,
    request.headers.get('x-forwarded-for') ?? undefined
  );

  return apiSuccess({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      role: user.role?.name ?? null,
      onboardingDone: user.onboardingDone,
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      locale: user.tenant.locale,
      plan: user.tenant.plan,
    },
  });
}
