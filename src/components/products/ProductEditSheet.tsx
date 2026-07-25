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
  name: z.string().min(1, 'Requis').max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  priceHT: z.coerce.number().positive('Doit être > 0'),
  vatRateId: z.string().min(1, 'Requis'),
  marginTargetFactor: z.coerce.number().positive().optional(),
  isPerishable: z.boolean(),
});

type FormData = z.infer<typeof schema>;

// Cible par défaut quand l'admin ne configure pas la sienne — même repère indicatif
// qu'à la publication (ProductPublishSheet.tsx), jamais persisté comme valeur du champ.
const DEFAULT_MARGIN_TARGET = 3;

interface VatRateOption {
  id: string;
  label: string;
  ratePercent: string;
  isActive: boolean;
}

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceHT: string;
  vatRateId: string;
  marginTargetFactor: string | null;
  isPerishable: boolean;
  bomSheet: { name: string; outputUnit: string; stocks: Array<{ qtyAvailable: string; unitCost: string }> };
}

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  onSuccess: () => void;
}

export function ProductEditSheet({ open, onClose, productId, onSuccess }: Props) {
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: async () => {
      const res = await apiClient.get<ProductDetail>(`/api/v1/products/${productId}`);
      return res.data;
    },
    enabled: open && !!productId,
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
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', category: '', vatRateId: '', isPerishable: false },
  });

  useEffect(() => {
    if (open && product) {
      reset({
        name: product.name,
        description: product.description ?? '',
        category: product.category ?? '',
        priceHT: Number(product.priceHT),
        vatRateId: product.vatRateId,
        marginTargetFactor: product.marginTargetFactor ? Number(product.marginTargetFactor) : undefined,
        isPerishable: product.isPerishable,
      });
    }
  }, [open, product, reset]);

  const priceHT = watch('priceHT');
  const vatRateId = watch('vatRateId');
  const marginTargetFactor = watch('marginTargetFactor');
  const selectedVatRate = activeVatRates.find((v) => v.id === vatRateId) ?? vatRates?.find((v) => v.id === vatRateId);
  const priceTTC =
    priceHT > 0 && selectedVatRate ? priceHT * (1 + Number(selectedVatRate.ratePercent) / 100) : null;

  const avgUnitCost = (() => {
    const stocks = product?.bomSheet.stocks ?? [];
    const available = stocks.reduce((sum, s) => sum + Number(s.qtyAvailable), 0);
    if (available <= 0) return null;
    const weighted = stocks.reduce((sum, s) => sum + Number(s.qtyAvailable) * Number(s.unitCost), 0);
    return weighted / available;
  })();
  const marginRatio = avgUnitCost && priceHT > 0 ? priceHT / avgUnitCost : null;
  const marginTarget = marginTargetFactor || DEFAULT_MARGIN_TARGET;
  const marginComfortable = marginRatio !== null && marginRatio >= marginTarget;

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.patch(`/api/v1/products/${productId}`, {
        ...data,
        description: data.description || undefined,
        category: data.category || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-detail', productId] });
      toast.success('Produit modifié');
      onSuccess();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    },
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <div>
            <h2 className="text-erp-lg font-semibold text-choco-600">Modifier le produit</h2>
            {product && <p className="text-erp-xs text-neutral-500 mt-0.5">Fiche BOM : {product.bomSheet.name}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 p-6"><div className="h-40 bg-[var(--line-1)] rounded animate-pulse" /></div>
        ) : (
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Nom du produit <span className="text-framboise-400">*</span>
              </label>
              <input {...register('name')} className="form-input" />
              {errors.name && <p className="mt-1 text-erp-xs text-framboise-400">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">Description</label>
              <textarea {...register('description')} rows={3} className="form-input resize-none" />
            </div>

            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">Catégorie</label>
              <input {...register('category')} className="form-input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                  Prix de vente HT (€) <span className="text-framboise-400">*</span>
                </label>
                <input {...register('priceHT')} type="number" step="0.01" min="0" className="form-input" />
                {errors.priceHT && <p className="mt-1 text-erp-xs text-framboise-400">{errors.priceHT.message}</p>}
              </div>

              <div>
                <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                  Taux de TVA <span className="text-framboise-400">*</span>
                </label>
                <select {...register('vatRateId')} className="form-input">
                  {vatRates?.map((v) => (
                    <option key={v.id} value={v.id}>{v.label} ({Number(v.ratePercent)}%){!v.isActive ? ' — inactif' : ''}</option>
                  ))}
                </select>
                {errors.vatRateId && <p className="mt-1 text-erp-xs text-framboise-400">{errors.vatRateId.message}</p>}
              </div>
            </div>

            {priceTTC !== null && (
              <p className="text-erp-xs text-neutral-500 -mt-2">
                → Prix TTC : <span className="font-semibold text-choco-600">{priceTTC.toFixed(2)}€</span>
              </p>
            )}

            {marginRatio !== null && (
              <div
                className={`rounded-[var(--rx-input)] border px-3 py-2 text-erp-xs ${
                  marginComfortable
                    ? 'bg-[#E4F6E7] border-[#BFE3C5] text-[#1B5E20]'
                    : 'bg-[#FCEED7] border-[#E6CB99] text-[#7A4E1C]'
                }`}
              >
                Marge : x{marginRatio.toFixed(2)} le coût de revient ({avgUnitCost?.toFixed(2)}€)
                {marginComfortable ? ' — confortable' : ` — faible (cible x${marginTarget})`}
              </div>
            )}

            <div>
              <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                Facteur de marge cible <span className="text-neutral-400 font-normal">(optionnel, défaut x{DEFAULT_MARGIN_TARGET})</span>
              </label>
              <input {...register('marginTargetFactor')} type="number" step="0.1" min="0" className="form-input" />
            </div>

            <label className="flex items-center gap-2 text-erp-sm text-choco-600">
              <input type="checkbox" {...register('isPerishable')} className="rounded" />
              Produit périssable (clôture quotidienne requise)
            </label>
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
            onClick={handleSubmit((d) => updateMutation.mutate(d))}
            disabled={isSubmitting || updateMutation.isPending || isLoading}
            className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(isSubmitting || updateMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}
