'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils/format';
import { Search, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalTTC: number;
  pickupDate: string | null;
  createdAt: string;
  customer: { firstName: string; lastName: string; email: string };
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouvelle', CONFIRMED: 'Confirmée', IN_PREPARATION: 'En préparation',
  READY: 'Prête', PICKED_UP: 'Retirée', CANCELLED: 'Annulée',
};
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-violet-100 text-violet-700',
  IN_PREPARATION: 'bg-amber-100 text-amber-700', READY: 'bg-green-100 text-green-700',
  PICKED_UP: 'bg-neutral-100 text-neutral-600', CANCELLED: 'bg-red-100 text-red-600',
};

const ALL_STATUSES = ['NEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP', 'CANCELLED'];

export default function OrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', search, statusFilter, page],
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) sp.set('search', search);
      if (statusFilter) sp.set('status', statusFilter);
      const res = await apiClient.get<{ data: Order[]; total: number; totalPages: number }>(
        `/api/v1/orders?${sp}`
      );
      return res.data;
    },
  });

  const orders = (data as Record<string, unknown>)?.['data'] as Order[] ?? [];
  const total = (data as Record<string, unknown>)?.['total'] as number ?? 0;
  const totalPages = (data as Record<string, unknown>)?.['totalPages'] as number ?? 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <nav className="text-xs text-neutral-400 mb-1">Dashboard &rsaquo; Commandes</nav>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Commandes</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{total} commande{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="N° commande, client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 text-sm border border-neutral-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !statusFilter ? 'bg-primary-600 text-white border-primary-600' : 'border-neutral-200 dark:border-slate-600 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            Toutes
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s === statusFilter ? '' : s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === s ? 'bg-primary-600 text-white border-primary-600' : 'border-neutral-200 dark:border-slate-600 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-slate-700 bg-neutral-50 dark:bg-slate-700/50">
                <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">N° Commande</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300 hidden md:table-cell">Retrait</th>
                <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Total</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-neutral-100 rounded animate-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-neutral-500">
                    <p>Aucune commande trouvée</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="data-table-row group">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-neutral-900 dark:text-white text-xs">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                      <p className="text-xs text-neutral-400">{order.customer.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${STATUS_COLORS[order.status] ?? ''}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 hidden md:table-cell">
                      {order.pickupDate ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Calendar size={12} />
                          {format(parseISO(order.pickupDate), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-white">
                      {formatPrice(order.totalTTC)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="p-1 text-neutral-300 group-hover:text-neutral-600 transition-colors">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 dark:border-slate-700">
            <p className="text-xs text-neutral-500">{total} résultats</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="px-3 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-40">
                Précédent
              </button>
              <span className="px-3 py-1 text-xs text-neutral-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="px-3 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-40">
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
