import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiSuccess } from '@/lib/permissions';
import { z } from 'zod';
import { generateSlug } from '@/lib/utils/slug';

const pageCreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  metaDescription: z.string().max(300).optional(),
  blocks: z.array(z.record(z.unknown())).default([]),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'cms.read', async (ctx) => {
    const pages = await prisma.page.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    return apiSuccess(pages);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'cms.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = pageCreateSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const slug = parsed.data.slug ?? generateSlug(parsed.data.title);

    const existing = await prisma.page.findUnique({
      where: { tenantId_slug: { tenantId: ctx.tenantId, slug } },
    });
    if (existing) return apiError('CONFLICT', `Une page avec le slug "${slug}" existe déjà`, 409);

    const maxOrder = await prisma.page.aggregate({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const page = await prisma.page.create({
      data: {
        tenantId: ctx.tenantId,
        title: parsed.data.title,
        slug,
        metaDescription: parsed.data.metaDescription,
        blocks: parsed.data.blocks as unknown as Prisma.InputJsonValue,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return apiCreated(page);
  });
}
