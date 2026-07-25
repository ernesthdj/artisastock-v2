import { z } from 'zod';
import { StockChannel } from '@prisma/client';

export const productChannelStockCreateSchema = z.object({
  bomStockId: z.string().cuid(),
  allocations: z
    .array(
      z.object({
        channel: z.nativeEnum(StockChannel),
        qty: z.number().min(0),
      })
    )
    .min(1)
    .refine((a) => a.some((x) => x.qty > 0), { message: 'Au moins un canal doit recevoir une quantité > 0' }),
});
