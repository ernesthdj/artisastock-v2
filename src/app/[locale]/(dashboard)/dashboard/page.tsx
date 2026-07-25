'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/AuthProvider';
import { formatPrice } from '@/lib/utils/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/constants/order-status';
import { Card, KpiCard, Pill } from '@/components/ui';
import { ShoppingCart, TrendingUp, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';

interface KpiData {
  ordersToday: number;
  revenueToday: number;
  revenueMonth: number;
  stockAlerts: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalTTC: number;
    customerName: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: kpi, isLoading } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => {
      const res = await apiClient.get<KpiData>('/api/v1/dashboard/kpi');
      return res.data;
    },
  });

  const { data: stockAlerts } = useQuery({
    queryKey: ['dashboard-stock-alerts'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{
        id: string; name: string; stock: number; alertThreshold: number; unit: string;
      }>>('/api/v1/dashboard/stock-alerts');
      return res.data;
    },
  });

  const today = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="font-heading text-erp-3xl font-bold text-choco-600 -tracking-[0.01em]">
          Bonjour{user?.firstName ? `, ${user.firstName}` : ''} 👋
        </h1>
        <p className="text-erp-sm text-neutral-500 capitalize">{today}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon={<ShoppingCart size={14} />}
          label="Commandes aujourd'hui"
          value={isLoading ? '—' : (kpi?.ordersToday ?? 0)}
          onClick={() => router.push('/orders')}
        />
        <KpiCard icon={<TrendingUp size={14} />} label="CA du jour" value={isLoading ? '—' : formatPrice(kpi?.revenueToday ?? 0)} tone="ok" />
        <KpiCard icon={<TrendingUp size={14} />} label="CA du mois" value={isLoading ? '—' : formatPrice(kpi?.revenueMonth ?? 0)} tone="gold" />
        <KpiCard
          icon={<AlertTriangle size={14} />}
          label="Alertes stock"
          value={isLoading ? '—' : (kpi?.stockAlerts ?? 0)}
          sub={(kpi?.stockAlerts ?? 0) > 0 ? 'à traiter' : 'tout est OK'}
          tone={(kpi?.stockAlerts ?? 0) > 0 ? 'warn' : 'ok'}
          onClick={() => router.push('/ingredients')}
        />
      </div>

      {/* Two-column: orders + alerts */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
        {/* Recent orders */}
        <Card title="Dernières commandes" actions={<Link href="/orders" className="text-erp-xs text-choco-500 font-semibold no-underline">Voir toutes →</Link>} padded={false}>
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-[#F5EFE6] rounded animate-skeleton" />
              ))}
            </div>
          ) : !kpi?.recentOrders?.length ? (
            <div className="text-center py-12 px-6">
              <ShoppingCart size={36} className="text-creme-400 mx-auto mb-2.5" />
              <p className="text-erp-sm text-neutral-500 mb-1">Aucune commande pour le moment</p>
              <p className="text-erp-xs text-neutral-400">Les commandes de votre vitrine apparaîtront ici</p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[110px_1fr_130px_90px] px-4 py-1.5 bg-[#F5EFE6] border-b border-[var(--line-1)]">
                {['Référence', 'Client', 'Statut', 'Montant'].map((h) => (
                  <span key={h} className="text-[10.5px] font-semibold text-choco-400 uppercase tracking-wider">
                    {h}
                  </span>
                ))}
              </div>

              {kpi.recentOrders.map((order, i) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={`grid grid-cols-[110px_1fr_130px_90px] items-center px-4 py-2.5 no-underline hover:bg-[#F5EFE6] transition-colors ${
                    i < kpi.recentOrders.length - 1 ? 'border-b border-[var(--line-1)]' : ''
                  }`}
                >
                  <span className="font-mono text-[11.5px] text-choco-500 font-semibold">{order.orderNumber}</span>
                  <span className="text-erp-sm text-choco-600 font-medium pr-2">
                    {order.customerName}
                  </span>
                  <Pill tone={ORDER_STATUS_TONE[order.status]} className="w-fit">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </Pill>
                  <span className="text-erp-sm font-bold text-choco-600 text-right">{formatPrice(order.totalTTC)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Stock alerts */}
        <Card title="Alertes stock" actions={<Link href="/ingredients" className="text-erp-xs text-choco-500 font-semibold no-underline">Voir tout →</Link>} padded={false}>
          {!stockAlerts?.length ? (
            <div className="text-center py-10 px-6">
              <CheckCircle2 size={36} className="text-[#27AE60] mx-auto mb-2.5" />
              <p className="text-erp-sm font-semibold text-choco-600 mb-0.5">Tout est OK</p>
              <p className="text-erp-xs text-choco-400">Aucune alerte stock en ce moment</p>
            </div>
          ) : (
            <div className="p-2.5 flex flex-col gap-1.5">
              {stockAlerts.slice(0, 8).map((alert) => (
                <Link
                  key={alert.id}
                  href="/ingredients"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] bg-[#FFF9E4] border border-or-200 no-underline hover:border-or-400 transition-colors"
                >
                  <AlertTriangle size={14} className="text-[#C77A28] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-erp-sm font-semibold text-choco-600 overflow-hidden text-ellipsis whitespace-nowrap mb-px">{alert.name}</p>
                    <p className="text-erp-xs text-[#C77A28]">
                      {alert.stock} {alert.unit} · seuil {alert.alertThreshold}
                    </p>
                  </div>
                  <Package size={12} className="text-neutral-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
