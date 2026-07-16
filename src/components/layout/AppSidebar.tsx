'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { usePermissions } from '@/hooks/use-permissions';
import {
  LayoutDashboard, Package, ChefHat, Truck, ShoppingBag, ShoppingCart,
  Receipt, Palette, Users, Settings, LogOut, ChevronLeft, ChevronRight,
  X, Menu, Factory,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

const navGroups = [
  {
    label: 'Gestion',
    items: [
      { label: 'Dashboard',    href: '/dashboard',   icon: LayoutDashboard },
      { label: 'Ingrédients',  href: '/ingredients', icon: Package,     permission: 'ingredients.read' },
      { label: 'Recettes',     href: '/recipes',     icon: ChefHat,     permission: 'recipes.read' },
      { label: 'Fournisseurs', href: '/suppliers',   icon: Truck,       permission: 'ingredients.read' },
      { label: 'Produits',     href: '/products',    icon: ShoppingBag, permission: 'products.read' },
      { label: 'Nomenclature', href: '/bom',         icon: Factory,     permission: 'bom.read' },
    ] as NavItem[],
  },
  {
    label: 'Ventes',
    items: [
      { label: 'Commandes',   href: '/orders',   icon: ShoppingCart, permission: 'orders.read' },
      { label: 'Facturation', href: '/invoices', icon: Receipt,      permission: 'invoices.read' },
    ] as NavItem[],
  },
  {
    label: 'Vitrine',
    items: [
      { label: 'CMS Builder', href: '/cms', icon: Palette, permission: 'cms.read' },
    ] as NavItem[],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Équipe',     href: '/settings/team', icon: Users,    permission: 'team.read' },
      { label: 'Paramètres', href: '/settings',      icon: Settings },
    ] as NavItem[],
  },
];

// Sidebar design tokens
const S = {
  bg:       '#2C1810',
  border:   'rgba(245,230,211,0.08)',
  gold:     '#D4AF37',
  text:     'rgba(234,217,200,0.70)',
  textHov:  '#F5EFE6',
  textAct:  '#D4AF37',
  section:  'rgba(158,123,92,0.70)',
  bgHov:    'rgba(212,175,55,0.10)',
  bgAct:    'rgba(212,175,55,0.15)',
};

function NavLink({
  href, icon: Icon, label, active, collapsed, badge, onClick,
}: {
  href: string; icon: React.ElementType; label: string;
  active: boolean; collapsed: boolean; badge?: number; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 9,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '8px 0' : active ? '7px 12px 7px 10px' : '7px 12px',
        borderRadius: 5,
        borderLeft: active ? `2px solid ${S.gold}` : '2px solid transparent',
        background: active ? S.bgAct : hov ? S.bgHov : 'transparent',
        color: active ? S.textAct : hov ? S.textHov : S.text,
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        transition: 'background .1s, color .1s',
        boxSizing: 'border-box',
        width: '100%',
        letterSpacing: '.01em',
      }}
    >
      <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }} />
      {!collapsed && (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
      {!collapsed && badge && badge > 0 && (
        <span style={{
          background: '#C72C48', color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '1px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center',
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingCount } = useQuery({
    queryKey: ['orders-pending-count'],
    queryFn: async () => {
      const res = await apiClient.get<{ total: number }>('/api/v1/orders?status=NEW&pageSize=1');
      return (res.data as Record<string, unknown>)['total'] as number ?? 0;
    },
    refetchInterval: 60000,
  });

  const isActive = (href: string) => {
    const base = pathname.replace(/^\/[a-z]{2}/, '');
    return base === href || (href !== '/dashboard' && base.startsWith(href));
  };

  const sidebarContent = (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '13px 0' : '13px 14px',
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 5, flexShrink: 0,
          background: S.gold, color: '#2C1810',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 16, fontWeight: 700, fontStyle: 'italic',
        }}>C</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#EAD9C8', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ArtisaStock
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(212,175,55,0.6)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 1 }}>
              Mon espace
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, overflowY: 'auto', padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {navGroups.map((group) => {
          const visible = group.items.filter(item => !item.permission || can(item.permission));
          if (!visible.length) return null;
          return (
            <div key={group.label}>
              {!collapsed && (
                <p style={{
                  margin: '0 0 5px 6px', padding: 0,
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.12em',
                  color: S.section,
                }}>
                  {group.label}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visible.map(item => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={isActive(item.href)}
                    collapsed={collapsed}
                    badge={item.href === '/orders' ? pendingCount : undefined}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${S.border}`, padding: '8px 8px 10px', flexShrink: 0 }}>
        {/* User info */}
        {!collapsed && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: '#3D2817', color: S.gold,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              border: '1px solid rgba(212,175,55,0.35)',
            }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#EAD9C8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.firstName} {user.lastName}
              </p>
              <p style={{ margin: 0, fontSize: 10.5, color: S.section, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <LogoutButton collapsed={collapsed} onLogout={logout} />

        {/* Collapse */}
        <CollapseButton collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>
    </div>
  );

  const sidebarWidth = collapsed ? 64 : 224;

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden lg:flex flex-col"
        style={{
          position: 'fixed', left: 0, top: 38, bottom: 0, zIndex: 20,
          width: sidebarWidth,
          background: S.bg,
          boxShadow: '2px 0 16px rgba(0,0,0,0.22)',
          transition: 'width 250ms ease',
          overflow: 'hidden',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Spacer to push main content */}
      <div
        className="hidden lg:block"
        style={{ width: sidebarWidth, flexShrink: 0, transition: 'width 250ms ease' }}
      />

      {/* Mobile hamburger */}
      <button
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed', top: 46, left: 10, zIndex: 29,
          padding: '5px 7px', background: S.bg, color: '#EAD9C8',
          border: 'none', borderRadius: 5, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Menu size={17} />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.55)' }}
          />
          <aside
            className="lg:hidden flex flex-col"
            style={{
              position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
              width: 240, background: S.bg,
            }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                color: S.section, padding: 4, display: 'flex',
              }}
            >
              <X size={17} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

function LogoutButton({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onLogout}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9,
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%', padding: collapsed ? '7px 0' : '7px 12px',
        background: hov ? 'rgba(199,44,72,0.12)' : 'transparent',
        border: 'none', borderRadius: 5, cursor: 'pointer',
        color: hov ? '#C72C48' : 'rgba(199,44,72,0.70)',
        fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
        transition: 'background .1s, color .1s',
      }}
    >
      <LogOut size={15} style={{ flexShrink: 0 }} />
      {!collapsed && <span>Déconnexion</span>}
    </button>
  );
}

function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '5px 0', marginTop: 2,
        background: hov ? 'rgba(212,175,55,0.08)' : 'transparent',
        border: 'none', borderRadius: 5, cursor: 'pointer',
        color: hov ? '#EAD9C8' : 'rgba(234,217,200,0.25)',
        transition: 'background .1s, color .1s',
      }}
    >
      {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
    </button>
  );
}
