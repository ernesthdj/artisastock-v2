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

const openSchema = z.object({
  pin: pinSchema,
  openingFloat: z.coerce.number().nonnegative('Doit être positif ou nul'),
});
const closeSchema = z.object({
  pin: pinSchema,
  closingFloat: z.coerce.number().nonnegative('Doit être positif ou nul'),
});

type OpenFormData = z.infer<typeof openSchema>;
type CloseFormData = z.infer<typeof closeSchema>;

interface SessionCaisse {
  id: string;
  vendeurId: string;
  openingFloat: string;
  closingFloat: string | null;
  variance: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
}

export default function CaissePage() {
  const queryClient = useQueryClient();
  const [vendeurId, setVendeurId] = useState<string | null>(null);
  const [lastClosed, setLastClosed] = useState<SessionCaisse | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ['pos-caisse-current', vendeurId],
    queryFn: async () => {
      const res = await apiClient.get<SessionCaisse | null>(`/api/v1/pos/caisse?vendeurId=${vendeurId}`);
      return res.data;
    },
    enabled: !!vendeurId,
  });

  const openForm = useForm<OpenFormData>({
    resolver: zodResolver(openSchema),
    defaultValues: { pin: '', openingFloat: 0 },
  });
  const closeForm = useForm<CloseFormData>({
    resolver: zodResolver(closeSchema),
    defaultValues: { pin: '', closingFloat: 0 },
  });

  const openMutation = useMutation({
    mutationFn: (data: OpenFormData) =>
      apiClient.post('/api/v1/pos/caisse/open', { vendeurId, pin: data.pin, openingFloat: data.openingFloat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-caisse-current', vendeurId] });
      toast.success('Caisse ouverte');
      openForm.reset({ pin: '', openingFloat: 0 });
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const closeMutation = useMutation({
    mutationFn: (data: CloseFormData) =>
      apiClient.post<SessionCaisse>(`/api/v1/pos/caisse/${session?.id}/close`, {
        vendeurId,
        pin: data.pin,
        closingFloat: data.closingFloat,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pos-caisse-current', vendeurId] });
      setLastClosed(res.data);
      toast.success('Caisse fermée');
      closeForm.reset({ pin: '', closingFloat: 0 });
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const changeVendeur = () => {
    setVendeurId(null);
    setLastClosed(null);
    openForm.reset({ pin: '', openingFloat: 0 });
    closeForm.reset({ pin: '', closingFloat: 0 });
  };

  const varianceTone = (variance: number) => {
    if (variance === 0) return 'ok' as const;
    return Math.abs(variance) < 1 ? ('warn' as const) : ('crit' as const);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Point de vente', 'Caisse']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Session de caisse</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">
          Ouverture et fermeture de caisse, calcul automatique de l&apos;écart.
        </p>
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
            ) : session ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone="ok">● Caisse ouverte</Pill>
                  <span className="text-erp-xs text-neutral-500">
                    depuis {new Date(session.openedAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })} · fond{' '}
                    {Number(session.openingFloat).toFixed(2)}€
                  </span>
                </div>

                <form onSubmit={closeForm.handleSubmit((d) => closeMutation.mutate(d))} className="space-y-3">
                  <div>
                    <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                      Fond de fermeture déclaré (€)
                    </label>
                    <input {...closeForm.register('closingFloat')} type="number" step="0.01" className="form-input" />
                    {closeForm.formState.errors.closingFloat && (
                      <p className="mt-1 text-erp-xs text-framboise-400">{closeForm.formState.errors.closingFloat.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-erp-sm font-medium text-choco-600 mb-1">PIN</label>
                    <input
                      {...closeForm.register('pin')}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      className="form-input"
                    />
                    {closeForm.formState.errors.pin && (
                      <p className="mt-1 text-erp-xs text-framboise-400">{closeForm.formState.errors.pin.message}</p>
                    )}
                  </div>
                  <Btn type="submit" variant="primary" disabled={closeMutation.isPending}>
                    Fermer la caisse
                  </Btn>
                </form>
              </div>
            ) : lastClosed ? (
              <div className="space-y-2">
                <Pill tone={varianceTone(Number(lastClosed.variance))}>
                  Écart : {Number(lastClosed.variance) > 0 ? '+' : ''}
                  {Number(lastClosed.variance).toFixed(2)}€
                </Pill>
                <p className="text-erp-xs text-neutral-500">
                  Fond déclaré {Number(lastClosed.closingFloat).toFixed(2)}€ — session fermée.
                </p>
              </div>
            ) : (
              <form onSubmit={openForm.handleSubmit((d) => openMutation.mutate(d))} className="space-y-3">
                <div>
                  <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                    Fond d&apos;ouverture déclaré (€)
                  </label>
                  <input {...openForm.register('openingFloat')} type="number" step="0.01" className="form-input" />
                  {openForm.formState.errors.openingFloat && (
                    <p className="mt-1 text-erp-xs text-framboise-400">{openForm.formState.errors.openingFloat.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-erp-sm font-medium text-choco-600 mb-1">PIN</label>
                  <input
                    {...openForm.register('pin')}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    className="form-input"
                  />
                  {openForm.formState.errors.pin && (
                    <p className="mt-1 text-erp-xs text-framboise-400">{openForm.formState.errors.pin.message}</p>
                  )}
                </div>
                <Btn type="submit" variant="primary" disabled={openMutation.isPending}>
                  Ouvrir la caisse
                </Btn>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
