import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { nanoid } from 'nanoid';
import { sendEmployeeInviteEmail } from '@/lib/email';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'team.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId, deletedAt: null };
    if (sp.get('isActive')) where['isActive'] = sp.get('isActive') === 'true';

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          locale: true, isActive: true, lastLoginAt: true, createdAt: true,
          role: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'team.manage', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const inviter = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { firstName: true, lastName: true, tenant: { select: { name: true } } },
    });
    if (!inviter) return apiError('NOT_FOUND', 'Utilisateur introuvable', 404);

    const token = nanoid(32);
    await prisma.userInvitation.create({
      data: {
        tenantId: ctx.tenantId,
        email: parsed.data.email,
        roleId: parsed.data.roleId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: ctx.userId,
      },
    });

    await sendEmployeeInviteEmail({
      to: parsed.data.email,
      inviterName: `${inviter.firstName} ${inviter.lastName}`,
      tenantName: inviter.tenant.name,
      token,
    });

    return apiCreated({ message: 'Invitation envoyée avec succès', email: parsed.data.email });
  });
}
