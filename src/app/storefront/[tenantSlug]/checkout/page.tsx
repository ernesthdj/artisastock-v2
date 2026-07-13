'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { toast } from 'sonner';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PickupSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  ordersCount: number;
  maxOrders: number;
}

const schema = z.object({
  firstName: z.string().min(1, 'Requis'),
  lastName: z.string().min(1, 'Requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  pickupDate: z.string().min(1, 'Choisissez une date'),
  pickupStartTime: z.string().min(1, 'Choisissez un créneau'),
  pickupEndTime: z.string(),
  notes: z.string().max(500).optional(),
  cgv: z.boolean().refine((v) => v, 'Requis'),
});

type FormData = z.infer<typeof schema>;

export default function CheckoutPage({ params }: { params: { tenantSlug: string } }) {
  const router = useRouter();
  const { items, totalTTC, clearCart } = useCartStore();
  const [selectedDate, setSelectedDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const pickupStartTime = watch('pickupStartTime');
  const pickupDate = watch('pickupDate');

  // Redirect si panier vide
  if (items.length === 0) {
    router.replace(`/storefront/${params.tenantSlug}/catalog`);
    return null;
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: slots } = useQuery({
    queryKey: ['pickup-slots', params.tenantSlug],
    queryFn: async () => {
      const res = await fetch(`/api/storefront/${params.tenantSlug}/pickup-slots/available?days=14`);
      const json = await res.json();
      return json.data as PickupSlot[];
    },
  });

  // Grouper les créneaux par date
  const slotsByDate = (slots ?? []).reduce<Record<string, PickupSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const availableDates = Object.keys(slotsByDate).sort();
  const slotsForDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/storefront/${params.tenantSlug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          customer: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone || undefined,
          },
          pickupSlot: {
            date: data.pickupDate,
            startTime: data.pickupStartTime,
            endTime: data.pickupEndTime,
          },
          locale: 'fr',
          notes: data.notes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? 'Erreur lors de la commande');
        return;
      }

      clearCart();
      window.location.href = json.data.stripeCheckoutUrl;
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-8">Passer commande</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-8">
            {/* Infos client */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="font-semibold text-neutral-900 dark:text-white mb-4">Vos informations</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">Prénom *</label>
                  <input {...register('firstName')} className="form-input" placeholder="Marie" />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">Nom *</label>
                  <input {...register('lastName')} className="form-input" placeholder="Dupont" />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">Email *</label>
                <input {...register('email')} type="email" className="form-input" placeholder="marie@exemple.be" />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">Téléphone</label>
                <input {...register('phone')} type="tel" className="form-input" placeholder="+32 470 00 00 00" />
              </div>
            </div>

            {/* Créneau de retrait */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-primary-600" />
                Choisir un créneau de retrait
              </h2>

              {!slots ? (
                <div className="flex items-center gap-2 text-neutral-500 text-sm py-4">
                  <Loader2 size={16} className="animate-spin" /> Chargement des créneaux...
                </div>
              ) : availableDates.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4">Aucun créneau disponible pour le moment.</p>
              ) : (
                <div className="space-y-4">
                  {/* Dates */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Date</label>
                    <div className="flex gap-2 flex-wrap">
                      {availableDates.slice(0, 14).map((date) => {
                        const hasAvailable = slotsByDate[date]?.some((s) => s.available);
                        return (
                          <button
                            key={date}
                            type="button"
                            disabled={!hasAvailable}
                            onClick={() => {
                              setSelectedDate(date);
                              setValue('pickupDate', date);
                              setValue('pickupStartTime', '');
                              setValue('pickupEndTime', '');
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              pickupDate === date
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                            }`}
                          >
                            <span className="capitalize">
                              {format(new Date(date + 'T12:00:00'), 'EEE d MMM', { locale: fr })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.pickupDate && <p className="mt-2 text-xs text-red-600">{errors.pickupDate.message}</p>}
                  </div>

                  {/* Heures */}
                  {selectedDate && (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Créneau horaire</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {slotsForDate.map((slot) => (
                          <button
                            key={`${slot.startTime}-${slot.endTime}`}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => {
                              setValue('pickupStartTime', slot.startTime);
                              setValue('pickupEndTime', slot.endTime);
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              pickupStartTime === slot.startTime
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                            }`}
                          >
                            <Clock size={13} />
                            {slot.startTime} – {slot.endTime}
                          </button>
                        ))}
                      </div>
                      {errors.pickupStartTime && <p className="mt-2 text-xs text-red-600">{errors.pickupStartTime.message}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="font-semibold text-neutral-900 dark:text-white mb-4">Note pour le boulanger</h2>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Allergies, demandes spéciales..."
                className="form-input resize-none"
              />
            </div>
          </div>

          {/* Summary + submit */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6 sticky top-24">
              <h2 className="font-semibold text-neutral-900 dark:text-white mb-4">Résumé</h2>
              <div className="space-y-2 pb-4 border-b border-neutral-100 dark:border-slate-700">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm text-neutral-600 dark:text-slate-300">
                    <span className="flex-1 truncate mr-2">{item.name} × {item.quantity}</span>
                    <span className="flex-shrink-0">{formatPrice(item.priceTTC * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between py-4 font-bold text-neutral-900 dark:text-white">
                <span>Total TTC</span>
                <span className="text-primary-700 dark:text-primary-400">{formatPrice(totalTTC())}</span>
              </div>

              <label className="flex items-start gap-2 text-sm text-neutral-600 dark:text-slate-400 cursor-pointer mb-4">
                <input {...register('cgv')} type="checkbox" className="mt-0.5 rounded border-neutral-300" />
                <span>
                  J&apos;accepte les{' '}
                  <span className="text-primary-600 underline cursor-pointer">conditions générales de vente</span>
                </span>
              </label>
              {errors.cgv && <p className="text-xs text-red-600 mb-3">{errors.cgv.message}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Redirection...' : 'Payer en ligne →'}
              </button>

              <p className="text-xs text-neutral-400 text-center mt-3">
                Paiement sécurisé par Stripe
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
