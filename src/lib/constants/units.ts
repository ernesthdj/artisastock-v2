import { UnitOfMeasure } from '@prisma/client';

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  KG: 'kg',
  G: 'g',
  MG: 'mg',
  CG: 'cg',
  L: 'L',
  DL: 'dL',
  CL: 'cL',
  ML: 'mL',
  PIECE: 'pièce',
  DOZEN: 'douzaine',
};

// Facteurs de conversion vers l'unité de base
// kg → base kg, g → 0.001 kg, etc.
export const UNIT_TO_BASE: Record<UnitOfMeasure, { base: UnitOfMeasure; factor: number }> = {
  KG: { base: 'KG', factor: 1 },
  G: { base: 'KG', factor: 0.001 },
  MG: { base: 'KG', factor: 0.000001 },
  CG: { base: 'KG', factor: 0.00001 },
  L: { base: 'L', factor: 1 },
  DL: { base: 'L', factor: 0.1 },
  CL: { base: 'L', factor: 0.01 },
  ML: { base: 'L', factor: 0.001 },
  PIECE: { base: 'PIECE', factor: 1 },
  DOZEN: { base: 'PIECE', factor: 12 },
};

export function convertToBase(quantity: number, unit: UnitOfMeasure): number {
  return quantity * UNIT_TO_BASE[unit].factor;
}
