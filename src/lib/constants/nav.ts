import {
  LayoutDashboard, Factory, CalendarClock, FileText, ChefHat,
  Boxes, Grid, ArrowLeftRight, Package, Truck, PackagePlus,
  Settings, Users,
  Palette, ShoppingCart, ShoppingBag, Receipt,
  Wallet, History,
} from 'lucide-react';
import type { Permission } from './permissions';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: Permission;
}

export const WORKFLOW_ITEMS: NavItem[] = [
  { id: 'hub', label: 'Hub', href: '/dashboard', icon: LayoutDashboard },
  { id: 'production', label: 'Production', href: '/bom', icon: Factory, permission: 'bom.read' },
  { id: 'planning', label: 'Planning', href: '/planning', icon: CalendarClock },
  { id: 'devis', label: 'Devis pâtisserie', href: '/devis', icon: FileText },
  { id: 'recipes', label: 'Recettes', href: '/recipes', icon: ChefHat, permission: 'recipes.read' },
];

export const STOCK_ITEMS: NavItem[] = [
  { id: 'stocks', label: 'Stocks & liaisons', href: '/stocks-liaisons', icon: Boxes },
  { id: 'vuestock', label: 'Vue stock global', href: '/vue-stock', icon: Grid, permission: 'stocks.read' },
  { id: 'mouvements', label: 'Mouvements', href: '/mouvements', icon: ArrowLeftRight },
  { id: 'ingredients', label: 'Fiches & Stock', href: '/ingredients', icon: Package, permission: 'ingredients.read' },
  { id: 'achats', label: 'Achats', href: '/achats', icon: PackagePlus, permission: 'achats.read' },
  { id: 'fournisseurs', label: 'Fournisseurs', href: '/suppliers', icon: Truck, permission: 'ingredients.read' },
];

export const REF_ITEMS: NavItem[] = [
  { id: 'params', label: 'Paramètres', href: '/settings', icon: Settings },
  { id: 'equipe', label: 'Équipe', href: '/settings/team', icon: Users, permission: 'team.read' },
];

export const BOUTIQUE_ITEMS: NavItem[] = [
  { id: 'boutique', label: 'Boutique web', href: '/cms', icon: Palette, permission: 'cms.read' },
  { id: 'commandes', label: 'Commandes', href: '/orders', icon: ShoppingCart, permission: 'orders.read' },
  { id: 'produits', label: 'Produits', href: '/products', icon: ShoppingBag, permission: 'products.read' },
  { id: 'factures', label: 'Factures', href: '/invoices', icon: Receipt, permission: 'invoices.read' },
];

export const POS_ITEMS: NavItem[] = [
  { id: 'pos-caisse', label: 'Caisse', href: '/pos/caisse', icon: Wallet, permission: 'pos.sell' },
  { id: 'pos-historique', label: 'Historique', href: '/pos/historique', icon: History, permission: 'pos.read' },
];

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Workflow', items: WORKFLOW_ITEMS },
  { label: 'Stock & Achats', items: STOCK_ITEMS },
  { label: 'Référentiels', items: REF_ITEMS },
  { label: 'Boutique en ligne', items: BOUTIQUE_ITEMS },
  { label: 'Point de vente', items: POS_ITEMS },
];
