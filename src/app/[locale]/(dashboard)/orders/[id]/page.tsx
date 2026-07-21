'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils/format';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePermissions } from '@/hooks/use-permissions';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/constants/order-status';
import { Card, Btn, Pill, DataTable, type DataTableColumn } from '@/components/ui';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  pickupDate: string | null;
  pickupSlotStart: string | null;
  pickupSlotEnd: string | null;
  paidAt: string | null;
  notes: string | null;
  customer: { firstName: string; lastName: string; email: string; phone: string | null };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalTTC: number;
    product: { name: string; vatRate: string };
  }>;
  invoice: { id: string; invoiceNumber: string } | null;
}

const NEXT_STATUSES: Record<string, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP'],
  PICKED_UP: [],
  CANCELLED: [],
};

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalTTC: number;
  product: { name: string; vatRate: string };
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await apiClient.get<OrderDetail>(`/api/v1/orders/${id}`);
      return res.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiClient.patch(`/api/v1/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Statut mis à jour');
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/invoices/generate/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Facture générée');
    },
    onError: () => toast.error('Erreur lors de la génération'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-choco-500" size={32} />
      </div>
    );
  }

  if (!order) return null;

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];

  const itemColumns: DataTableColumn<OrderItem>[] = [
    { key: 'product', label: 'Produit', render: (item) => <span className="font-medium text-choco-600">{item.product.name}</span> },
    { key: 'quantity', label: 'Qté', align: 'right', render: (item) => item.quantity },
    { key: 'unitPrice', label: 'Prix unit.', align: 'right', render: (item) => formatPrice(item.unitPrice) },
    { key: 'total', label: 'Total', align: 'right', render: (item) => <span className="font-semibold text-choco-600">{formatPrice(item.totalTTC)}</span> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-erp-sm text-neutral-500 hover:text-choco-500 mb-3 transition-colors"
          >
            <ArrowLeft size={16} /> Retour aux commandes
          </button>
          <h1 className="text-erp-2xl font-bold text-choco-600 font-mono">{order.orderNumber}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Pill tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Pill>
            {order.paidAt && (
              <span className="text-erp-xs text-[#1B7A3E] flex items-center gap-1">
                <CheckCircle2 size={12} /> Payé le {format(parseISO(order.paidAt), 'dd/MM/yyyy', { locale: fr })}
              </span>
            )}
          </div>
        </div>

        {/* Actions statut */}
        {can('orders.manage') && nextStatuses.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {nextStatuses.map((s) => (
              <Btn
                key={s}
                variant={s === 'CANCELLED' ? 'danger' : 'primary'}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                {statusMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : ORDER_STATUS_LABELS[s]}
              </Btn>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client info */}
        <Card title="Client">
          <p className="font-semibold text-choco-600">{order.customer.firstName} {order.customer.lastName}</p>
          <p className="text-erp-sm text-neutral-500 mt-1">{order.customer.email}</p>
          {order.customer.phone && <p className="text-erp-sm text-neutral-500">{order.customer.phone}</p>}
        </Card>

        {/* Retrait */}
        <Card title="Retrait">
          {order.pickupDate ? (
            <>
              <p className="font-semibold text-choco-600 capitalize">
                {format(parseISO(order.pickupDate), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              {order.pickupSlotStart && order.pickupSlotEnd && (
                <p className="text-erp-sm text-neutral-500 mt-1">
                  {format(parseISO(order.pickupSlotStart), 'HH:mm')} – {format(parseISO(order.pickupSlotEnd), 'HH:mm')}
                </p>
              )}
            </>
          ) : (
            <p className="text-erp-sm text-neutral-400">Non défini</p>
          )}
        </Card>

        {/* Facture */}
        <Card title="Facture">
          {order.invoice ? (
            <div className="space-y-2">
              <p className="font-mono text-erp-sm font-medium text-choco-600">{order.invoice.invoiceNumber}</p>
              <a
                href={`/api/v1/invoices/${order.invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-erp-sm text-choco-500 hover:text-choco-600"
              >
                <FileText size={14} /> Télécharger PDF
              </a>
            </div>
          ) : can('invoices.generate') ? (
            <button
              onClick={() => generateInvoiceMutation.mutate()}
              disabled={generateInvoiceMutation.isPending}
              className="flex items-center gap-2 text-erp-sm text-choco-500 hover:text-choco-600 disabled:opacity-50"
            >
              {generateInvoiceMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Générer la facture
            </button>
          ) : (
            <p className="text-erp-sm text-neutral-400">Aucune facture</p>
          )}
        </Card>
      </div>

      {/* Articles */}
      <Card title="Articles commandés" padded={false} foot={
        <div className="flex justify-end items-baseline gap-3">
          <span className="text-erp-sm font-semibold text-choco-500">Total TTC</span>
          <span className="text-erp-lg font-bold text-choco-600">{formatPrice(order.totalTTC)}</span>
        </div>
      }>
        <DataTable columns={itemColumns} rows={order.items} />

        {order.notes && (
          <div className="px-3.5 py-3 border-t border-[var(--line-1)] bg-[#FFF8EC]">
            <p className="text-erp-xs font-semibold text-or-600 uppercase tracking-wide mb-1">Note client</p>
            <p className="text-erp-sm text-choco-500">{order.notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
