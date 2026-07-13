import { z } from 'zod';
import { UnitOfMeasure } from '@prisma/client';

export const ingredientCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  unit: z.nativeEnum(UnitOfMeasure),
  priceUnit: z.number().positive('Le prix unitaire doit être positif'),
  pricePack: z.number().positive().optional(),
  packSize: z.number().positive().optional(),
  stock: z.number().min(0).default(0),
  alertThreshold: z.number().min(0).default(0),
  isAlertActive: z.boolean().default(true),
  supplierId: z.string().cuid().optional(),
  supplierRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const ingredientUpdateSchema = ingredientCreateSchema.partial();

export const stockUpdateSchema = z.object({
  stock: z.number().min(0, 'Le stock ne peut pas être négatif'),
  reason: z.string().max(500).optional(),
});
