// src/lib/bom/units.ts — Conversions d'unités BOM

import { UnitOfMeasure } from '@prisma/client'

// Facteurs de conversion vers l'unité de base du groupe
// Groupe masse : base = G
// Groupe volume : base = ML
// Groupe pièce : base = PIECE
const UNIT_FACTORS: Record<UnitOfMeasure, number> = {
  // Masse (base: G)
  MG: 0.001,
  CG: 0.01,
  G: 1,
  KG: 1000,
  // Volume (base: ML)
  ML: 1,
  CL: 10,
  DL: 100,
  L: 1000,
  // Pièce (base: PIECE)
  PIECE: 1,
  DOZEN: 12,
}

type UnitGroup = 'MASS' | 'VOLUME' | 'COUNT'

const UNIT_GROUPS: Record<UnitOfMeasure, UnitGroup> = {
  MG: 'MASS',
  CG: 'MASS',
  G: 'MASS',
  KG: 'MASS',
  ML: 'VOLUME',
  CL: 'VOLUME',
  DL: 'VOLUME',
  L: 'VOLUME',
  PIECE: 'COUNT',
  DOZEN: 'COUNT',
}

/**
 * Convertit une valeur d'une unité vers une autre.
 * Lance une erreur si les unités ne sont pas dans le même groupe.
 */
export function convert(value: number, from: UnitOfMeasure, to: UnitOfMeasure): number {
  if (from === to) return value

  const groupFrom = UNIT_GROUPS[from]
  const groupTo = UNIT_GROUPS[to]

  if (groupFrom !== groupTo) {
    throw new Error(
      `Conversion impossible : ${from} (${groupFrom}) → ${to} (${groupTo})`
    )
  }

  // Convertir en unité de base, puis vers la cible
  const inBase = value * UNIT_FACTORS[from]
  return inBase / UNIT_FACTORS[to]
}

/**
 * Retourne la liste des unités compatibles (même groupe) avec l'unité donnée.
 */
export function compatibleUnits(unit: UnitOfMeasure): UnitOfMeasure[] {
  const group = UNIT_GROUPS[unit]
  return (Object.keys(UNIT_GROUPS) as UnitOfMeasure[]).filter(
    (u) => UNIT_GROUPS[u] === group
  )
}

/**
 * Formate une quantité de façon lisible avec auto-conversion vers l'unité la plus appropriée.
 * Ex : 500000 MG → "500 g" | 1500 ML → "1.5 L"
 */
export function formatQty(value: number, unit: UnitOfMeasure): string {
  const group = UNIT_GROUPS[unit]

  // Convertir en unité de base du groupe
  const inBase = value * UNIT_FACTORS[unit]

  // Formate un nombre : entier → sans décimales, sinon supprime les zéros décimaux superflus
  const fmt = (n: number, decimals: number): string => {
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(decimals).replace(/\.?0+$/, '')
  }

  if (group === 'MASS') {
    if (inBase >= 1000) return `${fmt(inBase / 1000, 3)} kg`
    if (inBase >= 1)    return `${fmt(inBase, 2)} g`
    return `${Math.round(inBase * 1000)} mg`
  }

  if (group === 'VOLUME') {
    if (inBase >= 1000) return `${fmt(inBase / 1000, 3)} L`
    if (inBase >= 100)  return `${fmt(inBase / 100, 2)} dL`
    if (inBase >= 10)   return `${fmt(inBase / 10, 2)} cL`
    return `${fmt(inBase, 2)} mL`
  }

  // COUNT
  if (inBase >= 12) {
    const dozens = inBase / 12
    if (Number.isInteger(dozens)) return `${dozens} dz`
  }
  return `${fmt(inBase, 2)} pcs`
}

export { UNIT_GROUPS, UNIT_FACTORS }
export type { UnitGroup }
