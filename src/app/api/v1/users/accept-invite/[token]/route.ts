import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';
import { passwordSchema } from '@/lib/validators/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';

const acceptInviteSchema = z.object({
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const invitation = await prisma.userInvitation.findUnique({
    where: { token: params.token },
  });

  if (!invitation) return apiError('INVALID_TOKEN', 'Invitation invalide ou expirée', 400);
  if (invitation.expiresAt < new Date()) {
    await prisma.userInvitation.delete({ where: { id: invitation.id } });
    return apiError('TOKEN_EXPIRED', 'Cette invitation a expiré', 400);
  }
  if (invitation.usedAt) {
    return apiError('ALREADY_ACCEPTED', 'Cette invitation a déjà été acceptée', 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        tenantId: invitation.tenantId,
        email: invitation.email,
        passwordHash,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        roleId: invitation.roleId,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    }),
  ]);

  const tenant = await prisma.tenant.findUnique({ where: { id: invitation.tenantId }, select: { slug: true } });

  const userAgent = request.headers.get('user-agent') ?? undefined;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined;

  const { accessToken, refreshToken } = await createSession(user.id, false, userAgent, ip);

  return apiSuccess({ accessToken, refreshToken, tenantSlug: tenant?.slug });
}
