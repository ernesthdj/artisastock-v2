// src/lib/bom/cost.ts — Calcul de coût BOM récursif avec détection de cycles

import { PrismaClient, UnitOfMeasure } from '@prisma/client'
import { convert } from './units'

export interface BomCostLine {
  lineId: string
  inputType: 'INGREDIENT' | 'SHEET'
  label: string
  quantity: number
  unit: UnitOfMeasure
  unitCost: number      // coût pour 1 unité de la ligne
  totalCost: number     // coût total de la ligne pour nBatches
}

export interface BomCostResult {
  sheetId: string
  sheetName: string
  nBatches: number
  outputQty: number
  outputUnit: UnitOfMeasure
  totalCost: number
  unitCost: number      // coût par unité outputUnit
  lines: BomCostLine[]
}

/**
 * Calcule le coût BOM de manière récursive.
 * - Détection de cycles via Set<string> visited
 * - Pour INGREDIENT : utilise Ingredient.priceUnit (prix par unité de stock)
 * - Pour SHEET : appel récursif
 *
 * @param sheetId  - ID de la fiche BOM à calculer
 * @param nBatches - Nombre de lots à produire
 * @param prisma   - Instance Prisma (client ou transaction)
 * @param visited  - Set de sheetId en cours de visite (anti-cycle)
 */
export async function calculateBomCost(
  sheetId: string,
  nBatches: number,
  prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  visited: Set<string> = new Set()
): Promise<BomCostResult> {
  if (visited.has(sheetId)) {
    throw new Error(`Cycle BOM détecté : la fiche ${sheetId} s'inclut elle-même`)
  }

  const sheet = await prisma.bomSheet.findUniqueOrThrow({
    where: { id: sheetId },
    include: {
      lines: {
        include: {
          ingredient: true,
          subSheet: { select: { id: true, name: true, outputQty: true, outputUnit: true } },
        },
      },
    },
  })

  const currentVisited = new Set(visited)
  currentVisited.add(sheetId)

  const costLines: BomCostLine[] = []
  let totalCost = 0

  for (const line of sheet.lines) {
    if (line.inputType === 'INGREDIENT') {
      if (!line.ingredient) continue

      // Convertir la quantité de la ligne dans l'unité de stock de l'ingrédient
      const qtyInIngredientUnit = convert(
        Number(line.quantity) * nBatches,
        line.unit,
        line.ingredient.unit
      )

      const priceUnit = Number(line.ingredient.priceUnit)
      const lineTotalCost = qtyInIngredientUnit * priceUnit

      costLines.push({
        lineId: line.id,
        inputType: 'INGREDIENT',
        label: line.ingredient.name,
        quantity: Number(line.quantity) * nBatches,
        unit: line.unit,
        unitCost: priceUnit,
        totalCost: lineTotalCost,
      })

      totalCost += lineTotalCost
    } else {
      // inputType === 'SHEET'
      if (!line.subSheet) continue

      const subOutputQty = Number(line.subSheet.outputQty)
      const neededQty = Number(line.quantity) * nBatches

      // Convertir la quantité nécessaire dans l'unité de sortie de la sous-fiche
      const neededInSubUnit = convert(neededQty, line.unit, line.subSheet.outputUnit)
      const subBatches = neededInSubUnit / subOutputQty

      const subResult = await calculateBomCost(
        line.subSheet.id,
        subBatches,
        prisma,
        currentVisited
      )

      costLines.push({
        lineId: line.id,
        inputType: 'SHEET',
        label: line.subSheet.name,
        quantity: neededQty,
        unit: line.unit,
        unitCost: subBatches > 0 ? subResult.totalCost / neededQty : 0,
        totalCost: subResult.totalCost,
      })

      totalCost += subResult.totalCost
    }
  }

  const outputQty = Number(sheet.outputQty) * nBatches
  const unitCost = outputQty > 0 ? totalCost / outputQty : 0

  return {
    sheetId: sheet.id,
    sheetName: sheet.name,
    nBatches,
    outputQty,
    outputUnit: sheet.outputUnit,
    totalCost,
    unitCost,
    lines: costLines,
  }
}
