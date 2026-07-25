'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

const schema = z.object({
  label: z.string().min(1, 'Requis').max(100),
  ratePercent: z.coerce.number().min(0, 'Doit être ≥ 0').max(100, 'Doit être ≤ 100'),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  initialData?: { label: string; ratePercent: string | number; isActive: boolean } | null;
  onSuccess: () => void;
}

export function TenantVatRateSheet({ open, onClose, editingId, initialData, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!editingId;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', ratePercent: 0, isActive: true },
  });

  useEffect(() => {
    if (open) {
      reset(
        isEdit && initialData
          ? { label: initialData.label, ratePercent: Number(initialData.ratePercent), isActive: initialData.isActive }
          : { label: '', ratePercent: 0, isActive: true }
      );
    }
  }, [open, isEdit, initialData, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? apiClient.patch(`/api/v1/tenant-vat-rates/${editingId}`, data)
        : apiClient.post('/api/v1/tenant-vat-rates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-vat-rates'] });
      toast.success(isEdit ? 'Taux de TVA modifié' : 'Taux de TVA créé');
      onSuccess();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        toast.error('Un taux de TVA avec ce libellé existe déjà');
      } else {
        toast.error(err instanceof Error ? err.message : 'Une erreur est survenue');
      }
    },
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">
            {isEdit ? 'Modifier le taux de TVA' : 'Nouveau taux de TVA'}
          </h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Libellé <span className="text-framboise-400">*</span>
            </label>
            <input
              {...register('label')}
              placeholder="TVA réduite alimentaire"
              className="form-input"
            />
            {errors.label && <p className="mt-1 text-erp-xs text-framboise-400">{errors.label.message}</p>}
          </div>

          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Taux (%) <span className="text-framboise-400">*</span>
            </label>
            <input
              {...register('ratePercent')}
              type="number" step="0.01" min="0" max="100" placeholder="6"
              className="form-input"
            />
            {errors.ratePercent && <p className="mt-1 text-erp-xs text-framboise-400">{errors.ratePercent.message}</p>}
          </div>

          <label className="flex items-center gap-2 text-erp-sm text-choco-600">
            <input type="checkbox" {...register('isActive')} className="rounded" />
            Actif (proposé à la création de produits)
          </label>
        </form>

        <div className="px-6 py-4 border-t border-[var(--line-1)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--line-2)] rounded-[var(--rx-input)] text-erp-sm font-medium text-choco-600 hover:bg-[var(--surface-hover)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit((d) => mutation.mutate(d))}
            disabled={isSubmitting || mutation.isPending}
            className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(isSubmitting || mutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Modifier' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </>
  );
}
