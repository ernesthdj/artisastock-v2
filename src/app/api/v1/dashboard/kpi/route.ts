import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, apiSuccess } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return withAuth(request, async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [ordersToday, revenueToday, revenueMonth, stockAlerts, recentOrders] = await Promise.all([
      prisma.order.count({
        where: { tenantId: ctx.tenantId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
      }),
      prisma.order.aggregate({
        where: { tenantId: ctx.tenantId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        _sum: { totalTTC: true },
      }),
      prisma.order.aggregate({
        where: { tenantId: ctx.tenantId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        _sum: { totalTTC: true },
      }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count
        FROM "Ingredient"
        WHERE "tenantId" = ${ctx.tenantId}
          AND "isActive" = true
          AND "deletedAt" IS NULL
          AND "isAlertActive" = true
          AND stock <= "alertThreshold"
      `,
      prisma.order.findMany({
        where: { tenantId: ctx.tenantId, status: { not: 'CANCELLED' } },
        include: { customer: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return apiSuccess({
      ordersToday,
      revenueToday: Number(revenueToday._sum.totalTTC ?? 0),
      revenueMonth: Number(revenueMonth._sum.totalTTC ?? 0),
      stockAlerts: Number(stockAlerts[0]?.count ?? 0),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: `${o.customer.firstName} ${o.customer.lastName}`,
        totalTTC: Number(o.totalTTC),
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  });
}
