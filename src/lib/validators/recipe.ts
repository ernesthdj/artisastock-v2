import { z } from 'zod';
import { UnitOfMeasure, VatRate } from '@prisma/client';

const recipeStepSchema = z.object({
  order: z.number().int().min(1),
  instruction: z.string().min(1).max(2000),
});

const recipeIngredientSchema = z.object({
  ingredientId: z.string().cuid(),
  quantity: z.number().positive('La quantité doit être positive'),
  unit: z.nativeEnum(UnitOfMeasure),
});

export const recipeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  servings: z.number().int().min(1).default(1),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  marginCoeff: z.number().min(1).max(10).default(2.5),
  vatRate: z.nativeEnum(VatRate).default('FOOD_6'),
  steps: z.array(recipeStepSchema).default([]),
  ingredients: z.array(recipeIngredientSchema).min(1, 'Au moins un ingrédient requis'),
});

export const recipeUpdateSchema = recipeCreateSchema.partial();
