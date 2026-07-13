import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { InvoiceStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  return withPermission(request, 'invoices.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (sp.get('status')) where['status'] = sp.get('status') as InvoiceStatus;
    if (sp.get('dateFrom') || sp.get('dateTo')) {
      where['issuedAt'] = {};
      if (sp.get('dateFrom')) (where['issuedAt'] as Record<string, unknown>)['gte'] = new Date(sp.get('dateFrom')!);
      if (sp.get('dateTo')) (where['issuedAt'] as Record<string, unknown>)['lte'] = new Date(sp.get('dateTo')!);
    }
    if (sp.get('minAmount')) where['totalTTC'] = { ...((where['totalTTC'] as object) ?? {}), gte: parseFloat(sp.get('minAmount')!) };
    if (sp.get('maxAmount')) where['totalTTC'] = { ...((where['totalTTC'] as object) ?? {}), lte: parseFloat(sp.get('maxAmount')!) };

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { [sortBy === 'createdAt' ? 'issuedAt' : sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}
