'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Search, AlertTriangle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { usePermissions } from '@/hooks/use-permissions';
import { IngredientSheet } from '@/components/ingredients/IngredientSheet';
import { Crumb, Btn, Input, Select, DataTable, type DataTableColumn } from '@/components/ui';

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  priceUnit: string;
  stock: string;
  alertThreshold: string;
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
      const res = await apiClient.get<Ingredient[]>(`/api/v1/ingredients?${sp}`);
      return { data: res.data, total: res.meta?.total ?? 0, totalPages: res.meta?.totalPages ?? 1 };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/ingredients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success('Ingrédient supprimé');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONSTRAINT') {
        toast.error('Cet ingrédient est utilisé dans des recettes');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    },
  });

  const isLowStock = (ing: Ingredient) => Number(ing.stock) <= Number(ing.alertThreshold);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer "${name}" ?`)) {
      deleteMutation.mutate(id);
    }
    setOpenMenuId(null);
  };

  const ingredients = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns: DataTableColumn<Ingredient>[] = [
    {
      key: 'name',
      label: 'Nom',
      render: (ing) => (
        <div className="flex items-center gap-2">
          {isLowStock(ing) && <AlertTriangle size={14} className="text-or-400 flex-shrink-0" />}
          <span className="font-medium text-choco-600">{ing.name}</span>
        </div>
      ),
    },
    { key: 'category', label: 'Catégorie', render: (ing) => CATEGORY_LABELS[ing.category] ?? ing.category },
    {
      key: 'stock',
      label: 'Stock',
      align: 'right',
      render: (ing) => (
        <span className={isLowStock(ing) ? 'text-[var(--color-warning)] font-semibold' : 'text-choco-500'}>
          {Number(ing.stock)}
        </span>
      ),
    },
    { key: 'unit', label: 'Unité', align: 'right', render: (ing) => ing.unit },
    { key: 'price', label: 'Prix/unité', align: 'right', render: (ing) => formatPrice(Number(ing.priceUnit)) },
    {
      key: 'actions',
      label: '',
      width: 40,
      render: (ing) => (
        <div className="relative">
          <button
            onClick={() => setOpenMenuId(openMenuId === ing.id ? null : ing.id)}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400"
          >
            <MoreHorizontal size={16} />
          </button>
          {openMenuId === ing.id && (
            <div className="absolute right-0 top-7 z-10 bg-neutral-0 border border-[var(--line-2)] rounded-[var(--rx-card)] shadow-[var(--shadow-pop)] py-1 min-w-[140px]">
              {can('ingredients.write') && (
                <button
                  onClick={() => { setEditingId(ing.id); setSheetOpen(true); setOpenMenuId(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-erp-sm text-choco-500 hover:bg-[var(--surface-hover)]"
                >
                  <Edit size={14} /> Modifier
                </button>
              )}
              {can('ingredients.delete') && (
                <button
                  onClick={() => handleDelete(ing.id, ing.name)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-erp-sm text-framboise-400 hover:bg-[#FFE4E4]"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Crumb items={['Dashboard', 'Ingrédients']} className="mb-1" />
          <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Ingrédients</h1>
          <p className="text-erp-sm text-neutral-500 mt-0.5">{total} ingrédient{total !== 1 ? 's' : ''}</p>
        </div>
        {can('ingredients.write') && (
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => { setEditingId(null); setSheetOpen(true); }}>
            Ajouter
          </Btn>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <Input
          icon={<Search size={14} />}
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          containerClassName="flex-1 min-w-[200px] max-w-sm"
        />
        <div className="w-[220px] flex-shrink-0">
          <Select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'Toutes catégories' },
              ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 bg-neutral-100 rounded animate-skeleton" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={ingredients}
            emptyState={
              <div className="text-center py-12">
                <p className="text-erp-lg text-neutral-500 mb-1">Aucun ingrédient</p>
                <p className="text-erp-sm text-neutral-400">Commencez par ajouter vos premiers ingrédients.</p>
              </div>
            }
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--line-1)]">
            <p className="text-erp-xs text-neutral-500">{total} résultats</p>
            <div className="flex gap-2">
              <Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédent
              </Btn>
              <span className="px-3 py-1 text-erp-xs text-neutral-500">
                {page} / {totalPages}
              </span>
              <Btn size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Suivant
              </Btn>
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
