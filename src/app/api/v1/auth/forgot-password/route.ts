import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { forgotPasswordSchema } from '@/lib/validators/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { apiSuccess, apiError } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
  }

  const { email } = parsed.data;

  // Toujours retourner le même message pour ne pas divulguer l'existence du compte
  const user = await prisma.user.findFirst({ where: { email, isActive: true, deletedAt: null } });

  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = nanoid(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 heure
      },
    });

    await sendPasswordResetEmail({
      to: email,
      firstName: user.firstName,
      token,
    });
  }

  return apiSuccess({
    message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
  });
}
