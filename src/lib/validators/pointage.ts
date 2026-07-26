import { z } from 'zod';

const pinSchema = z.string().regex(/^\d{4}$/, 'Le PIN doit contenir exactement 4 chiffres');

export const pointageActionSchema = z.object({
  pin: pinSchema,
});
