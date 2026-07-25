import { z } from 'zod';

const pinSchema = z.string().regex(/^\d{4}$/, 'Le PIN doit contenir exactement 4 chiffres');

export const caisseOpenSchema = z.object({
  vendeurId: z.string().cuid(),
  pin: pinSchema,
  openingFloat: z.number().nonnegative(),
});

export const caisseCloseSchema = z.object({
  vendeurId: z.string().cuid(),
  pin: pinSchema,
  closingFloat: z.number().nonnegative(),
});
