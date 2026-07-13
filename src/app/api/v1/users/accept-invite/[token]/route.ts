import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';
import { resetPasswordSchema } from '@/lib/validators/auth';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const invitation = await prisma.userInvitation.findUnique({
    where: { token: params.token },
    include: { tenant: { select: { id: true, slug: true } } },
  });

  if (!invitation) return apiError('INVALID_TOKEN', 'Invitation invalide ou expirée', 400);
  if (invitation.expiresAt < new Date()) {
    await prisma.userInvitation.delete({ where: { id: invitation.id } });
    return apiError('TOKEN_EXPIRED', 'Cette invitation a expiré', 400);
  }
  if (invitation.acceptedAt) {
    return apiError('ALREADY_ACCEPTED', 'Cette invitation a déjà été acceptée', 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: invitation.userId },
      data: {
        passwordHash,
        isActive: true,
        emailVerified: true,
      },
    }),
    prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  const rememberMe = false;
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined;

  const { accessToken, refreshToken } = await createSession(user.id, userAgent, ip, rememberMe);

  return apiSuccess({ accessToken, refreshToken, tenantSlug: invitation.tenant.slug });
}
