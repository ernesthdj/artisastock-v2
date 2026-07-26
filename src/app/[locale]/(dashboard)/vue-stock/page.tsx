'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useActivite } from '@/providers/ActiviteProvider';
import { Crumb, Card, KpiCard, Pill, DataTable, Empty, type DataTableColumn } from '@/components/ui';
import { StockDetailPanel, type StockDetailRow } from '@/components/stock/StockDetailPanel';
import { ProductAllocationPanel } from '@/components/products/ProductAllocationPanel';
import { AlertTriangle, Wallet, Package, Layers, ShoppingBag } from 'lucide-react';

interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  qty: number;
  priceUnit: number;
  valorisation: number;
  inAlert: boolean;
  lotsCount: number;
  nearestExpiry: string | null;
  lots: { id: string; purchaseDate: string; expiryDate: string | null; quantityAvailable: number; unitCost: number }[];
}
interface StockGroup {
  id: string;
  name: string;
  valorisation: number;
  ingredients: IngredientRow[];
}
interface IntermediaireRow {
  sheetId: string;
  name: string;
  outputUnit: string;
  totalQty: number;
  avgUnitCost: number;
  valorisation: number;
  batchesCount: number;
  nearestExpiry: string | null;
  batches: { id: string; qty: number; unitCost: number; producedAt: string; dlcDate: string | null }[];
}
interface FinalRow {
  productId: string;
  name: string;
  priceTTC: number;
  pos: { maxBatchesNow: number };
  vitrine: { allocated: number; remaining: number; valorisation: number } | null;
}
interface VueStockData {
  activite: { id: string; name: string };
  summary: {
    ingredientsValue: number;
    intermediairesValue: number;
    finauxValue: number;
    totalValue: number;
    alertesCount: number;
    dlcSoonCount: number;
  };
  stocks: StockGroup[];
  intermediaires: IntermediaireRow[];
  finaux: FinalRow[];
}

const fmtEur = (n: number) => `${n.toFixed(2)}€`;
const isSoon = (iso: string | null) => {
  if (!iso) return false;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 7;
};
const fmtDlc = (iso: string | null) => {
  if (!iso) return <span className="text-neutral-400">—</span>;
  const date = new Date(iso).toLocaleDateString('fr-BE');
  return isSoon(iso) ? <Pill tone="warn">{date}</Pill> : <span className="text-neutral-500">{date}</span>;
};

export default function VueStockPage() {
  const { activite, isLoading: activiteLoading } = useActivite();
  const [ingredientDetail, setIngredientDetail] = useState<IngredientRow | null>(null);
  const [batchDetail, setBatchDetail] = useState<IntermediaireRow | null>(null);
  const [productDetail, setProductDetail] = useState<FinalRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vue-stock', activite?.id],
    queryFn: async () => {
      const res = await apiClient.get<VueStockData>(`/api/v1/activites/${activite!.id}/vue-stock`);
      return res.data;
    },
    enabled: !!activite,
  });

  if (activiteLoading || (activite && isLoading)) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-neutral-100 rounded animate-skeleton" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-neutral-100 rounded animate-skeleton" />
          ))}
        </div>
        <div className="h-48 bg-neutral-100 rounded animate-skeleton" />
      </div>
    );
  }

  if (!activite) {
    return (
      <Empty
        icon="▤"
        title="Aucune activité sélectionnée"
        desc="Sélectionnez ou créez une activité pour voir son stock global."
      />
    );
  }

  const ingredientDetailRows: StockDetailRow[] = ingredientDetail
    ? ingredientDetail.lots.map((l) => ({
        id: l.id,
        date: l.purchaseDate,
        qty: l.quantityAvailable,
        unitCost: l.unitCost,
        expiry: l.expiryDate,
      }))
    : [];
  const batchDetailRows: StockDetailRow[] = batchDetail
    ? batchDetail.batches.map((b) => ({
        id: b.id,
        date: b.producedAt,
        qty: b.qty,
        unitCost: b.unitCost,
        expiry: b.dlcDate,
      }))
    : [];

  const ingredientColumns: DataTableColumn<IngredientRow>[] = [
    {
      key: 'name',
      label: 'Ingrédient',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.inAlert && <AlertTriangle size={13} className="text-[var(--color-warning)] shrink-0" />}
          <span className="font-medium text-choco-600">{r.name}</span>
        </div>
      ),
    },
    { key: 'category', label: 'Catégorie', render: (r) => r.category ?? '—' },
    {
      key: 'qty',
      label: 'Qté dispo',
      align: 'right',
      render: (r) => (
        <span className={r.inAlert ? 'text-[var(--color-warning)] font-semibold' : ''}>
          {r.qty} {r.unit.toLowerCase()}
        </span>
      ),
    },
    { key: 'priceUnit', label: 'Coût/unité', align: 'right', render: (r) => `${r.priceUnit.toFixed(4)}€` },
    { key: 'valorisation', label: 'Valorisation', align: 'right', render: (r) => <strong>{fmtEur(r.valorisation)}</strong> },
    { key: 'lotsCount', label: 'Lots', align: 'right', render: (r) => r.lotsCount },
    { key: 'nearestExpiry', label: 'DLC proche', align: 'right', render: (r) => fmtDlc(r.nearestExpiry) },
  ];

  const intermediaireColumns: DataTableColumn<IntermediaireRow>[] = [
    { key: 'name', label: 'Fiche', render: (r) => <span className="font-medium text-choco-600">{r.name}</span> },
    { key: 'totalQty', label: 'Qté dispo', align: 'right', render: (r) => `${r.totalQty} ${r.outputUnit.toLowerCase()}` },
    { key: 'avgUnitCost', label: 'Coût moyen/unité', align: 'right', render: (r) => `${r.avgUnitCost.toFixed(4)}€` },
    { key: 'valorisation', label: 'Valorisation', align: 'right', render: (r) => <strong>{fmtEur(r.valorisation)}</strong> },
    { key: 'batchesCount', label: 'Lots', align: 'right', render: (r) => r.batchesCount },
    { key: 'nearestExpiry', label: 'DLC proche', align: 'right', render: (r) => fmtDlc(r.nearestExpiry) },
  ];

  const finalColumns: DataTableColumn<FinalRow>[] = [
    { key: 'name', label: 'Produit', render: (r) => <span className="font-medium text-choco-600">{r.name}</span> },
    { key: 'priceTTC', label: 'Prix TTC', align: 'right', render: (r) => fmtEur(r.priceTTC) },
    {
      key: 'pos',
      label: 'POS (à la demande)',
      align: 'right',
      render: (r) =>
        r.pos.maxBatchesNow > 0 ? (
          <Pill tone="ok">{r.pos.maxBatchesNow} productible(s)</Pill>
        ) : (
          <Pill tone="crit">rupture ingrédients</Pill>
        ),
    },
    {
      key: 'vitrine',
      label: 'Boutique Web',
      align: 'right',
      render: (r) =>
        r.vitrine ? (
          <span>
            {r.vitrine.remaining} / {r.vitrine.allocated} {r.vitrine.remaining > 0 ? <Pill tone="info">restant</Pill> : <Pill tone="neutral">épuisé</Pill>}
          </span>
        ) : (
          <span className="text-neutral-400 italic">non alloué</span>
        ),
    },
    {
      key: 'valorisationVitrine',
      label: 'Valorisation',
      align: 'right',
      render: (r) => (r.vitrine ? fmtEur(r.vitrine.valorisation) : <span className="text-neutral-400">—</span>),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Vue stock global']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Vue stock global</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">
          {data?.activite.name} — ingrédients, produits intermédiaires et produits finaux, tous emplacements confondus.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Wallet size={14} />} label="Valeur totale du stock" value={fmtEur(data.summary.totalValue)} tone="gold" />
          <KpiCard icon={<Package size={14} />} label="Ingrédients" value={fmtEur(data.summary.ingredientsValue)} />
          <KpiCard
            icon={<Layers size={14} />}
            label="Produits (interméd. + finis)"
            value={fmtEur(data.summary.intermediairesValue + data.summary.finauxValue)}
          />
          <KpiCard
            icon={<AlertTriangle size={14} />}
            label="Alertes"
            value={data.summary.alertesCount}
            sub={data.summary.dlcSoonCount > 0 ? `${data.summary.dlcSoonCount} lot(s) proche(s) de la DLC` : 'Aucune DLC proche'}
            tone={data.summary.alertesCount > 0 ? 'warn' : 'ok'}
          />
        </div>
      )}

      <div>
        <h2 className="text-erp-lg font-semibold text-choco-600 mb-3 flex items-center gap-2">
          <Package size={16} /> Ingrédients par emplacement
        </h2>
        <div className="space-y-4">
          {data?.stocks.map((stock) => (
            <Card key={stock.id} title={stock.name} subtitle={`Valorisation : ${fmtEur(stock.valorisation)}`} padded={false}>
              <DataTable
                columns={ingredientColumns}
                rows={stock.ingredients}
                onRowClick={(r) => setIngredientDetail(r)}
                emptyState="Aucun ingrédient en stock dans cet emplacement."
              />
            </Card>
          ))}
          {data?.stocks.length === 0 && (
            <p className="text-erp-sm text-neutral-400 italic">Aucun stock lié à cette activité.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-erp-lg font-semibold text-choco-600 mb-3 flex items-center gap-2">
          <Layers size={16} /> Produits intermédiaires
        </h2>
        <Card padded={false}>
          <DataTable
            columns={intermediaireColumns}
            rows={data?.intermediaires ?? []}
            onRowClick={(r) => setBatchDetail(r)}
            emptyState="Aucun produit intermédiaire en stock — les fiches produites et non publiées apparaîtront ici."
          />
        </Card>
      </div>

      <div>
        <h2 className="text-erp-lg font-semibold text-choco-600 mb-3 flex items-center gap-2">
          <ShoppingBag size={16} /> Produits finaux
        </h2>
        <Card padded={false}>
          <DataTable
            columns={finalColumns}
            rows={data?.finaux ?? []}
            onRowClick={(r) => setProductDetail(r)}
            emptyState="Aucun produit publié pour cette activité."
          />
        </Card>
      </div>

      <StockDetailPanel
        open={!!ingredientDetail}
        onClose={() => setIngredientDetail(null)}
        title={ingredientDetail?.name ?? ''}
        subtitle="Détail des lots par date d'achat"
        unit={ingredientDetail?.unit ?? ''}
        dateLabel="Achat"
        rows={ingredientDetailRows}
      />
      <StockDetailPanel
        open={!!batchDetail}
        onClose={() => setBatchDetail(null)}
        title={batchDetail?.name ?? ''}
        subtitle="Détail des lots de production"
        unit={batchDetail?.outputUnit ?? ''}
        dateLabel="Production"
        rows={batchDetailRows}
      />
      <ProductAllocationPanel
        open={!!productDetail}
        onClose={() => setProductDetail(null)}
        productId={productDetail?.productId ?? null}
        productName={productDetail?.name ?? ''}
      />
    </div>
  );
}
