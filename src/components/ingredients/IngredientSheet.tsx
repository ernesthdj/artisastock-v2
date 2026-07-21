'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { UnitOfMeasure } from '@prisma/client';
import { cn } from '@/lib/utils/cn';

const schema = z.object({
  name: z.string().min(1, 'Requis').max(200),
  category: z.string().min(1, 'Requis'),
  unit: z.nativeEnum(UnitOfMeasure, { errorMap: () => ({ message: 'Requis' }) }),
  priceUnit: z.coerce.number().positive('Doit être > 0'),
  stock: z.coerce.number().min(0).optional(),
  alertThreshold: z.coerce.number().min(0).optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  ingredientId: string | null;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'DRY', label: 'Sec' },
  { value: 'FRESH', label: 'Frais' },
  { value: 'FROZEN', label: 'Congelé' },
  { value: 'LIQUID', label: 'Liquide' },
  { value: 'SPICE', label: 'Épice' },
  { value: 'DAIRY', label: 'Laitier' },
  { value: 'FLOUR', label: 'Farine' },
  { value: 'SUGAR', label: 'Sucre' },
  { value: 'OTHER', label: 'Autre' },
];

const UNITS: Array<{ value: UnitOfMeasure; label: string }> = [
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'MG', label: 'mg' },
  { value: 'CG', label: 'cg' },
  { value: 'L', label: 'L' },
  { value: 'DL', label: 'dl' },
  { value: 'CL', label: 'cl' },
  { value: 'ML', label: 'ml' },
  { value: 'PIECE', label: 'pièce' },
  { value: 'DOZEN', label: 'douzaine' },
];

export function IngredientSheet({ open, onClose, ingredientId, onSuccess }: Props) {
  const isEdit = !!ingredientId;

  const { data: existing } = useQuery({
    queryKey: ['ingredient', ingredientId],
    queryFn: async () => {
      const res = await apiClient.get<FormData>(`/api/v1/ingredients/${ingredientId}`);
      return res.data;
    },
    enabled: !!ingredientId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; name: string }>>('/api/v1/suppliers?pageSize=100');
      return res.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      if (existing && isEdit) {
        reset(existing);
      } else if (!isEdit) {
        reset({});
      }
    }
  }, [open, existing, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      supplierId: data.supplierId || undefined,
      notes: data.notes || undefined,
    };
    try {
      if (isEdit) {
        await apiClient.patch(`/api/v1/ingredients/${ingredientId}`, payload);
        toast.success('Ingrédient modifié');
      } else {
        await apiClient.post('/api/v1/ingredients', payload);
        toast.success('Ingrédient créé');
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE') {
        toast.error('Un ingrédient avec ce nom existe déjà');
      } else {
        toast.error('Une erreur est survenue');
      }
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-white dark:bg-slate-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {isEdit ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient'}
          </h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Nom" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Farine T55" className="form-input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie" required error={errors.category?.message}>
              <select {...register('category')} className="form-input">
                <option value="">Choisir...</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>

            <Field label="Unité" required error={errors.unit?.message}>
              <select {...register('unit')} className="form-input">
                <option value="">Choisir...</option>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix / unité (€)" required error={errors.priceUnit?.message}>
              <input {...register('priceUnit')} type="number" step="0.001" min="0" placeholder="0.800" className="form-input" />
            </Field>

            <Field label="Fournisseur" error={undefined}>
              <select {...register('supplierId')} className="form-input">
                <option value="">Aucun</option>
                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock actuel" error={errors.stock?.message}>
              <input {...register('stock')} type="number" step="0.01" min="0" placeholder="25" className="form-input" />
            </Field>

            <Field label="Seuil d'alerte" error={errors.alertThreshold?.message}>
              <input {...register('alertThreshold')} type="number" step="0.01" min="0" placeholder="5" className="form-input" />
            </Field>
          </div>

          <Field label="Notes" error={undefined}>
            <textarea {...register('notes')} rows={3} placeholder="Notes optionnelles..." className="form-input resize-none" />
          </Field>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-neutral-200 dark:border-slate-600 rounded-lg text-sm font-medium text-neutral-700 dark:text-slate-200 hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Modifier' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
