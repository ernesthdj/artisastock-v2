'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

const schema = z
  .object({
    bomStockId: z.string().min(1, 'Requis'),
    vitrineQty: z.coerce.number().min(0),
    directQty: z.coerce.number().min(0),
  })
  .refine((d) => d.vitrineQty > 0 || d.directQty > 0, {
    message: 'Au moins un canal doit recevoir une quantité > 0',
    path: ['vitrineQty'],
  });

type FormData = z.infer<typeof schema>;

interface BomStockLot {
  id: string;
  qtyAvailable: string;
  unitCost: string;
  producedAt: string;
}

interface ChannelStock {
  id: string;
  bomStockId: string;
  channel: 'VITRINE' | 'DIRECT';
  qtyAllocated: string;
  qtyRemaining: string;
}

interface ProductDetail {
  id: string;
  bomSheet: { id: string; name: string; outputUnit: string; stocks: BomStockLot[] };
  channelStock: ChannelStock[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName: string;
}

export function ProductAllocationPanel({ open, onClose, productId, productName }: Props) {
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: async () => {
      const res = await apiClient.get<ProductDetail>(`/api/v1/products/${productId}`);
      return res.data;
    },
    enabled: open && !!productId,
  });

  const { register, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bomStockId: '', vitrineQty: 0, directQty: 0 },
  });

  useEffect(() => {
    if (open) reset({ bomStockId: '', vitrineQty: 0, directQty: 0 });
  }, [open, productId, reset]);

  const selectedBomStockId = watch('bomStockId');
  const vitrineQty = watch('vitrineQty');
  const directQty = watch('directQty');

  const allocatedByLot = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of product?.channelStock ?? []) {
      map.set(c.bomStockId, (map.get(c.bomStockId) ?? 0) + Number(c.qtyAllocated));
    }
    return map;
  }, [product]);

  const selectedLot = product?.bomSheet.stocks.find((s) => s.id === selectedBomStockId);
  const alreadyAllocated = selectedLot ? allocatedByLot.get(selectedLot.id) ?? 0 : 0;
  const remaining = selectedLot ? Number(selectedLot.qtyAvailable) - alreadyAllocated - (vitrineQty || 0) - (directQty || 0) : null;

  const allocateMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post(`/api/v1/products/${productId}/allocations`, {
        bomStockId: data.bomStockId,
        allocations: [
          { channel: 'VITRINE', qty: data.vitrineQty },
          { channel: 'DIRECT', qty: data.directQty },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-detail', productId] });
      toast.success('Allocation enregistrée');
      reset({ bomStockId: selectedBomStockId, vitrineQty: 0, directQty: 0 });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        setError('vitrineQty', { message: err.message });
      } else {
        toast.error(err instanceof Error ? err.message : 'Une erreur est survenue');
      }
    },
  });

  if (!open) return null;

  const outputUnit = product?.bomSheet.outputUnit.toLowerCase() ?? '';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <div>
            <h2 className="text-erp-lg font-semibold text-choco-600">Allouer le stock</h2>
            <p className="text-erp-xs text-neutral-500 mt-0.5">{productName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="h-24 bg-[var(--line-1)] rounded animate-pulse" />
          ) : (
            <>
              <form className="space-y-4">
                <div>
                  <label className="block text-erp-sm font-medium text-choco-600 mb-1">
                    Lot de production <span className="text-framboise-400">*</span>
                  </label>
                  <select {...register('bomStockId')} className="form-input">
                    <option value="">Choisir un lot...</option>
                    {product?.bomSheet.stocks.map((s) => {
                      const alloc = allocatedByLot.get(s.id) ?? 0;
                      const free = Number(s.qtyAvailable) - alloc;
                      return (
                        <option key={s.id} value={s.id}>
                          {new Date(s.producedAt).toLocaleDateString('fr-BE')} — {free} {outputUnit} restant(s) à allouer sur {Number(s.qtyAvailable)}
                        </option>
                      );
                    })}
                  </select>
                  {product?.bomSheet.stocks.length === 0 && (
                    <p className="mt-1 text-erp-xs text-choco-400 italic">Aucun lot de production disponible.</p>
                  )}
                </div>

                {selectedLot && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-erp-sm font-medium text-choco-600 mb-1">Vitrine (en ligne)</label>
                      <input {...register('vitrineQty')} type="number" step="0.01" min="0" className="form-input" />
                    </div>
                    <div>
                      <label className="block text-erp-sm font-medium text-choco-600 mb-1">Direct (comptoir)</label>
                      <input {...register('directQty')} type="number" step="0.01" min="0" className="form-input" />
                    </div>
                  </div>
                )}

                {errors.vitrineQty && <p className="text-erp-xs text-framboise-400">{errors.vitrineQty.message}</p>}

                {selectedLot && remaining !== null && (
                  <p className={`text-erp-xs ${remaining < 0 ? 'text-framboise-400 font-semibold' : 'text-neutral-500'}`}>
                    {remaining < 0
                      ? `Dépasse le lot de ${Math.abs(remaining)} ${outputUnit}`
                      : `${remaining} ${outputUnit} resteront non alloué(s) sur ce lot`}
                  </p>
                )}
              </form>

              <div>
                <p className="text-erp-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Allocations actuelles</p>
                {!product?.channelStock.length ? (
                  <p className="text-erp-xs text-neutral-400 italic">Aucune allocation pour ce produit.</p>
                ) : (
                  <div className="space-y-1.5">
                    {product.channelStock.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-erp-xs px-3 py-2 rounded border border-[var(--line-1)]">
                        <span className="font-medium text-choco-600">{c.channel === 'VITRINE' ? 'Vitrine' : 'Direct'}</span>
                        <span className="text-neutral-500">
                          {Number(c.qtyRemaining)} / {Number(c.qtyAllocated)} {outputUnit} restant(s)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--line-1)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--line-2)] rounded-[var(--rx-input)] text-erp-sm font-medium text-choco-600 hover:bg-[var(--surface-hover)] transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={handleSubmit((d) => allocateMutation.mutate(d))}
            disabled={isSubmitting || allocateMutation.isPending || !selectedLot}
            className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(isSubmitting || allocateMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            Allouer
          </button>
        </div>
      </div>
    </>
  );
}
