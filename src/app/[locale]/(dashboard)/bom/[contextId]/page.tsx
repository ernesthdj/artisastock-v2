'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Factory, ChevronRight, Trash2, Play, Lock, Package, PackagePlus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { BomLevelSheet } from '@/components/bom/BomLevelSheet';
import { BomSheetEditor } from '@/components/bom/BomSheetEditor';
import { BomProductionModal } from '@/components/bom/BomProductionModal';
import { IngredientSheet } from '@/components/ingredients/IngredientSheet';
import { AchatSheet } from '@/components/achats/AchatSheet';

interface BomLevel {
  id: string;
  order: number;
  name: string;
  description: string | null;
  _count: { sheets: number };
}

interface BomSheet {
  id: string;
  name: string;
  description: string | null;
  outputQty: number;
  outputUnit: string;
  isActive: boolean;
  _count: { lines: number };
}

interface BomContext {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  levels: BomLevel[];
}

export default function BomContextPage() {
  const { locale, contextId } = useParams<{ locale: string; contextId: string }>();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [levelSheetOpen, setLevelSheetOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<BomLevel | null>(null);
  const [sheetEditorOpen, setSheetEditorOpen] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [productionSheet, setProductionSheet] = useState<{ id: string; name: string } | null>(null);
  const [ingredientSheetOpen, setIngredientSheetOpen] = useState(false);
  const [achatSheetOpen, setAchatSheetOpen] = useState(false);

  const { data: context, isLoading } = useQuery<BomContext>({
    queryKey: ['bom-context', contextId],
    queryFn: async () => {
      const res = await apiClient.get<BomContext>(`/api/v1/bom/contexts/${contextId}`)
      return res.data
    },
  });

  const { data: sheets } = useQuery<BomSheet[]>({
    queryKey: ['bom-sheets', selectedLevelId],
    queryFn: async () => {
      const res = await apiClient.get<BomSheet[]>(`/api/v1/bom/sheets?levelId=${selectedLevelId}&pageSize=100`)
      return res.data
    },
    enabled: !!selectedLevelId,
  });

  const deleteLevelMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/bom/levels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-context', contextId] });
      toast.success('Niveau supprimé');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const deleteSheetMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/bom/sheets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sheets', selectedLevelId] });
      toast.success('Fiche supprimée');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const selectedLevel = context?.levels.find((l) => l.id === selectedLevelId);
  // Règle réelle v1 : seul le niveau d'ordre maximum du contexte est supprimable.
  const maxOrder = context ? Math.max(...context.levels.map((l) => l.order)) : null;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 bg-amber-100 dark:bg-amber-900/20 rounded animate-pulse mb-4" />
        <div className="flex gap-4">
          <div className="w-72 h-96 bg-amber-50 dark:bg-amber-900/10 rounded-xl animate-pulse" />
          <div className="flex-1 h-96 bg-amber-50 dark:bg-amber-900/10 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="p-6 text-amber-600 dark:text-amber-400">Contexte introuvable.</div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-amber-500 dark:text-amber-500">
          <Link href={`/${locale}/bom`} className="hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1">
            <Factory size={14} /> Nomenclature BOM
          </Link>
          <ChevronRight size={14} />
          <span className="text-amber-900 dark:text-amber-100 font-medium">{context.name}</span>
        </div>
        {can('bom.produce') && (
          <Link
            href={`/${locale}/bom/${contextId}/production`}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Play size={12} /> Production
          </Link>
        )}
      </div>

      <div className="flex gap-5 items-start">
        {/* Colonne niveaux */}
        <aside className="w-72 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Niveaux</h2>
            {can('bom.write') && (
              <button
                onClick={() => { setEditingLevel(null); setLevelSheetOpen(true); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors"
              >
                <Plus size={12} /> Niveau
              </button>
            )}
          </div>

          <div className="space-y-1">
            {context.levels.map((level) => (
              <div
                key={level.id}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                  selectedLevelId === level.id
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30'
                    : 'border-transparent hover:border-amber-200 dark:hover:border-amber-800 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                }`}
                onClick={() => setSelectedLevelId(level.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold shrink-0 text-amber-600 dark:text-amber-400">
                    N{level.order}
                  </span>
                  <span className="text-sm text-amber-900 dark:text-amber-100 truncate">
                    {level.name}
                  </span>
                  {level.order === 1 && (
                    <Lock size={10} className="text-amber-400 shrink-0" />
                  )}
                </div>
                {level.order === maxOrder && level.order !== 1 && can('bom.write') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLevelMutation.mutate(level.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Colonne fiches */}
        <div className="flex-1 min-w-0">
          {!selectedLevelId ? (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm text-amber-500 dark:text-amber-500">
                Sélectionnez un niveau pour voir ses fiches BOM.
              </p>
            </div>
          ) : selectedLevel?.order === 1 ? (
            <div className="border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={14} className="text-amber-400" />
                <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  N1 — {selectedLevel.name}
                </h2>
              </div>
              <p className="text-xs text-amber-500 dark:text-amber-500 mb-5">
                Niveau obligatoire dédié aux ingrédients bruts — aucune fiche BOM ni production ici.
                Gérez le référentiel et les achats depuis les actions ci-dessous.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setIngredientSheetOpen(true)}
                  disabled={!can('ingredients.write')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/10 hover:border-amber-400 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <Package size={18} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Nouvelle fiche ingrédient</p>
                    <p className="text-xs text-amber-500">Créer un ingrédient au référentiel</p>
                  </div>
                </button>

                <button
                  onClick={() => setAchatSheetOpen(true)}
                  disabled={!can('achats.write')}
                  className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/10 hover:border-amber-400 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <PackagePlus size={18} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Nouvel achat</p>
                    <p className="text-xs text-amber-500">Réceptionner un lot d&apos;ingrédient</p>
                  </div>
                </button>
              </div>

              <div className="flex gap-4 mt-5 text-xs">
                <Link href={`/${locale}/ingredients`} className="flex items-center gap-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300">
                  Voir les fiches ingrédients <ArrowRight size={11} />
                </Link>
                <Link href={`/${locale}/achats`} className="flex items-center gap-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300">
                  Voir tous les achats <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Fiches — {selectedLevel?.name}
                  </h2>
                  <p className="text-xs text-amber-500 dark:text-amber-500">
                    N{selectedLevel?.order}
                  </p>
                </div>
                {can('bom.write') && (
                  <button
                    onClick={() => { setSelectedSheetId(null); setSheetEditorOpen(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                  >
                    <Plus size={12} /> Nouvelle fiche
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {sheets?.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="group flex items-center justify-between px-4 py-3 rounded-lg border border-amber-100 dark:border-amber-900/40 bg-white dark:bg-amber-950/10 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => { setSelectedSheetId(sheet.id); setSheetEditorOpen(true); }}
                    >
                      <p className="font-medium text-sm text-amber-900 dark:text-amber-100 truncate">
                        {sheet.name}
                      </p>
                      <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">
                        {Number(sheet.outputQty)} {sheet.outputUnit.toLowerCase()} · {sheet._count.lines} ligne(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {can('bom.produce') && (
                        <button
                          onClick={() => { setProductionSheet({ id: sheet.id, name: sheet.name }); setProductionModalOpen(true); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Play size={11} /> Produire
                        </button>
                      )}
                      {can('bom.write') && (
                        <button
                          onClick={() => deleteSheetMutation.mutate(sheet.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {sheets?.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
                    <p className="text-sm text-amber-500 dark:text-amber-500 mb-2">
                      Aucune fiche dans ce niveau.
                    </p>
                    {can('bom.write') && (
                      <button
                        onClick={() => { setSelectedSheetId(null); setSheetEditorOpen(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                      >
                        <Plus size={12} /> Créer une fiche
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Panels & Modals */}
      <BomLevelSheet
        open={levelSheetOpen}
        onClose={() => { setLevelSheetOpen(false); setEditingLevel(null); }}
        contextId={contextId}
        editingId={editingLevel?.id}
        initialData={editingLevel ? { name: editingLevel.name, description: editingLevel.description } : undefined}
      />

      {selectedLevelId && (
        <BomSheetEditor
          open={sheetEditorOpen}
          onClose={() => { setSheetEditorOpen(false); setSelectedSheetId(null); }}
          sheetId={selectedSheetId}
          levelId={selectedLevelId}
          levelOrder={selectedLevel?.order ?? 0}
          contextId={contextId}
        />
      )}

      {productionSheet && (
        <BomProductionModal
          open={productionModalOpen}
          onClose={() => { setProductionModalOpen(false); setProductionSheet(null); }}
          sheetId={productionSheet.id}
          sheetName={productionSheet.name}
        />
      )}

      <IngredientSheet
        open={ingredientSheetOpen}
        onClose={() => setIngredientSheetOpen(false)}
        ingredientId={null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['ingredients'] });
          setIngredientSheetOpen(false);
        }}
      />

      <AchatSheet
        open={achatSheetOpen}
        onClose={() => setAchatSheetOpen(false)}
      />
    </div>
  );
}
