// Flush sélectif des données de test d'un tenant, déclenché depuis Paramètres (Zone de danger).
// Contrairement à scripts/flush-db-local.ts (TRUNCATE ... CASCADE, local uniquement, tous tenants),
// ceci tourne en prod, scopé au tenant courant uniquement, via des deleteMany() ordonnés qui
// respectent les contraintes onDelete: Restrict du schéma (voir prisma/schema.prisma).
// User/Role/Tenant/Session ne sont jamais touchés.

import { PrismaClient } from '@prisma/client';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export type FlushCategoryId = 'pos' | 'commandes' | 'recettes' | 'produits' | 'achats' | 'stocks';

export const FLUSH_CATEGORIES: { id: FlushCategoryId; label: string; description: string }[] = [
  { id: 'pos', label: 'POS (comptoir)', description: 'Vendeurs, sessions de caisse, pointages, ventes comptoir' },
  { id: 'commandes', label: 'Commandes clients', description: 'Clients, commandes, factures (boutique web)' },
  { id: 'recettes', label: 'Recettes & BOM', description: 'Recettes, contextes/niveaux/fiches BOM, productions' },
  { id: 'produits', label: 'Produits & Boutique', description: 'Produits publiés, taux de TVA, allocations, clôtures' },
  { id: 'achats', label: 'Achats & Ingrédients', description: 'Ingrédients, lots (achats), fournisseurs' },
  { id: 'stocks', label: 'Stocks physiques & Activités', description: 'Activités, emplacements de stock' },
];

interface FlushStep {
  id: string;
  category: FlushCategoryId;
  label: string;
  run: (tx: TxClient, tenantId: string) => Promise<number>;
}

// Ordre global sûr — dérivé des relations onDelete: Restrict du schéma. Ne pas réordonner sans
// re-vérifier chaque contrainte (ex. Recipe doit partir avant Product, Product avant BomSheet,
// BomLine avant BomSheet/Ingredient, Lot/BomStock avant Stock). Les enfants en cascade DB
// (onDelete: Cascade déclaré dans le schéma) ne sont pas listés séparément.
const GLOBAL_STEPS: FlushStep[] = [
  { id: 'posSale', category: 'pos', label: 'Ventes POS', run: (tx, tenantId) => tx.posSale.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'sessionCaisse', category: 'pos', label: 'Sessions de caisse', run: (tx, tenantId) => tx.sessionCaisse.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'pointageHoraire', category: 'pos', label: 'Pointages horaires', run: (tx, tenantId) => tx.pointageHoraire.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'vendeur', category: 'pos', label: 'Vendeurs', run: (tx, tenantId) => tx.vendeur.deleteMany({ where: { tenantId } }).then((r) => r.count) },

  { id: 'invoice', category: 'commandes', label: 'Factures', run: (tx, tenantId) => tx.invoice.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'order', category: 'commandes', label: 'Commandes', run: (tx, tenantId) => tx.order.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'customer', category: 'commandes', label: 'Clients', run: (tx, tenantId) => tx.customer.deleteMany({ where: { tenantId } }).then((r) => r.count) },

  { id: 'recipe', category: 'recettes', label: 'Recettes', run: (tx, tenantId) => tx.recipe.deleteMany({ where: { tenantId } }).then((r) => r.count) },

  { id: 'stockClosure', category: 'produits', label: 'Clôtures de stock', run: (tx, tenantId) => tx.stockClosure.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'product', category: 'produits', label: 'Produits', run: (tx, tenantId) => tx.product.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'tenantVatRate', category: 'produits', label: 'Taux de TVA', run: (tx, tenantId) => tx.tenantVatRate.deleteMany({ where: { tenantId } }).then((r) => r.count) },

  { id: 'bomStock', category: 'recettes', label: 'Stocks BOM produits', run: (tx, tenantId) => tx.bomStock.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'bomProduction', category: 'recettes', label: 'Productions BOM', run: (tx, tenantId) => tx.bomProduction.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  {
    id: 'bomLine',
    category: 'recettes',
    label: 'Lignes de nomenclature',
    // Sans tenantId propre (TENANT_SCOPED_VIA_PARENT, voir lib/prisma.ts) — scopé via la chaîne
    // BomLine → BomSheet → BomLevel → BomContext.tenantId. Doit tourner avant bomSheet pour
    // vider les références self-ref subSheetId (sous-fiches) et ingredientId (Restrict).
    run: (tx, tenantId) =>
      tx.bomLine.deleteMany({ where: { sheet: { level: { context: { tenantId } } } } }).then((r) => r.count),
  },
  {
    id: 'bomSheet',
    category: 'recettes',
    label: 'Fiches BOM',
    run: (tx, tenantId) => tx.bomSheet.deleteMany({ where: { level: { context: { tenantId } } } }).then((r) => r.count),
  },
  { id: 'bomContext', category: 'recettes', label: 'Contextes BOM', run: (tx, tenantId) => tx.bomContext.deleteMany({ where: { tenantId } }).then((r) => r.count) },

  { id: 'lot', category: 'achats', label: 'Lots (achats)', run: (tx, tenantId) => tx.lot.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'ingredient', category: 'achats', label: 'Ingrédients', run: (tx, tenantId) => tx.ingredient.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'supplier', category: 'achats', label: 'Fournisseurs', run: (tx, tenantId) => tx.supplier.deleteMany({ where: { tenantId } }).then((r) => r.count) },

  { id: 'activite', category: 'stocks', label: 'Activités', run: (tx, tenantId) => tx.activite.deleteMany({ where: { tenantId } }).then((r) => r.count) },
  { id: 'stock', category: 'stocks', label: 'Stocks (emplacements)', run: (tx, tenantId) => tx.stock.deleteMany({ where: { tenantId } }).then((r) => r.count) },
];

export interface FlushResult {
  deletedCounts: Record<string, number>;
  totalDeleted: number;
}

export async function flushTenantData(
  tx: TxClient,
  tenantId: string,
  categories: FlushCategoryId[]
): Promise<FlushResult> {
  const selected = new Set(categories);
  const deletedCounts: Record<string, number> = {};
  let totalDeleted = 0;

  for (const step of GLOBAL_STEPS) {
    if (!selected.has(step.category)) continue;
    const count = await step.run(tx, tenantId);
    deletedCounts[step.id] = count;
    totalDeleted += count;
  }

  return { deletedCounts, totalDeleted };
}
