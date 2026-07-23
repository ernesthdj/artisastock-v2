import { z } from 'zod';
import { VatRate } from '@prisma/client';

// purchaseMode/priceMode sont des saisies transitoires (jamais stockées telles quelles) :
// - purchaseMode détermine comment `quantity` est interprétée (mirroring FrmAchatEdit rbModeCond/rbModeLot)
// - priceMode détermine si `priceEntered` est HTVA ou TVAC — la DB stocke toujours HTVA
export const achatCreateSchema = z.object({
  ingredientId: z.string().cuid(),
  stockId: z.string().cuid(),
  supplierId: z.string().cuid().optional(),
  lotNumber: z.string().max(100).optional(),
  purchaseDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  purchaseMode: z.enum(['CONDITIONNEMENT', 'LOT']),
  quantity: z.number().positive(),
  priceMode: z.enum(['HT', 'TTC']),
  priceEntered: z.number().positive(),
  vatRate: z.nativeEnum(VatRate).default('STANDARD_21'),
  invoiceRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// ingredientId est verrouillé en édition (mirroring v1 : "on ne peut jamais changer
// l'ingrédient d'un lot existant"), donc absent du schéma d'update.
export const achatUpdateSchema = z.object({
  stockId: z.string().cuid().optional(),
  supplierId: z.string().cuid().nullable().optional(),
  lotNumber: z.string().max(100).nullable().optional(),
  purchaseDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  purchaseMode: z.enum(['CONDITIONNEMENT', 'LOT']).optional(),
  quantity: z.number().positive().optional(),
  priceMode: z.enum(['HT', 'TTC']).optional(),
  priceEntered: z.number().positive().optional(),
  vatRate: z.nativeEnum(VatRate).optional(),
  invoiceRef: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
