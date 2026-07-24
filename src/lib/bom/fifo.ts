// src/lib/bom/fifo.ts — Consommation FIFO réelle sur les lots d'ingrédients (date_achat ASC)

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
 * Hors transaction — simulation uniquement (risque TOCTOU, re-vérifié dans consumeFIFO).
 * S'appuie sur Ingredient.stock (dénormalisation = somme des Lot.quantityAvailable,
 * maintenue transactionnellement par le module Achats et par consumeFIFO).
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
        include: {
          ingredient: true,
          subSheet: { select: { id: true, name: true, outputUnit: true } },
        },
      },
    },
  })

  const lines: AvailabilityLine[] = []

  for (const line of sheet.lines) {
    if (line.inputType === 'INGREDIENT') {
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
    } else {
      // inputType === 'SHEET' — sous-fiche BOM, disponibilité = somme des BomStock.qtyAvailable
      if (!line.subSheet) continue

      const required = Number(line.quantity) * nBatches
      const requiredInSubUnit = convert(required, line.unit, line.subSheet.outputUnit)

      const agg = await prisma.bomStock.aggregate({
        where: { sheetId: line.subSheet.id, qtyAvailable: { gt: 0 } },
        _sum: { qtyAvailable: true },
      })
      const available = Number(agg._sum.qtyAvailable ?? 0)
      const sufficient = available >= requiredInSubUnit - TOLERANCE

      lines.push({
        lineId: line.id,
        label: line.subSheet.name,
        required,
        unit: line.unit,
        available,
        availableInUnit: convert(available, line.subSheet.outputUnit, line.unit),
        sufficient,
      })
    }
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
 * Consomme les lots d'ingrédients en FIFO strict (purchaseDate ASC) dans une transaction Prisma.
 * Une BomProductionLine est créée par lot réellement touché (traçabilité fine, pas un agrégat
 * par ingrédient) — le coût gelé de chaque ligne est celui du lot consommé, jamais recalculé
 * après coup. Ingredient.stock reste synchronisé (somme des lots) à chaque décrément.
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
        include: {
          ingredient: true,
          subSheet: { select: { id: true, name: true, outputUnit: true } },
        },
      },
    },
  })

  for (const line of sheet.lines) {
    if (line.inputType === 'INGREDIENT') {
      if (!line.ingredient) continue

      const required = Number(line.quantity) * nBatches
      let remaining = convert(required, line.unit, line.ingredient.unit)
      const totalRequired = remaining

      // Re-lecture FIFO dans la transaction (anti-TOCTOU) : lots les plus anciens d'abord
      const lots = await tx.lot.findMany({
        where: { ingredientId: line.ingredient.id, quantityAvailable: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
      })

      const totalAvailable = lots.reduce((sum, l) => sum + Number(l.quantityAvailable), 0)
      if (totalAvailable < remaining - TOLERANCE) {
        throw new Error(
          `Stock insuffisant pour "${line.ingredient.name}" : ` +
          `requis ${remaining.toFixed(4)} ${line.ingredient.unit}, ` +
          `disponible ${totalAvailable.toFixed(4)} ${line.ingredient.unit}`
        )
      }

      for (const lot of lots) {
        if (remaining <= TOLERANCE) break

        const available = Number(lot.quantityAvailable)
        const consumed = Math.min(available, remaining)

        await tx.lot.update({
          where: { id: lot.id },
          data: { quantityAvailable: { decrement: consumed } },
        })

        await tx.bomProductionLine.create({
          data: {
            productionId,
            sourceType: 'LOT_INGREDIENT',
            ingredientId: line.ingredient.id,
            lotId: lot.id,
            qtyConsumed: consumed,
            unitCostAtTime: Number(lot.unitPrice),
          },
        })

        remaining -= consumed
      }

      // Ingredient.stock suit la somme des lots — décrémenté du même montant que consommé au total
      await tx.ingredient.update({
        where: { id: line.ingredient.id },
        data: { stock: { decrement: totalRequired } },
      })
    } else {
      // inputType === 'SHEET' — consomme le stock produit de la sous-fiche (BomStock), FIFO par producedAt
      if (!line.subSheet) continue

      const required = Number(line.quantity) * nBatches
      let remaining = convert(required, line.unit, line.subSheet.outputUnit)

      const stocks = await tx.bomStock.findMany({
        where: { sheetId: line.subSheet.id, qtyAvailable: { gt: 0 } },
        orderBy: { producedAt: 'asc' },
      })

      const totalAvailable = stocks.reduce((sum, s) => sum + Number(s.qtyAvailable), 0)
      if (totalAvailable < remaining - TOLERANCE) {
        throw new Error(
          `Stock insuffisant pour "${line.subSheet.name}" : ` +
          `requis ${remaining.toFixed(4)} ${line.subSheet.outputUnit}, ` +
          `disponible ${totalAvailable.toFixed(4)} ${line.subSheet.outputUnit}`
        )
      }

      for (const stock of stocks) {
        if (remaining <= TOLERANCE) break

        const available = Number(stock.qtyAvailable)
        const consumed = Math.min(available, remaining)

        await tx.bomStock.update({
          where: { id: stock.id },
          data: { qtyAvailable: { decrement: consumed } },
        })

        await tx.bomProductionLine.create({
          data: {
            productionId,
            sourceType: 'BOM_STOCK',
            bomStockId: stock.id,
            qtyConsumed: consumed,
            unitCostAtTime: Number(stock.unitCost),
          },
        })

        remaining -= consumed
      }
    }
  }
}
