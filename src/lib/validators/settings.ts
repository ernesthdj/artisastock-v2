import { z } from 'zod';
import { FLUSH_CATEGORIES, type FlushCategoryId } from '@/lib/settings/flush-data';

const categoryIds = FLUSH_CATEGORIES.map((c) => c.id) as [FlushCategoryId, ...FlushCategoryId[]];

export const flushDataSchema = z.object({
  categories: z.array(z.enum(categoryIds)).min(1, 'Sélectionnez au moins une catégorie'),
  confirmName: z.string().min(1, 'Confirmation requise'),
});
