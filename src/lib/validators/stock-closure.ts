import { z } from 'zod';
import { StockChannel, ClosureReason } from '@prisma/client';

export const stockClosureCreateSchema = z.object({
  channel: z.nativeEnum(StockChannel),
  lines: z
    .array(
      z
        .object({
          reason: z.nativeEnum(ClosureReason),
          note: z.string().max(500).optional(),
          qty: z.number().positive(),
        })
        .refine((d) => d.reason !== 'OTHER' || !!d.note?.trim(), {
          message: 'Une note est requise pour le motif "Autre"',
          path: ['note'],
        })
    )
    .min(1),
});
