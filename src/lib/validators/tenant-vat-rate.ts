import { z } from 'zod';

export const tenantVatRateCreateSchema = z.object({
  label: z.string().min(1, 'Requis').max(100),
  ratePercent: z.number().min(0, 'Doit être ≥ 0').max(100, 'Doit être ≤ 100'),
  isActive: z.boolean().default(true),
});

export const tenantVatRateUpdateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  ratePercent: z.number().min(0, 'Doit être ≥ 0').max(100, 'Doit être ≤ 100').optional(),
  isActive: z.boolean().optional(),
});
