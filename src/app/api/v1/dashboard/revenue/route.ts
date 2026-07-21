import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess } from '@/lib/permissions';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx) => {
  const sp = request.nextUrl.searchParams;
  const period = sp.get('period') ?? 'month'; // day | month | year
  const months = Math.min(12, Math.max(1, parseInt(sp.get('months') ?? '6', 10)));

  const now = new Date();
  const data: Array<{ period: string; totalTTC: number; ordersCount: number }> = [];

  if (period === 'month') {
    for (let i = months - 1; i >= 0; i--) {
      const target = subMonths(now, i);
      const start = startOfMonth(target);
      const end = endOfMonth(target);

      const result = await prisma.order.aggregate({
        where: {
          tenantId: ctx.tenantId,
          paidAt: { gte: start, lte: end },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { totalTTC: true },
        _count: { id: true },
      });

      data.push({
        period: format(target, 'yyyy-MM'),
        totalTTC: Number(result._sum.totalTTC ?? 0),
        ordersCount: result._count.id,
      });
    }
  } else if (period === 'day') {
    const days = Math.min(30, Math.max(1, parseInt(sp.get('days') ?? '7', 10)));
    for (let i = days - 1; i >= 0; i--) {
      const target = new Date(now);
      target.setDate(target.getDate() - i);
      const start = startOfDay(target);
      const end = endOfDay(target);

      const result = await prisma.order.aggregate({
        where: {
          tenantId: ctx.tenantId,
          paidAt: { gte: start, lte: end },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { totalTTC: true },
        _count: { id: true },
      });

      data.push({
        period: format(target, 'yyyy-MM-dd'),
        totalTTC: Number(result._sum.totalTTC ?? 0),
        ordersCount: result._count.id,
      });
    }
  }

    return apiSuccess(data);
  });
}
