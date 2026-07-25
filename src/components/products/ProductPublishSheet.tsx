'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

const schema = z.object({
  bomSheetId: z.string().min(1, 'Requis'),
  name: z.string().min(1, 'Requis').max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  priceHT: z.coerce.number().positive('Doit être > 0'),
  vatRateId: z.string().min(1, 'Requis'),
  isPerishable: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface BomSheetOption {
  id: string;
  name: string;
  outputUnit: string;
  availableStock: number;
}

interface VatRateOption {
  id: string;
  label: string;
  ratePercent: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductPublishSheet({ open, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();

  const { data: sheets, isLoading: sheetsLoading } = useQuery({
    queryKey: ['bom-sheets-with-stock'],
    queryFn: async () => {
      const res = await apiClient.get<BomSheetOption[]>('/api/v1/bom/sheets?hasStock=true&pageSize=100');
      return res.data;
    },
    enabled: open,
  });

  const { data: vatRates } = useQuery({
    queryKey: ['tenant-vat-rates'],
    queryFn: async () => {
      const res = await apiClient.get<VatRateOption[]>('/api/v1/tenant-vat-rates?pageSize=100');
      return res.data;
    },
    enabled: open,
  });

  const activeVatRates = vatRates?.filter((v) => v.isActive) ?? [];

  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bomSheetId: '', name: '', description: '', category: '', vatRateId: '', isPerishable: false },
  });

  useEffect(() => {
    if (open) {
      reset({ bomSheetId: '', name: '', description: '', category: '', vatRateId: '', isPerishable: false });
    }
  }, [open, reset]);

  const publishMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post('/api/v1/products', {
        ...data,
        description: data.description || undefined,
        category: data.category || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit publié');
      onSuccess();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'NO_STOCK') {
        setError('bomSheetId', { message: err.message });
      } else if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('name', { message: 'Un produit avec ce nom existe déjà' });
      } else {
        toast.error(err instanceof Error ? err.message : 'Une erreur est survenue');
      }
    },
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">Publier un produit</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => publishMutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Fiche BOM <span className="text-framboise-400">*</span>
            </label>
            <select {...register('bomSheetId')} className="form-input" disabled={sheetsLoading}>
              <option value="">
                {sheetsLoading ? 'Chargement...' : 'Choisir une fiche avec stock disponible...'}
              </option>
              {sheets?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.availableStock} {s.outputUnit.toLowerCase()} disponible(s)
                </option>
              ))}
            </select>
            {!sheetsLoading && sheets?.length === 0 && (
              <p className="mt-1 text-erp-xs text-choco-400 italic">
                Aucune fiche BOM n&apos;a de stock produit — lancez une production d&apos;abord.
              </p>
            )}
            {errors.bomSheetId && <p className="mt-1 text-erp-xs text-framboise-400">{errors.bomSheetId.message}</p>}
          </div>

          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Nom du produit <span className="text-framboise-400">*</span>
            </label>
            <input {...register('name')} placeholder="Croissant pur beurre" className="form-input" />
            {errors.name && <p className="mt-1 text-erp-xs text-framboise-400">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">Description</label>
            <textarea {...register('description')} rows={3} placeholder="Description optionnelle..." className="form-input resize-none" />
          </div>

          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">Catégorie</label>
            <input {...register('category')} placeholder="Viennoiserie, Pain..." className="form-input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Prix de vente HT (€) <span className="text-framboise-400">*</span>
              </label>
              <input {...register('priceHT')} type="number" step="0.01" min="0" placeholder="1.50" className="form-input" />
              {errors.priceHT && <p className="mt-1 text-erp-xs text-framboise-400">{errors.priceHT.message}</p>}
            </div>

            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Taux de TVA <span className="text-framboise-400">*</span>
              </label>
              <select {...register('vatRateId')} className="form-input">
                <option value="">Choisir...</option>
                {activeVatRates.map((v) => (
                  <option key={v.id} value={v.id}>{v.label} ({Number(v.ratePercent)}%)</option>
                ))}
              </select>
              {errors.vatRateId && <p className="mt-1 text-erp-xs text-framboise-400">{errors.vatRateId.message}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-erp-sm text-choco-600">
            <input type="checkbox" {...register('isPerishable')} className="rounded" />
            Produit périssable (clôture quotidienne requise)
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
            onClick={handleSubmit((d) => publishMutation.mutate(d))}
            disabled={isSubmitting || publishMutation.isPending}
            className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(isSubmitting || publishMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            Publier
          </button>
        </div>
      </div>
    </>
  );
}
