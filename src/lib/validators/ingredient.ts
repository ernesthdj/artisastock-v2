import { z } from 'zod';
import { UnitOfMeasure, PhysicalType } from '@prisma/client';

export const ingredientCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    category: z.string().max(100).optional(),
    unit: z.nativeEnum(UnitOfMeasure),
    physicalType: z.nativeEnum(PhysicalType).default('PIECE'),
    density: z.number().positive().optional(),
    packagingLabel: z.string().max(100).optional(),
    priceUnit: z.number().positive('Le prix unitaire doit être positif'),
    pricePack: z.number().positive().optional(),
    packSize: z.number().positive().optional(),
    unitsPerLot: z.number().int().positive().default(1),
    alertThreshold: z.number().min(0).default(0),
    isAlertActive: z.boolean().default(true),
    dlcDaysReference: z.number().int().positive().optional(),
    qualityLabel: z.string().max(100).optional(),
    defaultStockId: z.string().cuid().optional(),
    supplierId: z.string().cuid().optional(),
    supplierRef: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (d) => (d.physicalType === 'LIQUID' || d.physicalType === 'POWDER' ? d.density !== undefined : true),
    { message: 'Densité obligatoire pour un type liquide ou poudre', path: ['density'] }
  );

// .partial() ne peut pas s'appliquer après .refine() — on redéclare l'update sans la
// validation conditionnelle (elle reste appliquée à la création, seul moment où
// physicalType est garanti présent dans le payload).
export const ingredientUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).nullable().optional(),
  unit: z.nativeEnum(UnitOfMeasure).optional(),
  physicalType: z.nativeEnum(PhysicalType).optional(),
  density: z.number().positive().nullable().optional(),
  packagingLabel: z.string().max(100).nullable().optional(),
  priceUnit: z.number().positive().optional(),
  pricePack: z.number().positive().nullable().optional(),
  packSize: z.number().positive().nullable().optional(),
  unitsPerLot: z.number().int().positive().optional(),
  alertThreshold: z.number().min(0).optional(),
  isAlertActive: z.boolean().optional(),
  dlcDaysReference: z.number().int().positive().nullable().optional(),
  qualityLabel: z.string().max(100).nullable().optional(),
  defaultStockId: z.string().cuid().nullable().optional(),
  supplierId: z.string().cuid().nullable().optional(),
  supplierRef: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});
