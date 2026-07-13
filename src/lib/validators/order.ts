import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const checkoutSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().max(30).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1, 'Le panier est vide'),
  pickupSlot: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:mm)'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:mm)'),
  }),
  locale: z.enum(['fr', 'nl']).default('fr'),
  cgvAccepted: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les CGV' }) }),
  notes: z.string().max(500).optional(),
});

export const orderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});
