// src/lib/bom/fifo.ts — Consommation stock BOM (MVP: Ingredient.stock direct)
// NOTE MVP : pas de lots d'ingrédients (IngredientBatch) dans le schéma v2.
// consumeFIFO décrémente directement Ingredient.stock.
// Le vrai FIFO sur lots sera implémenté lors du module Achats/Lots.

import { PrismaClient, UnitOfMeasure } from '@prisma/client'
import { convert } from './units'

const TOLERANCE = 0.0001  // Tolérance pour comparaison décimaux

export interface AvailabilityLine {
  lineId: string
  label: string
  required: number
  unit: UnitOfMeasure
  available: number       // en unité de stock de l'ingrédient
  availableInUnit: number // converti dans l'unité de la ligne
  sufficient: boolean
}

export interface AvailabilityResult {
  sheetId: string
  nBatches: number
  lines: AvailabilityLine[]
  allSufficient: boolean
}

/**
 * Vérifie la disponibilité du stock pour produire nBatches lots de sheetId.
 * Hors transaction — simulation uniquement (risque TOCTOU).
 */
export async function checkAvailability(
  sheetId: string,
  nBatches: number,
  prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<AvailabilityResult> {
  const sheet = await prisma.bomSheet.findUniqueOrThrow({
    where: { id: sheetId },
    include: {
      lines: {
        include: { ingredient: true },
        where: { inputType: 'INGREDIENT' },
      },
    },
  })

  const lines: AvailabilityLine[] = []

  for (const line of sheet.lines) {
    if (!line.ingredient) continue

    const required = Number(line.quantity) * nBatches
    const requiredInIngUnit = convert(required, line.unit, line.ingredient.unit)
    const available = Number(line.ingredient.stock)
    const sufficient = available >= requiredInIngUnit - TOLERANCE

    lines.push({
      lineId: line.id,
      label: line.ingredient.name,
      required,
      unit: line.unit,
      available,
      availableInUnit: convert(available, line.ingredient.unit, line.unit),
      sufficient,
    })
  }

  return {
    sheetId,
    nBatches,
    lines,
    allSufficient: lines.every((l) => l.sufficient),
  }
}

export interface ConsumeParams {
  sheetId: string
  productionId: string
  nBatches: number
}

/**
 * Consomme le stock ingrédient dans une transaction Prisma.
 * Re-vérifie la disponibilité (anti-TOCTOU) avant de décrémenter.
 * Insère une BomProductionLine par ingrédient consommé.
 */
export async function consumeFIFO(
  params: ConsumeParams,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  const { sheetId, productionId, nBatches } = params

  const sheet = await tx.bomSheet.findUniqueOrThrow({
    where: { id: sheetId },
    include: {
      lines: {
        include: { ingredient: true },
        where: { inputType: 'INGREDIENT' },
      },
    },
  })

  for (const line of sheet.lines) {
    if (!line.ingredient) continue

    const required = Number(line.quantity) * nBatches
    const requiredInIngUnit = convert(required, line.unit, line.ingredient.unit)

    // Re-vérification dans la transaction (anti-TOCTOU)
    const freshIngredient = await tx.ingredient.findUniqueOrThrow({
      where: { id: line.ingredient.id },
      select: { stock: true, priceUnit: true },
    })

    const currentStock = Number(freshIngredient.stock)

    if (currentStock < requiredInIngUnit - TOLERANCE) {
      throw new Error(
        `Stock insuffisant pour "${line.ingredient.name}" : ` +
        `requis ${requiredInIngUnit.toFixed(4)} ${line.ingredient.unit}, ` +
        `disponible ${currentStock.toFixed(4)} ${line.ingredient.unit}`
      )
    }

    // Décrémenter le stock
    await tx.ingredient.update({
      where: { id: line.ingredient.id },
      data: { stock: { decrement: requiredInIngUnit } },
    })

    // Enregistrer la ligne de production
    await tx.bomProductionLine.create({
      data: {
        productionId,
        sourceType: 'LOT_INGREDIENT',
        ingredientId: line.ingredient.id,
        qtyConsumed: requiredInIngUnit,
        unitCostAtTime: Number(freshIngredient.priceUnit),
      },
    })
  }
}
