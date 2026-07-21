'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useBomContexts } from '@/hooks/use-bom-contexts';
import { apiClient } from '@/lib/api-client';
import { NAV_GROUPS, type NavItem } from '@/lib/constants/nav';
import { cn } from '@/lib/utils/cn';

function NavLink({
  item, active, collapsed, badge, onClick,
}: {
  item: NavItem; active: boolean; collapsed: boolean; badge?: number; onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-[5px] text-erp-sm transition-colors box-border w-full',
        collapsed ? 'justify-center py-2' : active ? 'py-[7px] pl-2.5 pr-3' : 'py-[7px] px-3',
        'border-l-2',
        active
          ? 'border-or-400 bg-or-400/[.15] text-white font-semibold'
          : 'border-transparent text-[#EAD9C8]/70 hover:bg-or-400/10 hover:text-[#F5EFE6] font-medium'
      )}
    >
      <Icon size={15} className={cn('flex-shrink-0', active ? 'opacity-100 text-or-400' : 'opacity-85')} />
      {!collapsed && <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>}
      {!collapsed && !!badge && badge > 0 && (
        <span className="bg-framboise-400 text-white text-[10px] font-bold px-1.5 rounded-[var(--rx-pill)] min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

function SideLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <p className="m-0 mb-1.5 px-1.5 text-[9.5px] font-bold uppercase tracking-[.14em] text-or-300/60">
      {children}
    </p>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contexteId, setContexteId] = useState<string>('');

  const { data: contexts = [] } = useBomContexts();

  const { data: pendingCount } = useQuery({
    queryKey: ['orders-pending-count'],
    queryFn: async () => {
      const res = await apiClient.get<{ total: number }>('/api/v1/orders?status=NEW&pageSize=1');
      return ((res.data as Record<string, unknown>)['total'] as number) ?? 0;
    },
    refetchInterval: 60000,
  });

  const isActive = (href: string) => {
    const base = pathname.replace(/^\/[a-z]{2}/, '');
    return base === href || (href !== '/dashboard' && base.startsWith(href));
  };

  const activeContexteId = contexteId || contexts[0]?.id || '';

  const sidebarContent = (
    <div className="flex flex-col h-full font-sans">
      {/* Atelier */}
      {!collapsed && (
        <div className="p-3 pb-2.5">
          <SideLabel collapsed={collapsed}>Atelier</SideLabel>
          <div className="flex items-center gap-2 py-2 px-2 bg-or-400/10 border border-or-400/30 rounded-[5px] cursor-default">
            <span className="w-[26px] h-[26px] rounded-[4px] bg-gradient-to-br from-or-400 to-framboise-500 inline-flex items-center justify-center text-[13px] flex-shrink-0">
              🏷
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-erp-xs font-bold text-white">Charles &amp; Nadejda</div>
              <div className="text-[10.5px] text-[#F5E6D3]/55">Pâtisserie artisanale</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Gestion des activités bientôt disponible')}
            className="mt-1.5 text-[11px] text-or-400/85 inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
          >
            ⚙ Gérer les activités
          </button>
        </div>
      )}

      {/* Contexte */}
      {!collapsed && (
        <div className="px-3 pb-2.5 border-b border-white/[.08]">
          <SideLabel collapsed={collapsed}>Contexte</SideLabel>
          <select
            value={activeContexteId}
            onChange={(e) => setContexteId(e.target.value)}
            className="w-full bg-white/[.06] text-[#F5E6D3] border border-[#F5E6D3]/20 rounded-[4px] px-2 py-1.5 text-erp-xs cursor-pointer"
          >
            {contexts.length === 0 && <option value="">Aucun contexte</option>}
            {contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-5">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => !item.permission || can(item.permission));
          if (!visible.length) return null;
          return (
            <div key={group.label} className="px-1">
              <SideLabel collapsed={collapsed}>{group.label}</SideLabel>
              <div className="flex flex-col gap-px">
                {visible.map((item) => (
                  <NavLink
                    key={item.id}
                    item={item}
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
      <div className="border-t border-white/[.08] px-2 py-2 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#F5E6D3]/50 px-1.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5CB85C]" /> v1.0
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center py-1.5 mt-0.5 rounded-[5px] bg-transparent hover:bg-or-400/[.08] text-[#EAD9C8]/25 hover:text-[#EAD9C8] border-0 cursor-pointer transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </div>
  );

  const sidebarWidth = collapsed ? 64 : 224;

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 bottom-0 z-20 bg-rail shadow-sh-rail overflow-hidden transition-[width] duration-[250ms]"
        style={{ top: 40, width: sidebarWidth }}
      >
        {sidebarContent}
      </aside>

      {/* Spacer to push main content */}
      <div className="hidden lg:block flex-shrink-0 transition-[width] duration-[250ms]" style={{ width: sidebarWidth }} />

      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed z-[29] p-1.5 bg-rail text-[#EAD9C8] border-0 rounded-[5px] cursor-pointer flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        style={{ top: 46, left: 10 }}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={17} />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-30 bg-black/55" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden flex flex-col fixed left-0 top-0 bottom-0 z-40 w-[240px] bg-rail">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-2.5 right-2.5 bg-transparent border-0 cursor-pointer text-or-300/70 p-1 flex"
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
