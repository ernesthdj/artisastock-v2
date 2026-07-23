'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, PackagePlus, Edit, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { AchatSheet } from '@/components/achats/AchatSheet';
import { formatPrice } from '@/lib/utils/format';
import { formatQty } from '@/lib/bom/units';
import type { UnitOfMeasure } from '@prisma/client';

interface Lot {
  id: string;
  ingredient: { id: string; name: string; unit: UnitOfMeasure };
  stock: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  purchaseDate: string;
  expiryDate: string | null;
  quantityInitial: string;
  quantityAvailable: string;
  unitPrice: string;
  totalPriceHT: string;
}

export default function AchatsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['achats'],
    queryFn: async () => {
      const res = await apiClient.get<Lot[]>('/api/v1/achats?pageSize=100');
      return res.data;
    },
  });
  const lots = data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/achats/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achats'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success('Achat supprimé');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Impossible de supprimer : ce lot a déjà été partiellement consommé');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erreur');
      }
    },
  });

  const fullyConsumed = (l: Lot) => Number(l.quantityAvailable) <= 0;
  const partiallyConsumed = (l: Lot) => Number(l.quantityAvailable) < Number(l.quantityInitial);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <PackagePlus size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Achats</h1>
            <p className="text-sm text-amber-500 dark:text-amber-500">
              Lots d&apos;ingrédients — traçabilité FIFO
            </p>
          </div>
        </div>
        {can('achats.write') && (
          <button
            onClick={() => { setEditingId(null); setSheetOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} /> Nouvel achat
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-amber-50 dark:bg-amber-900/10 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : lots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-500 dark:text-amber-500 mb-3">Aucun achat enregistré.</p>
          {can('achats.write') && (
            <button
              onClick={() => { setEditingId(null); setSheetOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={14} /> Enregistrer un achat
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-amber-950/10 rounded-xl border border-amber-100 dark:border-amber-900/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-100 dark:border-amber-900/40 text-left text-xs text-amber-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Ingrédient</th>
                <th className="px-4 py-2.5">Stock</th>
                <th className="px-4 py-2.5">Fournisseur</th>
                <th className="px-4 py-2.5 text-right">Disponible / Initial</th>
                <th className="px-4 py-2.5 text-right">Prix HT / cond.</th>
                <th className="px-4 py-2.5">Achat</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr
                  key={lot.id}
                  className={`border-b border-amber-50 dark:border-amber-900/20 last:border-0 ${
                    fullyConsumed(lot) ? 'opacity-40' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-amber-900 dark:text-amber-100">{lot.ingredient.name}</td>
                  <td className="px-4 py-2.5 text-amber-700 dark:text-amber-300">{lot.stock.name}</td>
                  <td className="px-4 py-2.5 text-amber-500 dark:text-amber-500">{lot.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {formatQty(Number(lot.quantityAvailable), lot.ingredient.unit)} / {formatQty(Number(lot.quantityInitial), lot.ingredient.unit)}
                    {partiallyConsumed(lot) && !fullyConsumed(lot) && (
                      <span className="ml-1.5 text-xs text-amber-400">(partiel)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatPrice(Number(lot.unitPrice))}</td>
                  <td className="px-4 py-2.5 text-amber-500 dark:text-amber-500">
                    {new Date(lot.purchaseDate).toLocaleDateString('fr-BE')}
                  </td>
                  <td className="px-4 py-2.5">
                    {can('achats.write') && (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditingId(lot.id); setSheetOpen(true); }}
                          className="p-1.5 text-amber-500 hover:text-amber-700 rounded transition-colors"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(lot.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AchatSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingId(null); }}
        editingId={editingId}
      />
    </div>
  );
}
