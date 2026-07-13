import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';

const AVAILABLE_TEMPLATES = ['artisan', 'modern', 'classic', 'minimal'] as const;

const templateSchema = z.object({
  template: z.enum(AVAILABLE_TEMPLATES),
});

export const PATCH = withPermission('cms:write', async (
  request: NextRequest,
  ctx: { tenantId: string }
) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const config = await prisma.siteConfig.update({
    where: { tenantId: ctx.tenantId },
    data: { template: parsed.data.template, isPublished: false },
    select: { template: true, isPublished: true },
  });

  return apiSuccess({ ...config, availableTemplates: AVAILABLE_TEMPLATES });
});
