'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { OrderStatus } from '@prisma/client';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils/format';
import { Search, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/constants/order-status';
import { Crumb, Btn, Input, DataTable, Pill, type DataTableColumn } from '@/components/ui';

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalTTC: number;
  pickupDate: string | null;
  createdAt: string;
  customer: { firstName: string; lastName: string; email: string };
}

const ALL_STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP', 'CANCELLED'];

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
      const res = await apiClient.get<Order[]>(`/api/v1/orders?${sp}`);
      return { data: res.data, total: res.meta?.total ?? 0, totalPages: res.meta?.totalPages ?? 1 };
    },
  });

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns: DataTableColumn<Order>[] = [
    {
      key: 'orderNumber',
      label: 'N° Commande',
      render: (order) => <span className="font-mono font-medium text-choco-600 text-erp-xs">{order.orderNumber}</span>,
    },
    {
      key: 'customer',
      label: 'Client',
      render: (order) => (
        <div>
          <p className="font-medium text-choco-600">{order.customer.firstName} {order.customer.lastName}</p>
          <p className="text-erp-xs text-neutral-400">{order.customer.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (order) => <Pill tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Pill>,
    },
    {
      key: 'pickupDate',
      label: 'Retrait',
      render: (order) =>
        order.pickupDate ? (
          <span className="flex items-center gap-1 text-erp-xs text-neutral-500">
            <Calendar size={12} />
            {format(parseISO(order.pickupDate), 'dd MMM yyyy', { locale: fr })}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (order) => <span className="font-semibold text-choco-600">{formatPrice(order.totalTTC)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: 32,
      render: (order) => (
        <Link href={`/orders/${order.id}`} className="p-1 text-neutral-300 hover:text-choco-500 transition-colors">
          <ChevronRight size={16} />
        </Link>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Commandes']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Commandes</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">{total} commande{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <Input
          icon={<Search size={14} />}
          placeholder="N° commande, client..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          containerClassName="flex-1 min-w-[200px] max-w-sm"
        />
        <div className="flex gap-2 flex-wrap">
          <Btn size="sm" active={!statusFilter} variant={!statusFilter ? 'primary' : 'default'} onClick={() => setStatusFilter('')}>
            Toutes
          </Btn>
          {ALL_STATUSES.map((s) => (
            <Btn
              key={s}
              size="sm"
              active={statusFilter === s}
              variant={statusFilter === s ? 'primary' : 'default'}
              onClick={() => { setStatusFilter(s === statusFilter ? '' : s); setPage(1); }}
            >
              {ORDER_STATUS_LABELS[s]}
            </Btn>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 bg-neutral-100 rounded animate-skeleton" />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} rows={orders} emptyState="Aucune commande trouvée" />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--line-1)]">
            <p className="text-erp-xs text-neutral-500">{total} résultats</p>
            <div className="flex gap-2">
              <Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Btn>
              <span className="px-3 py-1 text-erp-xs text-neutral-500">{page} / {totalPages}</span>
              <Btn size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Suivant</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
