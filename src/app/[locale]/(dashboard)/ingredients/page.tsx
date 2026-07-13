'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Search, AlertTriangle, MoreHorizontal, Edit, Trash2, RefreshCw } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { usePermissions } from '@/hooks/use-permissions';
import { IngredientSheet } from '@/components/ingredients/IngredientSheet';

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  pricePerUnit: number;
  stockQuantity: number | null;
  alertThreshold: number | null;
  supplier?: { name: string } | null;
  isActive: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  DRY: 'Sec', FRESH: 'Frais', FROZEN: 'Congelé', LIQUID: 'Liquide',
  SPICE: 'Épice', DAIRY: 'Laitier', FLOUR: 'Farine', SUGAR: 'Sucre', OTHER: 'Autre',
};

export default function IngredientsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ingredients', search, categoryFilter, page],
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) sp.set('search', search);
      if (categoryFilter) sp.set('category', categoryFilter);
      const res = await apiClient.get<{ data: Ingredient[]; total: number; totalPages: number }>(
        `/api/v1/ingredients?${sp}`
      );
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/ingredients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success('Ingrédient supprimé');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'INGREDIENT_IN_USE') {
        toast.error('Cet ingrédient est utilisé dans des recettes');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    },
  });

  const isLowStock = (ing: Ingredient) =>
    ing.stockQuantity !== null && ing.alertThreshold !== null && ing.stockQuantity <= ing.alertThreshold;

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer "${name}" ?`)) {
      deleteMutation.mutate(id);
    }
    setOpenMenuId(null);
  };

  const ingredients = (data as Record<string, unknown>)?.['data'] as Ingredient[] ?? [];
  const total = (data as Record<string, unknown>)?.['total'] as number ?? 0;
  const totalPages = (data as Record<string, unknown>)?.['totalPages'] as number ?? 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-neutral-400 mb-1">Dashboard &rsaquo; Ingrédients</nav>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Ingrédients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{total} ingrédient{total !== 1 ? 's' : ''}</p>
        </div>
        {can('ingredients:write') && (
          <button
            onClick={() => { setEditingId(null); setSheetOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Ajouter
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 text-sm border border-neutral-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 text-sm border border-neutral-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-slate-700 bg-neutral-50 dark:bg-slate-700/50">
                <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Nom</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300 hidden md:table-cell">Catégorie</th>
                <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300">Stock</th>
                <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300 hidden lg:table-cell">Unité</th>
                <th className="text-right px-4 py-3 font-semibold text-neutral-600 dark:text-slate-300 hidden lg:table-cell">Prix/unité</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-slate-700">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded animate-skeleton" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : ingredients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-neutral-500">
                    <p className="text-lg mb-1">Aucun ingrédient</p>
                    <p className="text-sm">Commencez par ajouter vos premiers ingrédients.</p>
                  </td>
                </tr>
              ) : (
                ingredients.map((ing) => (
                  <tr
                    key={ing.id}
                    className={`data-table-row ${isLowStock(ing) ? 'data-table-row-warning' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLowStock(ing) && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />}
                        <span className="font-medium text-neutral-900 dark:text-white">{ing.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 hidden md:table-cell">
                      {CATEGORY_LABELS[ing.category] ?? ing.category}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={isLowStock(ing) ? 'stock-alert font-semibold' : 'text-neutral-700 dark:text-slate-200'}>
                        {ing.stockQuantity ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500 hidden lg:table-cell">{ing.unit}</td>
                    <td className="px-4 py-3 text-right text-neutral-700 dark:text-slate-200 hidden lg:table-cell">
                      {formatPrice(ing.pricePerUnit)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === ing.id ? null : ing.id)}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-400"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenuId === ing.id && (
                          <div className="absolute right-0 top-7 z-10 bg-white dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 rounded-lg shadow-lg py-1 min-w-[140px]">
                            {can('ingredients:write') && (
                              <button
                                onClick={() => { setEditingId(ing.id); setSheetOpen(true); setOpenMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-slate-200 hover:bg-neutral-50 dark:hover:bg-slate-600"
                              >
                                <Edit size={14} /> Modifier
                              </button>
                            )}
                            {can('ingredients:delete') && (
                              <button
                                onClick={() => handleDelete(ing.id, ing.name)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <Trash2 size={14} /> Supprimer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 dark:border-slate-700">
            <p className="text-xs text-neutral-500">{total} résultats</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 text-xs border border-neutral-200 dark:border-slate-600 rounded hover:bg-neutral-50 disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="px-3 py-1 text-xs text-neutral-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-xs border border-neutral-200 dark:border-slate-600 rounded hover:bg-neutral-50 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sheet création/édition */}
      <IngredientSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingId(null); }}
        ingredientId={editingId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['ingredients'] });
          setSheetOpen(false);
          setEditingId(null);
        }}
      />
    </div>
  );
}
