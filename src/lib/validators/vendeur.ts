import { z } from 'zod';

const pinSchema = z.string().regex(/^\d{4}$/, 'Le PIN doit contenir exactement 4 chiffres');

export const vendeurCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  pin: pinSchema,
});

export const vendeurUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  pin: pinSchema.optional(),
  isActive: z.boolean().optional(),
});

export const verifyPinSchema = z.object({
  // Optionnel : si présent, vérifie ce vendeur précis ; sinon, identifie parmi tous les
  // vendeurs actifs du tenant (pavé numérique comptoir, sans sélection préalable).
  vendeurId: z.string().cuid().optional(),
  pin: pinSchema,
});
