import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export const idSchema = z.object({
  id: z.string().cuid(),
});

export const addressSchema = z.object({
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  zip: z.string().min(1).max(10),
  city: z.string().min(1).max(100),
  country: z.string().length(2).default('BE'),
}).optional();

export const vatNumberSchema = z
  .string()
  .regex(/^BE\d{10}$/, 'Format TVA belge invalide (ex: BE0123456789)')
  .optional();
