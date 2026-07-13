'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard, Package, ChefHat, Truck, ShoppingBag, ShoppingCart,
  Receipt, Palette, Users, Settings, LogOut, ChevronLeft, ChevronRight,
  AlertTriangle, X, Menu,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  badge?: number;
}

const navGroups = [
  {
    label: 'Gestion',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Ingrédients', href: '/ingredients', icon: Package, permission: 'ingredients:read' },
      { label: 'Recettes', href: '/recipes', icon: ChefHat, permission: 'recipes:read' },
      { label: 'Fournisseurs', href: '/suppliers', icon: Truck, permission: 'ingredients:read' },
      { label: 'Produits', href: '/products', icon: ShoppingBag, permission: 'products:read' },
    ] as NavItem[],
  },
  {
    label: 'Ventes',
    items: [
      { label: 'Commandes', href: '/orders', icon: ShoppingCart, permission: 'orders:read' },
      { label: 'Facturation', href: '/invoices', icon: Receipt, permission: 'invoices:read' },
    ] as NavItem[],
  },
  {
    label: 'Vitrine',
    items: [
      { label: 'CMS Builder', href: '/cms', icon: Palette, permission: 'cms:read' },
    ] as NavItem[],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Équipe', href: '/settings/team', icon: Users, permission: 'users:read' },
      { label: 'Paramètres', href: '/settings', icon: Settings },
    ] as NavItem[],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Compter les commandes en attente
  const { data: pendingCount } = useQuery({
    queryKey: ['orders-pending-count'],
    queryFn: async () => {
      const res = await apiClient.get<{ total: number }>('/api/v1/orders?status=NEW&pageSize=1');
      return (res.data as Record<string, unknown>)['total'] as number ?? 0;
    },
    refetchInterval: 60000,
  });

  const isActive = (href: string) => {
    const base = pathname.replace(/^\/[a-z]{2}/, ''); // strip locale
    return base === href || (href !== '/dashboard' && base.startsWith(href));
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-neutral-200 dark:border-slate-700',
        collapsed && 'justify-center px-2'
      )}>
        <span className="text-2xl flex-shrink-0">🥐</span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-sm text-neutral-900 dark:text-white truncate">
              {user?.firstName ? `${user.firstName}` : 'ArtisaStock'}
            </div>
            <div className="text-xs text-neutral-500 truncate">Mon espace artisan</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.permission || can(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const badge = item.href === '/orders' ? pendingCount : undefined;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'nav-item',
                        active && 'nav-item-active',
                        collapsed && 'justify-center px-2',
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && badge && badge > 0 && (
                        <span className="bg-primary-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User + collapse */}
      <div className="border-t border-neutral-200 dark:border-slate-700 p-2">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-neutral-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          className={cn(
            'nav-item w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span>Déconnexion</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full mt-1 justify-center"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-20 bg-white dark:bg-slate-800 border-r border-neutral-200 dark:border-slate-700 sidebar-transition',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile: hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-md shadow-sm"
      >
        <Menu size={20} />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 z-40 w-72 bg-white dark:bg-slate-800 border-r border-neutral-200 dark:border-slate-700">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
