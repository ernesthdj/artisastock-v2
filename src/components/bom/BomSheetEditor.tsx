'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { compatibleUnits } from '@/lib/bom/units';
import type { UnitOfMeasure } from '@prisma/client';

const UNIT_OPTIONS = [
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'MG', label: 'mg' },
  { value: 'CG', label: 'cg' },
  { value: 'L', label: 'L' },
  { value: 'DL', label: 'dL' },
  { value: 'CL', label: 'cL' },
  { value: 'ML', label: 'mL' },
  { value: 'PIECE', label: 'pièce(s)' },
  { value: 'DOZEN', label: 'douzaine(s)' },
];

const headerSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  description: z.string().max(500).optional(),
  outputUnit: z.string().min(1),
  outputQty: z.number().positive('Doit être > 0'),
  prepTime: z.number().int().positive().optional().nullable(),
  targetStock: z.number().positive().optional().nullable(),
});

type HeaderForm = z.infer<typeof headerSchema>;

interface BomSheetFull {
  id: string;
  name: string;
  description?: string | null;
  outputUnit: string;
  outputQty: number;
  prepTime?: number | null;
  targetStock?: number | null;
  levelId: string;
  level: { order: number; context: { id: string } };
  lines: BomLine[];
}

interface BomLine {
  id: string;
  inputType: 'INGREDIENT' | 'SHEET';
  quantity: number;
  unit: string;
  ingredient?: { id: string; name: string; unit: string } | null;
  subSheet?: { id: string; name: string } | null;
}

// Ligne saisie mais pas encore persistée (mode création — mirroring _lignes en mémoire de
// FrmBomFicheEdit). Un id local suffit pour l'affichage/suppression avant sauvegarde.
interface PendingLine {
  localId: string;
  inputType: 'INGREDIENT' | 'SHEET';
  ingredientId?: string;
  subSheetId?: string;
  quantity: number;
  unit: string;
  label: string;
}

interface BomCostResult {
  totalCost: number;
  unitCost: number;
  lines: { lineId: string; label: string; quantity: number; unit: string; totalCost: number }[];
}

interface Props {
  sheetId: string | null;
  levelId: string;
  levelOrder: number;
  contextId: string;
  open: boolean;
  onClose: () => void;
}

export function BomSheetEditor({ sheetId, levelId, levelOrder, contextId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const isCreate = !sheetId;
  const [activeTab, setActiveTab] = useState<'lignes' | 'cout'>('lignes');
  const [newLineType, setNewLineType] = useState<'INGREDIENT' | 'SHEET'>('INGREDIENT');
  const [newLineIngredientId, setNewLineIngredientId] = useState('');
  const [newLineSubSheetId, setNewLineSubSheetId] = useState('');
  const [newLineQty, setNewLineQty] = useState('');
  const [newLineUnit, setNewLineUnit] = useState('G');
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);

  type IngredientOption = { id: string; name: string; unit: string }

  const { data: sheet } = useQuery<BomSheetFull>({
    queryKey: ['bom-sheet', sheetId],
    queryFn: async () => {
      const res = await apiClient.get<BomSheetFull>(`/api/v1/bom/sheets/${sheetId}`)
      return res.data
    },
    enabled: !!sheetId && open,
  });

  const { data: ingredients } = useQuery<IngredientOption[]>({
    queryKey: ['ingredients-list'],
    queryFn: async () => {
      const res = await apiClient.get<IngredientOption[]>('/api/v1/ingredients?pageSize=200')
      return res.data
    },
    enabled: open,
  });

  // Sous-fiches valides comme input : mêmes règles de hiérarchie que le serveur
  // (niveau >= 2 et < niveau courant — N1 n'a jamais de fiche consommable comme sous-produit).
  const { data: context } = useQuery<{ levels: { id: string; order: number; name: string }[] }>({
    queryKey: ['bom-context', contextId],
    queryFn: async () => {
      const res = await apiClient.get<{ levels: { id: string; order: number; name: string }[] }>(
        `/api/v1/bom/contexts/${contextId}`
      )
      return res.data
    },
    enabled: open,
  });

  const candidateLevelIds = (context?.levels ?? [])
    .filter((l) => l.order >= 2 && l.order < levelOrder)
    .map((l) => ({ id: l.id, order: l.order }));

  const { data: subSheetOptions } = useQuery<{ id: string; name: string; order: number; outputUnit: UnitOfMeasure }[]>({
    queryKey: ['bom-subsheet-options', contextId, levelOrder, candidateLevelIds.map((l) => l.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        candidateLevelIds.map(async ({ id: lvlId, order }) => {
          const res = await apiClient.get<{ id: string; name: string; outputUnit: UnitOfMeasure }[]>(
            `/api/v1/bom/sheets?levelId=${lvlId}&pageSize=100`
          )
          return res.data.map((s) => ({ ...s, order }))
        })
      )
      return results.flat()
    },
    enabled: open && candidateLevelIds.length > 0,
  });

  // Unité reprise automatiquement de l'ingrédient/sous-fiche sélectionné : la liste proposée
  // se restreint au même groupe (masse/volume/pièce) pour éviter les erreurs de saisie.
  const selectedIngredientUnit = ingredients?.find((i) => i.id === newLineIngredientId)?.unit as
    | UnitOfMeasure
    | undefined;
  const selectedSubSheetUnit = subSheetOptions?.find((s) => s.id === newLineSubSheetId)?.outputUnit;
  const referenceUnit = newLineType === 'INGREDIENT' ? selectedIngredientUnit : selectedSubSheetUnit;
  const unitChoices = referenceUnit
    ? UNIT_OPTIONS.filter((u) => compatibleUnits(referenceUnit).includes(u.value as UnitOfMeasure))
    : UNIT_OPTIONS;

  const { data: costData, refetch: refetchCost } = useQuery<BomCostResult>({
    queryKey: ['bom-cost', sheetId],
    queryFn: async () => {
      const res = await apiClient.get<BomCostResult>(`/api/v1/bom/sheets/${sheetId}/cost`)
      return res.data
    },
    enabled: !!sheetId && activeTab === 'cout',
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<HeaderForm>({
    resolver: zodResolver(headerSchema),
  });

  useEffect(() => {
    if (open) {
      if (sheet) {
        reset({
          name: sheet.name,
          description: sheet.description ?? '',
          outputUnit: sheet.outputUnit,
          outputQty: Number(sheet.outputQty),
          prepTime: sheet.prepTime ?? null,
          targetStock: sheet.targetStock ? Number(sheet.targetStock) : null,
        });
      } else if (isCreate) {
        reset({ name: '', description: '', outputUnit: 'G', outputQty: undefined, prepTime: null, targetStock: null });
        setPendingLines([]);
      }
    }
  }, [open, sheet, isCreate, reset]);

  const createMutation = useMutation({
    mutationFn: (data: HeaderForm) =>
      apiClient.post('/api/v1/bom/sheets', {
        ...data,
        levelId,
        lines: pendingLines.map((l) => ({
          inputType: l.inputType,
          ingredientId: l.ingredientId,
          subSheetId: l.subSheetId,
          quantity: l.quantity,
          unit: l.unit,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sheets', levelId] });
      toast.success('Fiche créée');
      onClose();
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const updateHeaderMutation = useMutation({
    mutationFn: (data: HeaderForm) => apiClient.patch(`/api/v1/bom/sheets/${sheetId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sheets', levelId] });
      queryClient.invalidateQueries({ queryKey: ['bom-sheet', sheetId] });
      toast.success('Fiche mise à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const addLineMutation = useMutation({
    mutationFn: (data: object) =>
      apiClient.post(`/api/v1/bom/sheets/${sheetId}/lines`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sheet', sheetId] });
      queryClient.invalidateQueries({ queryKey: ['bom-sheets', levelId] });
      resetLineInputs();
      toast.success('Ligne ajoutée');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) =>
      apiClient.delete(`/api/v1/bom/sheets/${sheetId}/lines/${lineId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sheet', sheetId] });
      queryClient.invalidateQueries({ queryKey: ['bom-sheets', levelId] });
      toast.success('Ligne supprimée');
    },
  });

  function resetLineInputs() {
    setNewLineQty('');
    setNewLineIngredientId('');
    setNewLineSubSheetId('');
    setNewLineUnit('G');
  }

  const handleAddLine = () => {
    const qty = parseFloat(newLineQty);
    if (!qty || qty <= 0) { toast.error('Quantité invalide'); return; }
    if (newLineType === 'INGREDIENT' && !newLineIngredientId) { toast.error('Sélectionnez un ingrédient'); return; }
    if (newLineType === 'SHEET' && !newLineSubSheetId) { toast.error('Sélectionnez une sous-fiche'); return; }

    if (isCreate) {
      // Pas encore de fiche en base — la ligne reste en mémoire jusqu'à l'enregistrement.
      const label =
        newLineType === 'INGREDIENT'
          ? ingredients?.find((i) => i.id === newLineIngredientId)?.name ?? '—'
          : subSheetOptions?.find((s) => s.id === newLineSubSheetId)?.name ?? '—';

      const duplicate = pendingLines.some((l) =>
        newLineType === 'INGREDIENT' ? l.ingredientId === newLineIngredientId : l.subSheetId === newLineSubSheetId
      );
      if (duplicate) { toast.error('Cet ingrédient/fiche est déjà présent dans la fiche'); return; }

      setPendingLines((prev) => [
        ...prev,
        {
          localId: `tmp-${Date.now()}`,
          inputType: newLineType,
          ingredientId: newLineType === 'INGREDIENT' ? newLineIngredientId : undefined,
          subSheetId: newLineType === 'SHEET' ? newLineSubSheetId : undefined,
          quantity: qty,
          unit: newLineUnit,
          label,
        },
      ]);
      resetLineInputs();
      return;
    }

    const data =
      newLineType === 'INGREDIENT'
        ? { inputType: 'INGREDIENT', ingredientId: newLineIngredientId, quantity: qty, unit: newLineUnit }
        : { inputType: 'SHEET', subSheetId: newLineSubSheetId, quantity: qty, unit: newLineUnit };

    addLineMutation.mutate(data);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 flex flex-col w-full max-w-[640px] h-full bg-white dark:bg-[#1a0f0a] shadow-2xl border-l border-amber-900/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            {sheetId ? (sheet?.name ?? 'Fiche BOM') : 'Nouvelle fiche BOM'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30">
            <X size={20} className="text-amber-700 dark:text-amber-300" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-900/20">
          {(['lignes', 'cout'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === 'cout') refetchCost(); }}
              disabled={tab === 'cout' && isCreate}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-700 dark:text-amber-300'
                  : 'border-transparent text-amber-500 dark:text-amber-500 hover:text-amber-700'
              }`}
            >
              {tab === 'lignes' ? 'Lignes' : 'Coût estimé'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header form */}
          <form
            onSubmit={handleSubmit((d) => (isCreate ? createMutation.mutate(d) : updateHeaderMutation.mutate(d)))}
            className="space-y-4 mb-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Nom *</label>
                <input
                  {...register('name')}
                  className="px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Qté produite *</label>
                <input
                  {...register('outputQty', { valueAsNumber: true })}
                  type="number"
                  step="any"
                  className="px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Unité sortie *</label>
                <select
                  {...register('outputUnit')}
                  className="px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Temps prépa (min)</label>
                <input
                  {...register('prepTime', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                  type="number"
                  className="px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Stock cible</label>
                <input
                  {...register('targetStock', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                  type="number"
                  step="any"
                  className="px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending || updateHeaderMutation.isPending}
              className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-60"
            >
              {createMutation.isPending || updateHeaderMutation.isPending
                ? 'Enregistrement...'
                : sheetId
                ? "Enregistrer l'en-tête"
                : 'Créer la fiche'}
            </button>
          </form>

          {/* Tab content */}
          {activeTab === 'lignes' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Lignes de nomenclature</h3>
              {isCreate && (
                <p className="text-xs text-amber-500 dark:text-amber-500 italic">
                  Les lignes ajoutées ici seront enregistrées avec la fiche au clic sur « Créer la fiche ».
                </p>
              )}

              {/* Existing / pending lines */}
              <div className="space-y-1">
                {isCreate
                  ? pendingLines.map((line) => (
                      <div
                        key={line.localId}
                        className="flex items-center justify-between px-3 py-2 rounded border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            line.inputType === 'INGREDIENT'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {line.inputType === 'INGREDIENT' ? 'ING' : 'FBM'}
                          </span>
                          <span className="text-amber-900 dark:text-amber-100">{line.label}</span>
                          <span className="text-amber-500 dark:text-amber-400">
                            {line.quantity} {line.unit.toLowerCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => setPendingLines((prev) => prev.filter((l) => l.localId !== line.localId))}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  : sheet?.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between px-3 py-2 rounded border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            line.inputType === 'INGREDIENT'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {line.inputType === 'INGREDIENT' ? 'ING' : 'FBM'}
                          </span>
                          <span className="text-amber-900 dark:text-amber-100">
                            {line.ingredient?.name ?? line.subSheet?.name}
                          </span>
                          <span className="text-amber-500 dark:text-amber-400">
                            {line.quantity} {line.unit.toLowerCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteLineMutation.mutate(line.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                {(isCreate ? pendingLines.length === 0 : sheet?.lines.length === 0) && (
                  <p className="text-xs text-amber-500 dark:text-amber-500 italic">Aucune ligne — ajoutez des ingrédients ou sous-fiches.</p>
                )}
              </div>

              {/* Add line */}
              <div className="mt-4 p-4 rounded border border-dashed border-amber-300 dark:border-amber-700 space-y-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Ajouter une ligne</p>
                <div className="flex gap-2">
                  {(['INGREDIENT', 'SHEET'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setNewLineType(t); resetLineInputs(); }}
                      disabled={t === 'SHEET' && (subSheetOptions?.length ?? 0) === 0}
                      className={`px-3 py-1 text-xs rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        newLineType === t
                          ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          : 'border-amber-200 dark:border-amber-800 text-amber-500'
                      }`}
                    >
                      {t === 'INGREDIENT' ? 'Ingrédient' : 'Sous-fiche BOM'}
                    </button>
                  ))}
                </div>
                {newLineType === 'INGREDIENT' ? (
                  <select
                    value={newLineIngredientId}
                    onChange={(e) => {
                      setNewLineIngredientId(e.target.value);
                      const ing = ingredients?.find((i) => i.id === e.target.value);
                      if (ing) setNewLineUnit(ing.unit);
                    }}
                    className="w-full px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none"
                  >
                    <option value="">-- Sélectionner un ingrédient --</option>
                    {ingredients?.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={newLineSubSheetId}
                    onChange={(e) => {
                      setNewLineSubSheetId(e.target.value);
                      const sub = subSheetOptions?.find((s) => s.id === e.target.value);
                      if (sub) setNewLineUnit(sub.outputUnit);
                    }}
                    className="w-full px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none"
                  >
                    <option value="">-- Sélectionner une sous-fiche --</option>
                    {subSheetOptions?.map((s) => (
                      <option key={s.id} value={s.id}>N{s.order} — {s.name}</option>
                    ))}
                  </select>
                )}
                {referenceUnit && (
                  <p className="text-xs text-amber-500 dark:text-amber-500 italic">
                    Unité reprise de la {newLineType === 'INGREDIENT' ? "fiche ingrédient" : 'sous-fiche'} — choisissez la précision (kg/g/mg...).
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Quantité"
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none"
                  />
                  <select
                    value={newLineUnit}
                    onChange={(e) => setNewLineUnit(e.target.value)}
                    className="px-3 py-2 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none"
                  >
                    {unitChoices.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={addLineMutation.isPending}
                    className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded transition-colors disabled:opacity-60"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cout' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Simulation de coût (1 lot)</h3>
                <button
                  onClick={() => refetchCost()}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"
                >
                  <Calculator size={12} /> Recalculer
                </button>
              </div>

              {costData && (
                <>
                  <div className="space-y-1">
                    {costData.lines.map((l) => (
                      <div key={l.lineId} className="flex items-center justify-between text-sm px-3 py-2 rounded bg-amber-50/50 dark:bg-amber-900/10">
                        <span className="text-amber-900 dark:text-amber-100">{l.label}</span>
                        <span className="text-amber-600 dark:text-amber-400">{formatPrice(l.totalCost)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Coût total</p>
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{formatPrice(costData.totalCost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-amber-600 dark:text-amber-400">Coût unitaire</p>
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{formatPrice(costData.unitCost)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
