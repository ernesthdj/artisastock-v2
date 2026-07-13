import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError, apiNoContent } from '@/lib/permissions';
import { z } from 'zod';
import { generateSlug } from '@/lib/utils/slug';

const pageUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug invalide').optional(),
  isVisible: z.boolean().optional(),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(160).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const GET = withPermission('cms:read', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const page = await prisma.page.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
  });

  if (!page) return apiError('NOT_FOUND', 'Page introuvable', 404);

  return apiSuccess(page);
});

export const PATCH = withPermission('cms:write', async (
  request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const parsed = pageUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

  const page = await prisma.page.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!page) return apiError('NOT_FOUND', 'Page introuvable', 404);

  const targetSlug = parsed.data.slug ?? (parsed.data.title ? generateSlug(parsed.data.title) : undefined);

  if (targetSlug && targetSlug !== page.slug) {
    const duplicate = await prisma.page.findFirst({
      where: { tenantId: ctx.tenantId, slug: targetSlug, id: { not: params.id }, deletedAt: null },
    });
    if (duplicate) return apiError('DUPLICATE', 'Une page avec ce slug existe déjà', 409);
  }

  const updated = await prisma.page.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.title && { title: parsed.data.title }),
      ...(targetSlug && { slug: targetSlug }),
      ...(parsed.data.isVisible !== undefined && { isVisible: parsed.data.isVisible }),
      ...(parsed.data.seoTitle !== undefined && { seoTitle: parsed.data.seoTitle }),
      ...(parsed.data.seoDescription !== undefined && { seoDescription: parsed.data.seoDescription }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  return apiSuccess(updated);
});

export const DELETE = withPermission('cms:write', async (
  _request: NextRequest,
  ctx: { tenantId: string },
  { params }: { params: { id: string } }
) => {
  const page = await prisma.page.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!page) return apiError('NOT_FOUND', 'Page introuvable', 404);

  // Soft delete
  await prisma.page.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  return apiNoContent();
});
