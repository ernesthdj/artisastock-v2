'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { UnitOfMeasure, PhysicalType } from '@prisma/client';

// La règle "densité obligatoire si liquide/poudre" est vérifiée manuellement à la soumission
// (pas via .refine()) — un .refine() sur ce schéma casse l'inférence de type du resolver
// react-hook-form. Le serveur applique la même règle indépendamment (ingredientCreateSchema).
const schema = z.object({
  name: z.string().min(1, 'Requis').max(200),
  category: z.string().min(1, 'Requis'),
  unit: z.nativeEnum(UnitOfMeasure, { errorMap: () => ({ message: 'Requis' }) }),
  physicalType: z.nativeEnum(PhysicalType, { errorMap: () => ({ message: 'Requis' }) }),
  density: z.coerce.number().positive().optional(),
  packagingLabel: z.string().max(100).optional(),
  priceUnit: z.coerce.number().positive('Doit être > 0'),
  pricePack: z.coerce.number().positive().optional(),
  packSize: z.coerce.number().positive().optional(),
  unitsPerLot: z.coerce.number().int().positive(),
  alertThreshold: z.coerce.number().min(0).optional(),
  dlcDaysReference: z.coerce.number().int().positive().optional(),
  qualityLabel: z.string().max(100).optional(),
  defaultStockId: z.string().optional(),
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

const PHYSICAL_TYPES: Array<{ value: PhysicalType; label: string }> = [
  { value: 'SOLID', label: 'Solide' },
  { value: 'LIQUID', label: 'Liquide' },
  { value: 'POWDER', label: 'Poudre' },
  { value: 'PIECE', label: 'Pièce' },
];

export function IngredientSheet({ open, onClose, ingredientId, onSuccess }: Props) {
  const isEdit = !!ingredientId;

  const { data: existing } = useQuery({
    queryKey: ['ingredient', ingredientId],
    queryFn: async () => {
      const res = await apiClient.get<FormData & { stock: string }>(`/api/v1/ingredients/${ingredientId}`);
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

  const { data: stocks } = useQuery({
    queryKey: ['stocks-list'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; name: string }>>('/api/v1/stocks?pageSize=100');
      return res.data;
    },
  });

  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { physicalType: 'PIECE', unitsPerLot: 1 },
  });

  const physicalType = watch('physicalType');
  const priceUnit = watch('priceUnit');
  const pricePack = watch('pricePack');
  const packSize = watch('packSize');
  const unitsPerLot = watch('unitsPerLot');

  // Synchronisation tripartite prixBase × qtéCond = prixCond × nbLot = prixLot (mirroring
  // FrmIngredientEdit.SyncFromBase/Cond/Lot). prixLot n'est pas persisté — c'est un helper de
  // saisie qui recalcule prixCond. Un flag _syncing empêche la récursion entre les 3 champs.
  const [priceLot, setPriceLot] = useState<number | ''>('');
  const syncing = useRef(false);

  useEffect(() => {
    if (open) {
      if (existing && isEdit) {
        reset(existing);
        setPriceLot(
          existing.pricePack && existing.unitsPerLot ? Number(existing.pricePack) * existing.unitsPerLot : ''
        );
      } else if (!isEdit) {
        // reset() ne remet à zéro QUE les champs listés ici — un objet partiel laisse les
        // autres champs (nom, label, quantités, prix...) inchangés d'une création à l'autre.
        reset({
          name: '',
          category: '' as FormData['category'],
          unit: undefined,
          physicalType: 'PIECE',
          density: undefined,
          packagingLabel: '',
          priceUnit: undefined,
          pricePack: undefined,
          packSize: undefined,
          unitsPerLot: 1,
          alertThreshold: undefined,
          dlcDaysReference: undefined,
          qualityLabel: '',
          defaultStockId: '',
          supplierId: '',
          notes: '',
        });
        setPriceLot('');
      }
    }
  }, [open, existing, isEdit, reset]);

  function syncFromBase(nextBase: number) {
    if (syncing.current) return;
    syncing.current = true;
    const qte = packSize || 0;
    const nbLot = unitsPerLot || 1;
    const nextCond = nextBase * qte;
    setValue('pricePack', qte > 0 ? nextCond : undefined);
    setPriceLot(qte > 0 ? nextCond * nbLot : '');
    syncing.current = false;
  }

  function syncFromCond(nextCond: number) {
    if (syncing.current) return;
    syncing.current = true;
    const qte = packSize || 0;
    const nbLot = unitsPerLot || 1;
    if (qte > 0) setValue('priceUnit', nextCond / qte);
    setPriceLot(nextCond * nbLot);
    syncing.current = false;
  }

  function syncFromLot(nextLot: number) {
    if (syncing.current) return;
    syncing.current = true;
    const qte = packSize || 0;
    const nbLot = unitsPerLot || 1;
    const nextCond = nbLot > 0 ? nextLot / nbLot : 0;
    setValue('pricePack', nextCond);
    if (qte > 0) setValue('priceUnit', nextCond / qte);
    syncing.current = false;
  }

  function syncFromQte(nextQte: number) {
    if (syncing.current) return;
    syncing.current = true;
    const base = priceUnit || 0;
    const nbLot = unitsPerLot || 1;
    const nextCond = base * nextQte;
    setValue('pricePack', nextQte > 0 ? nextCond : undefined);
    setPriceLot(nextQte > 0 ? nextCond * nbLot : '');
    syncing.current = false;
  }

  function syncFromNbLot(nextNbLot: number) {
    if (syncing.current) return;
    syncing.current = true;
    setPriceLot((pricePack || 0) * nextNbLot);
    syncing.current = false;
  }

  const onSubmit = async (data: FormData) => {
    if ((data.physicalType === 'LIQUID' || data.physicalType === 'POWDER') && data.density === undefined) {
      setError('density', { message: 'Densité obligatoire pour un type liquide ou poudre' });
      return;
    }
    const payload = {
      ...data,
      supplierId: data.supplierId || undefined,
      defaultStockId: data.defaultStockId || undefined,
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
      if (err instanceof ApiError && err.code === 'CONFLICT') {
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
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] bg-white dark:bg-slate-800 shadow-xl flex flex-col">
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

            <Field label="Unité de base" required error={errors.unit?.message}>
              <select {...register('unit')} className="form-input">
                <option value="">Choisir...</option>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type physique" required error={errors.physicalType?.message}>
              <select {...register('physicalType')} className="form-input">
                {PHYSICAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            {(physicalType === 'LIQUID' || physicalType === 'POWDER') && (
              <Field label="Densité" required error={errors.density?.message}>
                <input
                  {...register('density', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                  type="number" step="0.0001" min="0" placeholder="0.79" className="form-input"
                />
              </Field>
            )}
          </div>

          <Field label="Label conditionnement" error={undefined}>
            <input {...register('packagingLabel')} placeholder="Bouteille 1L, Sac 25kg..." className="form-input" />
          </Field>

          {/* Conditionnement & prix — synchronisation tripartite */}
          <div className="rounded-lg border border-neutral-200 dark:border-slate-600 p-3 space-y-3">
            <p className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wide">
              Conditionnement &amp; prix
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Qté / conditionnement" error={errors.packSize?.message}>
                <input
                  {...register('packSize', {
                    setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    onChange: (e) => syncFromQte(parseFloat(e.target.value) || 0),
                  })}
                  type="number" step="0.01" min="0" placeholder="700" className="form-input"
                />
              </Field>
              <Field label="Nb conditionnements / lot" error={errors.unitsPerLot?.message}>
                <input
                  {...register('unitsPerLot', {
                    onChange: (e) => syncFromNbLot(parseInt(e.target.value) || 1),
                  })}
                  type="number" step="1" min="1" placeholder="1" className="form-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Prix / unité base (€)" required error={errors.priceUnit?.message}>
                <input
                  {...register('priceUnit', {
                    onChange: (e) => syncFromBase(parseFloat(e.target.value) || 0),
                  })}
                  type="number" step="0.0001" min="0" placeholder="0.0214" className="form-input"
                />
              </Field>
              <Field label="Prix / conditionnement (€)" error={errors.pricePack?.message}>
                <input
                  {...register('pricePack', {
                    setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    onChange: (e) => syncFromCond(parseFloat(e.target.value) || 0),
                  })}
                  type="number" step="0.01" min="0" placeholder="15.00" className="form-input"
                />
              </Field>
              <Field label="Prix / lot (€)" error={undefined}>
                <input
                  value={priceLot}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setPriceLot(e.target.value === '' ? '' : v);
                    syncFromLot(v);
                  }}
                  type="number" step="0.01" min="0" placeholder="15.00" className="form-input"
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur" error={undefined}>
              <select {...register('supplierId')} className="form-input">
                <option value="">Aucun</option>
                {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Stock de rangement par défaut" error={undefined}>
              <select {...register('defaultStockId')} className="form-input">
                <option value="">Aucun</option>
                {stocks?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Seuil d'alerte" error={errors.alertThreshold?.message}>
              <input
                {...register('alertThreshold', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                type="number" step="0.01" min="0" placeholder="5" className="form-input"
              />
            </Field>
            <Field label="DLC référence (jours)" error={errors.dlcDaysReference?.message}>
              <input
                {...register('dlcDaysReference', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                type="number" step="1" min="0" placeholder="180" className="form-input"
              />
            </Field>
          </div>

          <Field label="Label qualité" error={undefined}>
            <input {...register('qualityLabel')} placeholder="Bio, AOP, Label Rouge..." className="form-input" />
          </Field>

          {isEdit && existing && (
            <p className="text-xs text-neutral-500 dark:text-slate-400 italic">
              Stock actuel : {Number(existing.stock).toFixed(2)} {existing.unit?.toLowerCase()} — calculé depuis les
              lots d&apos;achat, se gère via le module Achats.
            </p>
          )}

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
