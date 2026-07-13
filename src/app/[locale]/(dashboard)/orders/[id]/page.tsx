'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils/format';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePermissions } from '@/hooks/use-permissions';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
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

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouvelle', CONFIRMED: 'Confirmée', IN_PREPARATION: 'En préparation',
  READY: 'Prête', PICKED_UP: 'Retirée', CANCELLED: 'Annulée',
};
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-violet-100 text-violet-700',
  IN_PREPARATION: 'bg-amber-100 text-amber-700', READY: 'bg-green-100 text-green-700',
  PICKED_UP: 'bg-neutral-100 text-neutral-600', CANCELLED: 'bg-red-100 text-red-600',
};
const NEXT_STATUSES: Record<string, string[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP'],
  PICKED_UP: [],
  CANCELLED: [],
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: async () => {
      const res = await apiClient.get<OrderDetail>(`/api/v1/orders/${params.id}`);
      return res.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiClient.patch(`/api/v1/orders/${params.id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', params.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Statut mis à jour');
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/invoices/generate/${params.id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', params.id] });
      toast.success('Facture générée');
    },
    onError: () => toast.error('Erreur lors de la génération'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!order) return null;

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-3 transition-colors"
          >
            <ArrowLeft size={16} /> Retour aux commandes
          </button>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white font-mono">
            {order.orderNumber}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`status-badge ${STATUS_COLORS[order.status] ?? ''}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            {order.paidAt && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Payé le {format(parseISO(order.paidAt), 'dd/MM/yyyy', { locale: fr })}
              </span>
            )}
          </div>
        </div>

        {/* Actions statut */}
        {can('orders:write') && nextStatuses.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => statusMutation.mutate(s)}
                disabled={statusMutation.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  s === 'CANCELLED'
                    ? 'border border-red-200 text-red-600 hover:bg-red-50'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {statusMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Client</h2>
          <p className="font-semibold text-neutral-900 dark:text-white">
            {order.customer.firstName} {order.customer.lastName}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{order.customer.email}</p>
          {order.customer.phone && <p className="text-sm text-neutral-500">{order.customer.phone}</p>}
        </div>

        {/* Retrait */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Retrait</h2>
          {order.pickupDate ? (
            <>
              <p className="font-semibold text-neutral-900 dark:text-white capitalize">
                {format(parseISO(order.pickupDate), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              {order.pickupSlotStart && order.pickupSlotEnd && (
                <p className="text-sm text-neutral-500 mt-1">
                  {format(parseISO(order.pickupSlotStart), 'HH:mm')} – {format(parseISO(order.pickupSlotEnd), 'HH:mm')}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-400">Non défini</p>
          )}
        </div>

        {/* Facture */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Facture</h2>
          {order.invoice ? (
            <div className="space-y-2">
              <p className="font-mono text-sm font-medium text-neutral-900 dark:text-white">{order.invoice.invoiceNumber}</p>
              <a
                href={`/api/v1/invoices/${order.invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
              >
                <FileText size={14} /> Télécharger PDF
              </a>
            </div>
          ) : can('invoices:write') ? (
            <button
              onClick={() => generateInvoiceMutation.mutate()}
              disabled={generateInvoiceMutation.isPending}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {generateInvoiceMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Générer la facture
            </button>
          ) : (
            <p className="text-sm text-neutral-400">Aucune facture</p>
          )}
        </div>
      </div>

      {/* Articles */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Articles commandés</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-100 dark:border-slate-700">
              <th className="text-left px-6 py-3 font-semibold text-neutral-600 dark:text-slate-300">Produit</th>
              <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Qté</th>
              <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Prix unit.</th>
              <th className="text-right px-6 py-3 font-semibold text-neutral-600 dark:text-slate-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100 dark:border-slate-700">
                <td className="px-6 py-3 text-neutral-900 dark:text-white font-medium">{item.product.name}</td>
                <td className="px-4 py-3 text-center text-neutral-600">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{formatPrice(item.unitPrice)}</td>
                <td className="px-6 py-3 text-right font-semibold text-neutral-900 dark:text-white">{formatPrice(item.totalTTC)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-neutral-50 dark:bg-slate-700/30">
              <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-neutral-700 dark:text-slate-200">Total TTC</td>
              <td className="px-6 py-3 text-right text-lg font-bold text-primary-700 dark:text-primary-400">{formatPrice(order.totalTTC)}</td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <div className="px-6 py-4 border-t border-neutral-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Note client</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
