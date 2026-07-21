import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiSuccess, apiNoContent, apiError } from '@/lib/permissions';
import { z } from 'zod';

const supplierUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.object({
    street: z.string(), number: z.string(), zip: z.string(), city: z.string(), country: z.string(),
  }).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  vatNumber: z.string().optional(),
  contactName: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'ingredients.read', async (ctx) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null },
      include: { ingredients: { where: { isActive: true, deletedAt: null }, select: { id: true, name: true, unit: true, stock: true } } },
    });

    if (!supplier) return apiError('NOT_FOUND', 'Fournisseur introuvable', 404);
    return apiSuccess(supplier);
  });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'ingredients.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = supplierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.supplier.findFirst({ where: { id: params.id, tenantId: ctx.tenantId } });
    if (!existing) return apiError('NOT_FOUND', 'Fournisseur introuvable', 404);

    const supplier = await prisma.supplier.update({ where: { id: params.id }, data: parsed.data });
    return apiSuccess(supplier);
  });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withPermission(request, 'ingredients.delete', async (ctx) => {
    const existing = await prisma.supplier.findFirst({ where: { id: params.id, tenantId: ctx.tenantId, deletedAt: null } });
    if (!existing) return apiError('NOT_FOUND', 'Fournisseur introuvable', 404);

    await prisma.supplier.update({ where: { id: params.id }, data: { deletedAt: new Date(), isActive: false } });
    return apiNoContent();
  });
}
