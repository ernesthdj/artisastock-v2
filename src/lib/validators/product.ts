import { z } from 'zod';
import { VatRate } from '@prisma/client';

export const productCreateSchema = z.object({
  recipeId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug invalide').optional(),
  description: z.string().max(500).optional(),
  descriptionLong: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  priceHT: z.number().positive('Le prix HT doit être positif'),
  vatRate: z.nativeEnum(VatRate).default('FOOD_6'),
  allergens: z.array(z.string()).default([]),
  isVisible: z.boolean().default(true),
  isClickCollect: z.boolean().default(true),
  stockType: z.enum(['unlimited', 'daily', 'limited']).default('unlimited'),
  stockQuantity: z.number().int().min(0).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productVisibilitySchema = z.object({
  isVisible: z.boolean(),
});

export const productsReorderSchema = z.object({
  items: z.array(z.object({ id: z.string().cuid(), sortOrder: z.number().int().min(0) })),
});
