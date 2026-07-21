import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/permissions';
import { addDays, parseISO, format, getDay } from 'date-fns';
import { DayOfWeek } from '@prisma/client';

const DAY_MAP: Record<number, DayOfWeek> = {
  1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY',
  5: 'FRIDAY', 6: 'SATURDAY', 0: 'SUNDAY',
};

export async function GET(request: NextRequest, props: { params: Promise<{ tenantSlug: string }> }) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug, isActive: true },
    select: { id: true },
  });

  if (!tenant) return apiError('NOT_FOUND', 'Vitrine introuvable', 404);

  const sp = request.nextUrl.searchParams;
  const dateParam = sp.get('date') ?? format(new Date(), 'yyyy-MM-dd');
  const days = Math.min(14, Math.max(1, parseInt(sp.get('days') ?? '7', 10)));

  const startDate = parseISO(dateParam);
  const endDate = addDays(startDate, days);

  const [slots, closedDays] = await Promise.all([
    prisma.pickupSlot.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.closedDay.findMany({
      where: { tenantId: tenant.id, date: { gte: startDate, lte: endDate } },
    }),
  ]);

  const closedDates = new Set(closedDays.map((d) => format(d.date, 'yyyy-MM-dd')));
  const available: Array<{
    date: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    maxOrders: number;
    ordersCount: number;
    available: boolean;
  }> = [];

  let current = startDate;
  while (current < endDate) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const dayOfWeek = DAY_MAP[getDay(current)];

    if (!closedDates.has(dateStr)) {
      const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);

      for (const slot of daySlots) {
        // Compter les commandes déjà sur ce créneau
        const slotStart = new Date(`${dateStr}T${slot.startTime}:00`);
        const slotEnd = new Date(`${dateStr}T${slot.endTime}:00`);

        const ordersCount = await prisma.order.count({
          where: {
            tenantId: tenant.id,
            pickupDate: new Date(dateStr),
            pickupSlotStart: slotStart,
            status: { notIn: ['CANCELLED'] },
          },
        });

        // Vérifier le délai minimum
        const minAdvanceMs = slot.minAdvanceHours * 60 * 60 * 1000;
        const isEnoughAdvance = slotStart.getTime() - Date.now() >= minAdvanceMs;

        if (isEnoughAdvance) {
          available.push({
            date: dateStr,
            dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxOrders: slot.maxOrders,
            ordersCount,
            available: ordersCount < slot.maxOrders,
          });
        }
      }
    }

    current = addDays(current, 1);
  }

  return apiSuccess(available);
}
