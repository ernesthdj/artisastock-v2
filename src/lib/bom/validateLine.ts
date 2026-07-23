// src/lib/bom/validateLine.ts — Validation partagée de la hiérarchie des lignes BOM
// (utilisée à la fois par la création atomique fiche+lignes et par l'ajout de ligne incrémental)

import { getPrismaWithTenant } from '@/lib/prisma'

export interface LineValidationError {
  ok: false
  status: number
  code: string
  message: string
}

export type LineValidationResult = { ok: true } | LineValidationError

/**
 * Vérifie qu'une sous-fiche (input de type SHEET) appartient au tenant et respecte la règle
 * de hiérarchie v1 : niveau N ne consomme que M < N, et jamais le niveau 1 (ingrédients bruts,
 * qui n'a jamais de fiche BOM consommable comme sous-produit — mirroring
 * FrmBomFicheEdit.ChargerInputsDisponibles).
 */
export async function validateSubSheetHierarchy(
  db: ReturnType<typeof getPrismaWithTenant>,
  subSheetId: string,
  currentLevelOrder: number,
  tenantId: string
): Promise<LineValidationResult> {
  const subSheet = await db.bomSheet.findUnique({
    where: { id: subSheetId },
    include: { level: { select: { order: true, context: { select: { tenantId: true } } } } },
  })

  if (!subSheet) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Sous-fiche BOM introuvable' }
  }
  if (subSheet.level.context.tenantId !== tenantId) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Sous-fiche BOM introuvable' }
  }
  if (subSheet.level.order >= currentLevelOrder) {
    return {
      ok: false,
      status: 422,
      code: 'VALIDATION_ERROR',
      message: `Hiérarchie invalide : la sous-fiche (N${subSheet.level.order}) doit être d'un niveau inférieur à la fiche courante (N${currentLevelOrder})`,
    }
  }
  if (subSheet.level.order < 2) {
    return {
      ok: false,
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Hiérarchie invalide : une fiche du niveau 1 (ingrédients) ne peut pas être utilisée comme sous-produit',
    }
  }

  return { ok: true }
}
