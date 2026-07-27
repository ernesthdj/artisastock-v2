import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSession } from '@/lib/auth';
import { registerSchema } from '@/lib/validators/auth';
import { generateTenantSlug } from '@/lib/utils/slug';
import { apiCreated, apiError } from '@/lib/permissions';
import { ALL_PERMISSIONS } from '@/lib/constants/permissions';
import { sendVerificationEmail } from '@/lib/email';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
  }

  const { businessName, firstName, lastName, email, password, locale } = parsed.data;

  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    return apiError('CONFLICT', 'Un compte avec cet email existe déjà', 409);
  }

  const slug = await generateUniqueSlug(businessName);
  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: businessName,
        slug,
        locale,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const adminRole = await tx.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Admin',
        description: 'Accès complet',
        permissions: ALL_PERMISSIONS,
        isSystem: true,
      },
    });

    // Modèles de rôle prêts à l'emploi pour l'équipe (docs/modules/EQUIPE.md §6) — l'admin
    // peut les ajuster ensuite comme n'importe quel rôle custom, rien n'est figé.
    await tx.role.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'Artisan',
          description: 'Production et stock — recettes, BOM, ingrédients, achats',
          permissions: [
            'ingredients.read', 'ingredients.write',
            'recipes.read', 'recipes.write',
            'bom.read', 'bom.write', 'bom.produce',
            'activites.read', 'stocks.read',
            'achats.read', 'achats.write',
          ],
        },
        {
          tenantId: tenant.id,
          name: 'Responsable',
          description: 'Supervision — ventes, commandes, factures, équipe (lecture)',
          permissions: [
            'pos.read', 'orders.read', 'orders.manage',
            'invoices.read', 'team.read',
            'activites.read', 'stocks.read',
          ],
        },
        {
          tenantId: tenant.id,
          name: 'RH',
          description: 'Accès équipe — à étendre quand le module RH existera',
          permissions: ['team.read'],
        },
      ],
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        firstName,
        lastName,
        locale,
        roleId: adminRole.id,
      },
    });

    await tx.siteConfig.create({
      data: {
        tenantId: tenant.id,
        template: 'boulangerie',
        colors: {
          primary: '#8B4513',
          secondary: '#DEB887',
          accent: '#D2691E',
          background: '#FFF8F0',
          text: '#2D1810',
        },
        fonts: { heading: 'Playfair Display', body: 'Inter' },
      },
    });

    await tx.page.create({
      data: {
        tenantId: tenant.id,
        title: 'Accueil',
        slug: 'accueil',
        isSystem: true,
        sortOrder: 0,
        blocks: [],
      },
    });

    return { tenant, user };
  });

  // Email de vérification
  const verificationToken = nanoid(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: result.user.id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail({
    to: email,
    firstName,
    token: verificationToken,
  });

  const { accessToken, refreshToken } = await createSession(
    result.user.id,
    false,
    request.headers.get('user-agent') ?? undefined,
    request.headers.get('x-forwarded-for') ?? undefined
  );

  return apiCreated({
    accessToken,
    refreshToken,
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
    },
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
    },
  });
}

async function generateUniqueSlug(businessName: string): Promise<string> {
  const base = generateTenantSlug(businessName);
  let slug = base;
  let counter = 1;

  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
  }

  return slug;
}
