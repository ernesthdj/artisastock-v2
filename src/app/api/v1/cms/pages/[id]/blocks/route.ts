import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { z } from 'zod';
import DOMPurify from 'dompurify';

const blocksUpdateSchema = z.object({
  blocks: z.array(z.object({
    id: z.string().min(1),
    type: z.string(),
    order: z.number().int().min(0),
    visible: z.boolean(),
    config: z.record(z.unknown()),
  })),
});

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'cms.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = blocksUpdateSchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);

    const page = await prisma.page.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!page) return apiError('NOT_FOUND', 'Page introuvable', 404);

    // Sanitize les blocs HTML custom pour éviter XSS
    const sanitizedBlocks = parsed.data.blocks.map((block) => {
      if (block.type === 'CUSTOM_HTML' && typeof block.config['html'] === 'string') {
        return {
          ...block,
          config: { ...block.config, html: DOMPurify.sanitize(block.config['html'] as string) },
        };
      }
      if (block.type === 'TEXT' && typeof block.config['content'] === 'string') {
        return {
          ...block,
          config: { ...block.config, content: DOMPurify.sanitize(block.config['content'] as string) },
        };
      }
      return block;
    });

    const updated = await prisma.page.update({
      where: { id: params.id },
      data: { blocks: sanitizedBlocks as unknown as Prisma.InputJsonValue },
    });

    return apiSuccess(updated);
  });
}
