export const PERMISSIONS = {
  // Module Ingredients & Stock
  'ingredients.read': 'Voir les ingrédients',
  'ingredients.write': 'Créer/modifier des ingrédients',
  'ingredients.delete': 'Supprimer des ingrédients',
  // Module Recettes
  'recipes.read': 'Voir les recettes',
  'recipes.write': 'Créer/modifier des recettes',
  'recipes.delete': 'Supprimer des recettes',
  // Module Produits
  'products.read': 'Voir les produits',
  'products.write': 'Créer/modifier des produits',
  'products.delete': 'Supprimer des produits',
  'products.allocate': 'Allouer le stock produit entre canaux (Vitrine/Direct)',
  // Module Commandes
  'orders.read': 'Voir les commandes',
  'orders.manage': 'Changer le statut des commandes',
  // Module Facturation
  'invoices.read': 'Voir les factures',
  'invoices.generate': 'Générer des factures',
  // Module CMS
  'cms.read': 'Voir le builder vitrine',
  'cms.write': 'Modifier la vitrine',
  'cms.publish': 'Publier les changements',
  // Module Équipe
  'team.read': 'Voir les employés',
  'team.manage': 'Gérer les employés et rôles',
  // Module Paramètres
  'settings.read': 'Voir les paramètres',
  'settings.write': 'Modifier les paramètres',
  // Module BOM (Bill of Materials — Nomenclature de fabrication)
  'bom.read': 'Voir les fiches BOM et contextes',
  'bom.write': 'Créer/modifier fiches, niveaux, contextes',
  'bom.produce': 'Lancer une production BOM',
  // Module Activités & Stocks
  'activites.read': 'Voir les activités',
  'activites.write': 'Créer/modifier/désactiver des activités',
  'stocks.read': 'Voir les stocks',
  'stocks.write': 'Créer/modifier des stocks et leurs liaisons',
  // Module Achats (Lots)
  'achats.read': 'Voir les achats (lots)',
  'achats.write': 'Créer/modifier/supprimer des achats',
  // Module Boutique/Produits — taux de TVA par Activité
  'tenant-vat-rates.read': 'Voir les taux de TVA',
  'tenant-vat-rates.write': 'Créer/modifier les taux de TVA',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSIONS) as Permission[];
