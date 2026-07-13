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
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSIONS) as Permission[];
