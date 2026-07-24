import { z } from 'zod';

export const productCreateSchema = z.object({
  bomSheetId: z.string().cuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug invalide').optional(),
  description: z.string().max(500).optional(),
  descriptionLong: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  priceHT: z.number().positive('Le prix HT doit être positif'),
  vatRateId: z.string().cuid(),
  marginTargetFactor: z.number().positive().optional(),
  isPerishable: z.boolean().default(false),
  allergens: z.array(z.string()).default([]),
  isVisible: z.boolean().default(true),
  isClickCollect: z.boolean().default(true),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productVisibilitySchema = z.object({
  isVisible: z.boolean(),
});

export const productsReorderSchema = z.object({
  items: z.array(z.object({ id: z.string().cuid(), sortOrder: z.number().int().min(0) })),
});
