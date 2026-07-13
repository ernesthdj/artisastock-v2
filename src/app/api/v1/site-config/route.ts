import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';

const siteConfigUpdateSchema = z.object({
  logo: z.string().url().optional(),
  favicon: z.string().url().optional(),
  colors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).optional(),
  fonts: z.object({
    heading: z.string().max(100).optional(),
    body: z.string().max(100).optional(),
  }).optional(),
  socialLinks: z.object({
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    twitter: z.string().url().optional(),
    website: z.string().url().optional(),
  }).optional(),
});

const templateChangeSchema = z.object({
  template: z.enum(['boulangerie', 'patisserie', 'traiteur']),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'cms.read', async (ctx) => {
    const config = await prisma.siteConfig.findUnique({ where: { tenantId: ctx.tenantId } });
    if (!config) return apiError('NOT_FOUND', 'Configuration introuvable', 404);
    return apiSuccess(config);
  });
}

export async function PATCH(request: NextRequest) {
  return withPermission(request, 'cms.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = siteConfigUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const existing = await prisma.siteConfig.findUnique({ where: { tenantId: ctx.tenantId } });
    if (!existing) return apiError('NOT_FOUND', 'Configuration introuvable', 404);

    const config = await prisma.siteConfig.update({
      where: { tenantId: ctx.tenantId },
      data: {
        ...(parsed.data.logo !== undefined ? { logo: parsed.data.logo } : {}),
        ...(parsed.data.favicon !== undefined ? { favicon: parsed.data.favicon } : {}),
        ...(parsed.data.colors !== undefined ? { colors: { ...(existing.colors as object), ...parsed.data.colors } } : {}),
        ...(parsed.data.fonts !== undefined ? { fonts: { ...(existing.fonts as object), ...parsed.data.fonts } } : {}),
        ...(parsed.data.socialLinks !== undefined ? { socialLinks: { ...(existing.socialLinks as object), ...parsed.data.socialLinks } } : {}),
        // Marquer comme non publié suite à modification
        isPublished: false,
      },
    });

    return apiSuccess(config);
  });
}
