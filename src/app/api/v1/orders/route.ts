import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, apiError, apiPaginated, parsePagination } from '@/lib/permissions';
import { OrderStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  return withPermission(request, 'orders.read', async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const { page, pageSize, skip, sortBy, sortOrder } = parsePagination(sp);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (sp.get('status')) where['status'] = sp.get('status') as OrderStatus;
    if (sp.get('customerId')) where['customerId'] = sp.get('customerId');
    if (sp.get('dateFrom') || sp.get('dateTo')) {
      where['createdAt'] = {};
      if (sp.get('dateFrom')) (where['createdAt'] as Record<string, unknown>)['gte'] = new Date(sp.get('dateFrom')!);
      if (sp.get('dateTo')) (where['createdAt'] as Record<string, unknown>)['lte'] = new Date(sp.get('dateTo')!);
    }

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return apiPaginated(data, page, pageSize, total);
  });
}
