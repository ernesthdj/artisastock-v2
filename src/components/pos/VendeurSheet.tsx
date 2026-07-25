'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

const createSchema = z.object({
  firstName: z.string().min(1, 'Requis').max(100),
  lastName: z.string().min(1, 'Requis').max(100),
  pin: z.string().regex(/^\d{4}$/, '4 chiffres'),
});

const resetPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, '4 chiffres'),
});

type CreateFormData = z.infer<typeof createSchema>;
type ResetPinFormData = z.infer<typeof resetPinSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  vendeurId: string | null;
}

export function VendeurSheet({ open, onClose, vendeurId }: Props) {
  const queryClient = useQueryClient();
  const isReset = !!vendeurId;

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { firstName: '', lastName: '', pin: '' },
  });
  const resetForm = useForm<ResetPinFormData>({
    resolver: zodResolver(resetPinSchema),
    defaultValues: { pin: '' },
  });

  useEffect(() => {
    if (open) {
      createForm.reset({ firstName: '', lastName: '', pin: '' });
      resetForm.reset({ pin: '' });
    }
  }, [open, createForm, resetForm]);

  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => apiClient.post('/api/v1/pos/vendeurs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-vendeurs'] });
      toast.success('Vendeur créé');
      onClose();
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const resetMutation = useMutation({
    mutationFn: (data: ResetPinFormData) => apiClient.patch(`/api/v1/pos/vendeurs/${vendeurId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-vendeurs'] });
      toast.success('PIN réinitialisé');
      onClose();
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">
            {isReset ? 'Réinitialiser le PIN' : 'Nouveau vendeur'}
          </h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        {isReset ? (
          <form onSubmit={resetForm.handleSubmit((d) => resetMutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Nouveau PIN <span className="text-framboise-400">*</span>
              </label>
              <input {...resetForm.register('pin')} type="text" inputMode="numeric" maxLength={4} placeholder="1234" className="form-input" />
              {resetForm.formState.errors.pin && (
                <p className="mt-1 text-erp-xs text-framboise-400">{resetForm.formState.errors.pin.message}</p>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Prénom <span className="text-framboise-400">*</span>
              </label>
              <input {...createForm.register('firstName')} className="form-input" />
              {createForm.formState.errors.firstName && (
                <p className="mt-1 text-erp-xs text-framboise-400">{createForm.formState.errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Nom <span className="text-framboise-400">*</span>
              </label>
              <input {...createForm.register('lastName')} className="form-input" />
              {createForm.formState.errors.lastName && (
                <p className="mt-1 text-erp-xs text-framboise-400">{createForm.formState.errors.lastName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                PIN (4 chiffres) <span className="text-framboise-400">*</span>
              </label>
              <input {...createForm.register('pin')} type="text" inputMode="numeric" maxLength={4} placeholder="1234" className="form-input" />
              {createForm.formState.errors.pin && (
                <p className="mt-1 text-erp-xs text-framboise-400">{createForm.formState.errors.pin.message}</p>
              )}
            </div>
          </form>
        )}

        <div className="px-6 py-4 border-t border-[var(--line-1)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--line-2)] rounded-[var(--rx-input)] text-erp-sm font-medium text-choco-600 hover:bg-[var(--surface-hover)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={isReset ? resetForm.handleSubmit((d) => resetMutation.mutate(d)) : createForm.handleSubmit((d) => createMutation.mutate(d))}
            disabled={createMutation.isPending || resetMutation.isPending}
            className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(createMutation.isPending || resetMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            {isReset ? 'Réinitialiser' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}
