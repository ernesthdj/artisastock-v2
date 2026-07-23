'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Pencil, Boxes } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { ActiviteSheet } from '@/components/activites/ActiviteSheet';

interface Activite {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { stocks: number };
}

interface Stock {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ActiviteDetail extends Activite {
  stocks: { stockId: string; stock: Stock }[];
}

export default function StocksLiaisonsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingActivite, setEditingActivite] = useState<Activite | null>(null);
  const [newStockName, setNewStockName] = useState('');

  const { data: activitesRes, isLoading: activitesLoading } = useQuery({
    queryKey: ['activites'],
    queryFn: async () => {
      const res = await apiClient.get<Activite[]>('/api/v1/activites?pageSize=100');
      return res.data;
    },
  });
  const activites = activitesRes ?? [];

  const { data: detail } = useQuery<ActiviteDetail>({
    queryKey: ['activite', selectedId],
    queryFn: async () => {
      const res = await apiClient.get<ActiviteDetail>(`/api/v1/activites/${selectedId}`);
      return res.data;
    },
    enabled: !!selectedId,
  });

  const { data: allStocksRes } = useQuery({
    queryKey: ['stocks'],
    queryFn: async () => {
      const res = await apiClient.get<Stock[]>('/api/v1/stocks?pageSize=100');
      return res.data;
    },
  });
  const allStocks = allStocksRes ?? [];

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/v1/activites/${id}/deactivate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] });
      queryClient.invalidateQueries({ queryKey: ['activites-switcher'] });
      queryClient.invalidateQueries({ queryKey: ['activite', selectedId] });
      toast.success('Activité désactivée');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/v1/activites/${id}/reactivate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] });
      queryClient.invalidateQueries({ queryKey: ['activites-switcher'] });
      queryClient.invalidateQueries({ queryKey: ['activite', selectedId] });
      toast.success('Activité réactivée');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  // Mise à jour optimiste : la case se coche/décoche immédiatement (perçu comme instantané),
  // la synchro serveur + invalidation des autres vues (switcher, liste activités) se fait
  // en arrière-plan. Rollback sur erreur via le snapshot pris dans onMutate.
  const toggleStockLink = (stockId: string, wasLinked: boolean) => {
    const previousDetail = queryClient.getQueryData<ActiviteDetail>(['activite', selectedId]);
    const previousActivites = queryClient.getQueryData<Activite[]>(['activites']);
    const stock = allStocks.find((s) => s.id === stockId);

    queryClient.setQueryData<ActiviteDetail | undefined>(['activite', selectedId], (old) => {
      if (!old) return old;
      return {
        ...old,
        stocks: wasLinked
          ? old.stocks.filter((s) => s.stockId !== stockId)
          : [...old.stocks, { stockId, stock: stock ?? { id: stockId, name: '', description: null, isActive: true } }],
      };
    });
    queryClient.setQueryData<Activite[] | undefined>(['activites'], (old) =>
      old?.map((a) =>
        a.id === selectedId
          ? { ...a, _count: { stocks: (a._count?.stocks ?? 0) + (wasLinked ? -1 : 1) } }
          : a
      )
    );

    return { previousDetail, previousActivites };
  };

  const rollback = (ctx?: { previousDetail?: ActiviteDetail; previousActivites?: Activite[] }) => {
    if (ctx?.previousDetail) queryClient.setQueryData(['activite', selectedId], ctx.previousDetail);
    if (ctx?.previousActivites) queryClient.setQueryData(['activites'], ctx.previousActivites);
  };

  const settleLinkQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['activite', selectedId] });
    queryClient.invalidateQueries({ queryKey: ['activites'] });
    queryClient.invalidateQueries({ queryKey: ['activites-switcher'] });
    queryClient.invalidateQueries({ queryKey: ['stocks'] });
  };

  const linkMutation = useMutation({
    mutationFn: (stockId: string) =>
      apiClient.post(`/api/v1/activites/${selectedId}/stocks`, { stockId }),
    onMutate: (stockId: string) => toggleStockLink(stockId, false),
    onError: (err: unknown, _stockId, ctx) => {
      rollback(ctx);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    },
    onSettled: settleLinkQueries,
  });

  const unlinkMutation = useMutation({
    mutationFn: (stockId: string) =>
      apiClient.delete(`/api/v1/activites/${selectedId}/stocks/${stockId}`),
    onMutate: (stockId: string) => toggleStockLink(stockId, true),
    onError: (err: unknown, _stockId, ctx) => {
      rollback(ctx);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    },
    onSettled: settleLinkQueries,
  });

  const createStockMutation = useMutation({
    mutationFn: (name: string) => apiClient.post('/api/v1/stocks', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      setNewStockName('');
      toast.success('Stock créé');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const linkedStockIds = new Set((detail?.stocks ?? []).map((s) => s.stockId));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Activités &amp; Stocks</h1>
          <p className="text-sm text-amber-500 dark:text-amber-500">
            Gérez vos activités et leurs liaisons avec les emplacements de stock.
          </p>
        </div>
        {can('activites.write') && (
          <button
            onClick={() => { setEditingActivite(null); setSheetOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} /> Nouvelle activité
          </button>
        )}
      </div>

      <div className="flex gap-5 items-start">
        {/* Colonne activités */}
        <aside className="w-72 shrink-0">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">Activités</h2>

          {activitesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-amber-50 dark:bg-amber-900/10 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : activites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm text-amber-500 dark:text-amber-500">Aucune activité créée.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activites.map((activite) => (
                <div
                  key={activite.id}
                  onClick={() => setSelectedId(activite.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                    selectedId === activite.id
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30'
                      : 'border-transparent hover:border-amber-200 dark:hover:border-amber-800 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                  } ${!activite.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-amber-900 dark:text-amber-100 truncate">{activite.name}</span>
                    <span className="text-xs text-amber-500 dark:text-amber-500">
                      {activite.isActive ? 'Active' : 'Désactivée'} · {activite._count?.stocks ?? 0} stock(s) lié(s)
                    </span>
                  </div>
                  {can('activites.write') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingActivite(activite); setSheetOpen(true); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-amber-500 hover:text-amber-700 rounded transition-all shrink-0"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Colonne détail */}
        <div className="flex-1 min-w-0">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm text-amber-500 dark:text-amber-500">
                Sélectionnez une activité pour gérer ses stocks liés.
              </p>
            </div>
          ) : !detail ? (
            <div className="h-64 bg-amber-50 dark:bg-amber-900/10 rounded-xl animate-pulse" />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">{detail.name}</h2>
                  {detail.description && (
                    <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">{detail.description}</p>
                  )}
                </div>
                {can('activites.write') && (
                  detail.isActive ? (
                    <button
                      onClick={() => deactivateMutation.mutate(detail.id)}
                      disabled={deactivateMutation.isPending}
                      className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-lg transition-colors"
                    >
                      {deactivateMutation.isPending ? 'Désactivation...' : 'Désactiver'}
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivateMutation.mutate(detail.id)}
                      disabled={reactivateMutation.isPending}
                      className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                    >
                      {reactivateMutation.isPending ? 'Réactivation...' : 'Réactiver'}
                    </button>
                  )
                )}
              </div>

              <div className="border border-amber-100 dark:border-amber-900/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Boxes size={14} /> Stocks liés
                </h3>

                {allStocks.length === 0 ? (
                  <p className="text-sm text-amber-500 dark:text-amber-500 mb-3">Aucun stock créé pour l&apos;instant.</p>
                ) : (
                  <div className="space-y-1.5 mb-4">
                    {allStocks.map((stock) => {
                      const linked = linkedStockIds.has(stock.id);
                      return (
                        <label
                          key={stock.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/40 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={linked}
                            disabled={!can('stocks.write')}
                            onChange={() => {
                              if (linked) unlinkMutation.mutate(stock.id);
                              else linkMutation.mutate(stock.id);
                            }}
                            className="accent-amber-600"
                          />
                          <span className="text-sm text-amber-900 dark:text-amber-100">{stock.name}</span>
                          {!stock.isActive && (
                            <span className="text-xs text-amber-400">(inactif)</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                {can('stocks.write') && (
                  <div className="flex gap-2">
                    <input
                      value={newStockName}
                      onChange={(e) => setNewStockName(e.target.value)}
                      placeholder="Nouveau stock (ex : Réserve, Chambre froide...)"
                      className="flex-1 px-3 py-1.5 text-sm rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={() => { if (newStockName.trim()) createStockMutation.mutate(newStockName.trim()); }}
                      disabled={createStockMutation.isPending || !newStockName.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Plus size={12} /> Créer
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ActiviteSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingActivite(null); }}
        editingId={editingActivite?.id}
        initialData={editingActivite ? { name: editingActivite.name, description: editingActivite.description } : undefined}
      />
    </div>
  );
}
