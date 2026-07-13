import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiCreated, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { z } from 'zod';

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.object({
    street: z.string(), number: z.string(), zip: z.string(), city: z.string(), country: z.string().default('BE'),
  }).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  vatNumber: z.string().optional(),
  contactName: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  return withPermission(request, 'ingredients.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId, isActive: true, deletedAt: null };
    if (sp.get('search')) where['name'] = { contains: sp.get('search'), mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: pageSize }),
      prisma.supplier.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'ingredients.write', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const existing = await prisma.supplier.findUnique({
      where: { tenantId_name: { tenantId: ctx.tenantId, name: parsed.data.name } },
    });
    if (existing) return apiError('CONFLICT', `Un fournisseur nommé "${parsed.data.name}" existe déjà`, 409);

    const supplier = await prisma.supplier.create({
      data: { ...parsed.data, tenantId: ctx.tenantId },
    });

    return apiCreated(supplier);
  });
}
