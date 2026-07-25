'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Boxes, Lock } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { usePermissions } from '@/hooks/use-permissions';
import { ProductPublishSheet } from '@/components/products/ProductPublishSheet';
import { ProductAllocationPanel } from '@/components/products/ProductAllocationPanel';
import { ProductClosureModal } from '@/components/products/ProductClosureModal';
import { Crumb, Btn, Pill, DataTable, type DataTableColumn } from '@/components/ui';

interface Product {
  id: string;
  name: string;
  category: string | null;
  priceHT: string;
  priceTTC: string;
  isPerishable: boolean;
  isVisible: boolean;
  hasRemainingStock: boolean;
  bomSheet: { id: string; name: string };
  vatRate: { id: string; label: string; ratePercent: string };
}

export default function ProduitsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [allocProduct, setAllocProduct] = useState<{ id: string; name: string } | null>(null);
  const [closureProduct, setClosureProduct] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await apiClient.get<Product[]>('/api/v1/products?pageSize=100');
      return { data: res.data, total: res.meta?.total ?? 0 };
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiClient.patch(`/api/v1/products/${id}/visibility`, { isVisible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Statut mis à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const togglePerishableMutation = useMutation({
    mutationFn: ({ id, isPerishable }: { id: string; isPerishable: boolean }) =>
      apiClient.patch(`/api/v1/products/${id}`, { isPerishable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit mis à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const products = data?.data ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<Product>[] = [
    {
      key: 'name',
      label: 'Nom',
      render: (p) => <span className="font-medium text-choco-600">{p.name}</span>,
    },
    { key: 'bomSheet', label: 'Fiche BOM', render: (p) => p.bomSheet.name },
    { key: 'category', label: 'Catégorie', render: (p) => p.category ?? '—' },
    { key: 'vat', label: 'TVA', align: 'right', render: (p) => `${Number(p.vatRate.ratePercent)}%` },
    { key: 'priceTTC', label: 'Prix TTC', align: 'right', render: (p) => formatPrice(Number(p.priceTTC)) },
    {
      key: 'perishable',
      label: 'Périssable',
      render: (p) => (
        <button
          onClick={() => can('products.write') && togglePerishableMutation.mutate({ id: p.id, isPerishable: !p.isPerishable })}
          disabled={!can('products.write') || togglePerishableMutation.isPending}
          className="disabled:cursor-default"
          title="Cliquer pour basculer"
        >
          <Pill tone={p.isPerishable ? 'gold' : 'neutral'}>{p.isPerishable ? '⏳ Oui' : 'Non'}</Pill>
        </button>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (p) => (
        <button
          onClick={() => can('products.write') && toggleVisibilityMutation.mutate({ id: p.id, isVisible: !p.isVisible })}
          disabled={!can('products.write') || toggleVisibilityMutation.isPending}
          className="disabled:cursor-default"
        >
          <Pill tone={p.isVisible ? 'ok' : 'neutral'}>{p.isVisible ? '● Visible' : '⏸ Masqué'}</Pill>
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 40,
      render: (p) => (
        <div className="flex items-center gap-1">
          {can('products.allocate') && (
            <button
              onClick={() => setAllocProduct({ id: p.id, name: p.name })}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-choco-600"
              title="Allouer le stock"
            >
              <Boxes size={15} />
            </button>
          )}
          {can('products.close') && p.isPerishable && p.hasRemainingStock && (
            <button
              onClick={() => setClosureProduct({ id: p.id, name: p.name })}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-choco-600"
              title="Clôturer la journée"
            >
              <Lock size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Crumb items={['Dashboard', 'Produits']} className="mb-1" />
          <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Produits</h1>
          <p className="text-erp-sm text-neutral-500 mt-0.5">{total} produit{total !== 1 ? 's' : ''} publié{total !== 1 ? 's' : ''}</p>
        </div>
        {can('products.write') && (
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setSheetOpen(true)}>
            Publier un produit
          </Btn>
        )}
      </div>

      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-neutral-100 rounded animate-skeleton" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={products}
            emptyState={
              <div className="text-center py-12">
                <p className="text-erp-lg text-neutral-500 mb-1">Aucun produit publié</p>
                <p className="text-erp-sm text-neutral-400">Publiez un produit depuis une fiche BOM ayant du stock.</p>
              </div>
            }
          />
        )}
      </div>

      <ProductPublishSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={() => setSheetOpen(false)}
      />

      <ProductAllocationPanel
        open={!!allocProduct}
        onClose={() => setAllocProduct(null)}
        productId={allocProduct?.id ?? null}
        productName={allocProduct?.name ?? ''}
      />

      <ProductClosureModal
        open={!!closureProduct}
        onClose={() => { setClosureProduct(null); queryClient.invalidateQueries({ queryKey: ['products'] }); }}
        productId={closureProduct?.id ?? null}
        productName={closureProduct?.name ?? ''}
      />
    </div>
  );
}
