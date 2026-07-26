import { z } from 'zod';

const pinSchema = z.string().regex(/^\d{4}$/, 'Le PIN doit contenir exactement 4 chiffres');

export const posSaleSchema = z.object({
  vendeurId: z.string().cuid(),
  pin: pinSchema,
  sessionCaisseId: z.string().cuid(),
  paymentMethod: z.enum(['CASH', 'CARD']),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Au moins un article requis'),
});
