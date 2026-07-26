'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Crumb, Btn, Pill } from '@/components/ui';
import { VendeurPicker } from '@/components/pos/VendeurPicker';

const pinSchema = z.string().regex(/^\d{4}$/, '4 chiffres');
const pointageSchema = z.object({ pin: pinSchema });
type PointageFormData = z.infer<typeof pointageSchema>;

interface PointageHoraire {
  id: string;
  vendeurId: string;
  clockIn: string;
  clockOut: string | null;
}

export default function PointagePage() {
  const queryClient = useQueryClient();
  const [vendeurId, setVendeurId] = useState<string | null>(null);
  const [lastClockOut, setLastClockOut] = useState<PointageHoraire | null>(null);

  const { data: pointage, isLoading } = useQuery({
    queryKey: ['pos-pointage-current', vendeurId],
    queryFn: async () => {
      const res = await apiClient.get<PointageHoraire | null>(`/api/v1/pos/vendeurs/${vendeurId}/pointage`);
      return res.data;
    },
    enabled: !!vendeurId,
  });

  const form = useForm<PointageFormData>({
    resolver: zodResolver(pointageSchema),
    defaultValues: { pin: '' },
  });

  const clockInMutation = useMutation({
    mutationFn: (data: PointageFormData) => apiClient.post(`/api/v1/pos/vendeurs/${vendeurId}/clock-in`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-pointage-current', vendeurId] });
      toast.success('Arrivée pointée');
      form.reset({ pin: '' });
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const clockOutMutation = useMutation({
    mutationFn: (data: PointageFormData) =>
      apiClient.post<PointageHoraire>(`/api/v1/pos/vendeurs/${vendeurId}/clock-out`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pos-pointage-current', vendeurId] });
      setLastClockOut(res.data);
      toast.success('Départ pointé');
      form.reset({ pin: '' });
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const changeVendeur = () => {
    setVendeurId(null);
    setLastClockOut(null);
    form.reset({ pin: '' });
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Point de vente', 'Pointage']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Pointage horaire</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">Pointer une arrivée ou un départ.</p>
      </div>

      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] p-6">
        {!vendeurId ? (
          <>
            <p className="text-erp-sm font-medium text-choco-600 mb-3">Qui êtes-vous ?</p>
            <VendeurPicker selectedId={vendeurId} onSelect={setVendeurId} />
          </>
        ) : (
          <div className="space-y-5">
            <button onClick={changeVendeur} className="text-erp-xs text-choco-500 hover:text-choco-600">
              ← Changer de vendeur
            </button>

            {isLoading ? (
              <div className="h-24 bg-neutral-100 rounded animate-skeleton" />
            ) : pointage ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone="ok">● Pointé</Pill>
                  <span className="text-erp-xs text-neutral-500">arrivée à {fmtTime(pointage.clockIn)}</span>
                </div>

                <form onSubmit={form.handleSubmit((d) => clockOutMutation.mutate(d))} className="space-y-3">
                  <div>
                    <label className="block text-erp-sm font-medium text-choco-600 mb-1">PIN</label>
                    <input
                      {...form.register('pin')}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      className="form-input"
                    />
                    {form.formState.errors.pin && (
                      <p className="mt-1 text-erp-xs text-framboise-400">{form.formState.errors.pin.message}</p>
                    )}
                  </div>
                  <Btn type="submit" variant="primary" disabled={clockOutMutation.isPending}>
                    Pointer le départ
                  </Btn>
                </form>
              </div>
            ) : lastClockOut ? (
              <div className="space-y-2">
                <Pill tone="neutral">Départ pointé à {fmtTime(lastClockOut.clockOut!)}</Pill>
                <p className="text-erp-xs text-neutral-500">
                  Arrivée à {fmtTime(lastClockOut.clockIn)} — pointage clôturé.
                </p>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit((d) => clockInMutation.mutate(d))} className="space-y-3">
                <div>
                  <label className="block text-erp-sm font-medium text-choco-600 mb-1">PIN</label>
                  <input
                    {...form.register('pin')}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    className="form-input"
                  />
                  {form.formState.errors.pin && (
                    <p className="mt-1 text-erp-xs text-framboise-400">{form.formState.errors.pin.message}</p>
                  )}
                </div>
                <Btn type="submit" variant="primary" disabled={clockInMutation.isPending}>
                  Pointer l&apos;arrivée
                </Btn>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
