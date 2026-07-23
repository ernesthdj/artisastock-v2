'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { VatRate } from '@prisma/client';
import { VAT_LABELS } from '@/lib/utils/vat';

const INPUT_CLASS =
  'px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

const schema = z.object({
  ingredientId: z.string().min(1, 'Ingrédient requis'),
  stockId: z.string().min(1, 'Stock requis'),
  supplierId: z.string().optional(),
  lotNumber: z.string().max(100).optional(),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().optional(),
  purchaseMode: z.enum(['CONDITIONNEMENT', 'LOT']),
  quantity: z.coerce.number().positive('Doit être > 0'),
  priceMode: z.enum(['HT', 'TTC']),
  priceEntered: z.coerce.number().positive('Doit être > 0'),
  vatRate: z.nativeEnum(VatRate),
  invoiceRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingId?: string | null;
  defaultIngredientId?: string;
}

export function AchatSheet({ open, onClose, editingId, defaultIngredientId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!editingId;

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients-list'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{
        id: string; name: string; unitsPerLot: number; pricePack: string | null;
        defaultStockId: string | null; supplierId: string | null; dlcDaysReference: number | null;
      }>>('/api/v1/ingredients?pageSize=200');
      return res.data;
    },
  });

  const { data: stocks } = useQuery({
    queryKey: ['stocks-list'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; name: string }>>('/api/v1/stocks?pageSize=100');
      return res.data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; name: string }>>('/api/v1/suppliers?pageSize=100');
      return res.data;
    },
  });

  const { data: existing } = useQuery({
    queryKey: ['achat', editingId],
    queryFn: async () => {
      const res = await apiClient.get<{
        ingredientId: string; stockId: string; supplierId: string | null; lotNumber: string | null;
        purchaseDate: string; expiryDate: string | null; quantityInitial: string; unitPrice: string;
        vatRate: VatRate; invoiceRef: string | null; notes: string | null;
      }>(`/api/v1/achats/${editingId}`);
      return res.data;
    },
    enabled: !!editingId,
  });

  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { purchaseMode: 'CONDITIONNEMENT', priceMode: 'HT', vatRate: 'STANDARD_21' },
  });

  const today = () => new Date().toISOString().slice(0, 10);

  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  useEffect(() => {
    if (open) {
      if (existing && isEdit) {
        reset({
          ingredientId: existing.ingredientId,
          stockId: existing.stockId,
          supplierId: existing.supplierId ?? undefined,
          lotNumber: existing.lotNumber ?? undefined,
          purchaseDate: existing.purchaseDate?.slice(0, 10),
          expiryDate: existing.expiryDate?.slice(0, 10) ?? undefined,
          purchaseMode: 'CONDITIONNEMENT',
          quantity: Number(existing.quantityInitial),
          priceMode: 'HT',
          priceEntered: Number(existing.unitPrice),
          vatRate: existing.vatRate,
          invoiceRef: existing.invoiceRef ?? undefined,
          notes: existing.notes ?? undefined,
        });
      } else if (!isEdit) {
        reset({
          ingredientId: defaultIngredientId ?? '',
          purchaseMode: 'CONDITIONNEMENT',
          priceMode: 'HT',
          vatRate: 'STANDARD_21',
          purchaseDate: today(),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing, isEdit, defaultIngredientId, reset]);

  const purchaseMode = watch('purchaseMode');
  const ingredientId = watch('ingredientId');
  const selectedIngredient = ingredients?.find((i) => i.id === ingredientId);

  // Pré-remplissage depuis la fiche ingrédient à la sélection (gain de temps — reste
  // entièrement modifiable ensuite, ce ne sont que des suggestions de départ).
  useEffect(() => {
    if (isEdit || !selectedIngredient) return;
    if (selectedIngredient.pricePack) {
      // pricePack est toujours stocké HTVA — on aligne le mode de saisie pour éviter toute confusion
      setValue('priceMode', 'HT');
      setValue('priceEntered', Number(selectedIngredient.pricePack));
    }
    if (selectedIngredient.defaultStockId) setValue('stockId', selectedIngredient.defaultStockId);
    if (selectedIngredient.supplierId) setValue('supplierId', selectedIngredient.supplierId);
    // DLC suggérée uniquement si l'ingrédient a une référence — certains produits (alcools...)
    // n'en ont pas : le champ est alors vidé (pas de résidu d'une sélection précédente) et
    // reste entièrement optionnel, jamais obligatoire.
    if (selectedIngredient.dlcDaysReference) {
      const base = getValues('purchaseDate') || today();
      setValue('expiryDate', addDays(base, selectedIngredient.dlcDaysReference));
    } else {
      setValue('expiryDate', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIngredient, isEdit]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        supplierId: data.supplierId || undefined,
        lotNumber: data.lotNumber || undefined,
        purchaseDate: data.purchaseDate || undefined,
        expiryDate: data.expiryDate || undefined,
        invoiceRef: data.invoiceRef || undefined,
        notes: data.notes || undefined,
      };
      return isEdit
        ? apiClient.patch(`/api/v1/achats/${editingId}`, payload)
        : apiClient.post('/api/v1/achats', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achats'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success(isEdit ? 'Achat mis à jour' : 'Achat enregistré');
      onClose();
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 flex flex-col w-full max-w-[480px] h-full bg-white dark:bg-[#1a0f0a] shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            {isEdit ? "Modifier l'achat" : 'Nouvel achat'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30">
            <X size={20} className="text-amber-700 dark:text-amber-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col flex-1 p-6 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Ingrédient <span className="text-red-500">*</span>
            </label>
            <select {...register('ingredientId')} disabled={isEdit} className={INPUT_CLASS}>
              <option value="">-- Sélectionner --</option>
              {ingredients?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            {errors.ingredientId && <p className="text-xs text-red-500">{errors.ingredientId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Stock <span className="text-red-500">*</span>
              </label>
              <select {...register('stockId')} className={INPUT_CLASS}>
                <option value="">-- Choisir --</option>
                {stocks?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {errors.stockId && <p className="text-xs text-red-500">{errors.stockId.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Fournisseur</label>
              <select {...register('supplierId')} className={INPUT_CLASS}>
                <option value="">Aucun</option>
                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Mode de saisie de la quantité</label>
            <div className="flex gap-4 text-sm text-amber-800 dark:text-amber-200">
              <label className="flex items-center gap-1.5">
                <input type="radio" value="CONDITIONNEMENT" {...register('purchaseMode')} /> Conditionnement(s)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" value="LOT" {...register('purchaseMode')} /> Lot(s)
              </label>
            </div>
            {selectedIngredient && purchaseMode === 'LOT' && (
              <p className="text-xs text-amber-500 italic">
                1 lot = {selectedIngredient.unitsPerLot} conditionnement(s)
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Quantité ({purchaseMode === 'LOT' ? 'lots' : 'conditionnements'}) <span className="text-red-500">*</span>
            </label>
            <input {...register('quantity')} type="number" step="any" min="0" className={INPUT_CLASS} />
            {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Mode de saisie du prix</label>
            <div className="flex gap-4 text-sm text-amber-800 dark:text-amber-200">
              <label className="flex items-center gap-1.5">
                <input type="radio" value="HT" {...register('priceMode')} /> HTVA
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" value="TTC" {...register('priceMode')} /> TVAC
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Prix / conditionnement (€) <span className="text-red-500">*</span>
              </label>
              <input {...register('priceEntered')} type="number" step="0.01" min="0" className={INPUT_CLASS} />
              {errors.priceEntered && <p className="text-xs text-red-500">{errors.priceEntered.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">TVA</label>
              <select {...register('vatRate')} className={INPUT_CLASS}>
                {Object.entries(VAT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Date d&apos;achat</label>
              <input {...register('purchaseDate')} type="date" className={INPUT_CLASS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Péremption</label>
              <input {...register('expiryDate')} type="date" className={INPUT_CLASS} />
              <p className="text-xs text-amber-400 italic">Optionnel — laissez vide si non applicable (alcools...)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">N° de lot</label>
              <input {...register('lotNumber')} className={INPUT_CLASS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Réf. facture</label>
              <input {...register('invoiceRef')} className={INPUT_CLASS} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Notes</label>
            <textarea {...register('notes')} rows={2} className={`${INPUT_CLASS} resize-none`} />
          </div>

          <div className="mt-auto flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex-1 py-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : "Enregistrer l'achat"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
