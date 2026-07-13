'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/AuthProvider';
import { StatCard } from '@/components/ui/StatCard';
import { formatPrice } from '@/lib/utils/format';
import { ShoppingCart, Euro, TrendingUp, AlertTriangle } from 'lucide-react';

interface KpiData {
  ordersToday: number;
  revenueToday: number;
  revenueMonth: number;
  stockAlerts: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalTTC: number;
    customer: { firstName: string; lastName: string };
    createdAt: string;
  }>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouvelle',
  CONFIRMED: 'Confirmée',
  IN_PREPARATION: 'En préparation',
  READY: 'Prête',
  PICKED_UP: 'Retirée',
  CANCELLED: 'Annulée',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  IN_PREPARATION: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
  PICKED_UP: 'bg-neutral-100 text-neutral-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

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
      const res = await apiClient.get<Array<{ id: string; name: string; stockQuantity: number; alertThreshold: number; unit: string }>>('/api/v1/dashboard/stock-alerts');
      return res.data;
    },
  });

  const today = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Bonjour{user?.firstName ? `, ${user.firstName}` : ''} 👋
        </h1>
        <p className="text-sm text-neutral-500 mt-1 capitalize">{today}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Commandes aujourd'hui"
          value={isLoading ? '—' : (kpi?.ordersToday ?? 0)}
          icon={ShoppingCart}
          iconColor="text-primary-600"
          loading={isLoading}
          onClick={() => router.push('/orders')}
        />
        <StatCard
          label="CA du jour"
          value={isLoading ? '—' : formatPrice(kpi?.revenueToday ?? 0)}
          icon={Euro}
          iconColor="text-green-600"
          loading={isLoading}
        />
        <StatCard
          label="CA du mois"
          value={isLoading ? '—' : formatPrice(kpi?.revenueMonth ?? 0)}
          icon={TrendingUp}
          iconColor="text-blue-600"
          loading={isLoading}
        />
        <StatCard
          label="Alertes stock"
          value={isLoading ? '—' : (kpi?.stockAlerts ?? 0)}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          loading={isLoading}
          onClick={() => router.push('/ingredients')}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent orders */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Dernières commandes</h2>
            <Link href="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Voir toutes →
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-slate-700 rounded animate-skeleton" />
              ))}
            </div>
          ) : !kpi?.recentOrders?.length ? (
            <div className="text-center py-12">
              <ShoppingCart size={40} className="mx-auto text-neutral-300 mb-3" />
              <p className="text-sm text-neutral-500">Aucune commande pour le moment</p>
              <p className="text-xs text-neutral-400 mt-1">Les commandes de votre vitrine apparaîtront ici</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-slate-700">
              {kpi.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-neutral-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {order.customer.firstName} {order.customer.lastName}
                    </p>
                  </div>
                  <span className={`status-badge ${ORDER_STATUS_COLORS[order.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white ml-2">
                    {formatPrice(order.totalTTC)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stock alerts */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Alertes stock</h2>
            <Link href="/ingredients" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Voir tout →
            </Link>
          </div>

          {!stockAlerts?.length ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm text-neutral-500">Stock OK</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stockAlerts.slice(0, 6).map((alert) => (
                <Link
                  key={alert.id}
                  href={`/ingredients`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 hover:border-amber-300 transition-colors"
                >
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{alert.name}</p>
                    <p className="text-xs text-amber-600">
                      {alert.stockQuantity} {alert.unit} restant(s) — seuil : {alert.alertThreshold}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
