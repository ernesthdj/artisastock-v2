'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Loader2, Package, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';

interface OrderTracking {
  orderNumber: string;
  status: string;
  totalTTC: number;
  pickupDate: string | null;
  pickupSlot: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; totalTTC: number }>;
  tenantName: string;
}

const STATUS_STEPS = [
  { key: 'NEW', label: 'Commande reçue', icon: CheckCircle2 },
  { key: 'CONFIRMED', label: 'Confirmée', icon: CheckCircle2 },
  { key: 'IN_PREPARATION', label: 'En préparation', icon: Package },
  { key: 'READY', label: 'Prête à retirer', icon: Truck },
  { key: 'PICKED_UP', label: 'Retirée', icon: CheckCircle2 },
];

const STATUS_ORDER = ['NEW', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP'];

export default function OrderTrackingPage() {
  const params = useParams<{ tenantSlug: string; trackingToken: string }>();
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['tracking', params.trackingToken],
    queryFn: async () => {
      const res = await fetch(`/api/storefront/${params.tenantSlug}/order/${params.trackingToken}`);
      if (!res.ok) throw new Error('Commande introuvable');
      const json = await res.json();
      return json.data as OrderTracking;
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30s
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-xl font-semibold text-neutral-900 mb-2">Commande introuvable</p>
        <p className="text-neutral-500">Ce lien de suivi est invalide ou a expiré.</p>
      </div>
    );
  }

  const currentStatusIndex = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Suivi de commande</h1>
        <p className="text-neutral-500 mt-1">{order.tenantName}</p>
        <p className="text-sm text-neutral-400 font-mono mt-2">{order.orderNumber}</p>
      </div>

      {/* Progress tracker */}
      {!isCancelled ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6 mb-6">
          <div className="relative">
            {/* Progress line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-neutral-200 dark:bg-slate-600">
              <div
                className="h-full bg-primary-500 transition-all duration-500"
                style={{ width: `${(currentStatusIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
              />
            </div>

            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, i) => {
                const done = i <= currentStatusIndex;
                const current = i === currentStatusIndex;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex flex-col items-center gap-2" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10 ${
                      done ? 'bg-primary-600 text-white' : 'bg-neutral-200 dark:bg-slate-600 text-neutral-400'
                    } ${current ? 'ring-4 ring-primary-100' : ''}`}>
                      <Icon size={18} />
                    </div>
                    <span className={`text-xs text-center leading-tight ${done ? 'text-primary-700 font-semibold' : 'text-neutral-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pickup info */}
          {order.pickupDate && (
            <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-100">
              <div className="flex items-start gap-3">
                <Clock className="text-primary-600 mt-0.5 flex-shrink-0" size={18} />
                <div>
                  <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">Retrait prévu</p>
                  <p className="text-sm text-primary-700 dark:text-primary-400 mt-0.5 capitalize">{order.pickupDate}</p>
                  {order.pickupSlot && <p className="text-sm text-primary-600 dark:text-primary-400">{order.pickupSlot}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 p-6 mb-6 text-center">
          <p className="text-red-700 font-semibold">Cette commande a été annulée</p>
        </div>
      )}

      {/* Articles */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Votre commande</h2>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-slate-700">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.name}</p>
                <p className="text-xs text-neutral-400">× {item.quantity} · {formatPrice(item.unitPrice)} / unité</p>
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{formatPrice(item.totalTTC)}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-slate-700 flex justify-between items-center">
          <span className="font-bold text-neutral-900 dark:text-white">Total TTC</span>
          <span className="font-bold text-primary-700 dark:text-primary-400 text-lg">{formatPrice(order.totalTTC)}</span>
        </div>
      </div>
    </div>
  );
}
