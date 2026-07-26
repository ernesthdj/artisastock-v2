'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useActivite } from '@/providers/ActiviteProvider';
import { Crumb, Card, KpiCard, Pill, DataTable, Empty, type DataTableColumn, type PillTone } from '@/components/ui';
import { StockDetailPanel, type StockDetailRow } from '@/components/stock/StockDetailPanel';
import { ProductAllocationPanel } from '@/components/products/ProductAllocationPanel';
import { AlertTriangle, Wallet, Package, Layers, ShoppingBag, Warehouse, Tag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
  stockName: string | null;
  mixedStock: boolean;
  batches: { id: string; qty: number; unitCost: number; producedAt: string; dlcDate: string | null; stockName: string | null }[];
}
interface FinalRow {
  productId: string;
  name: string;
  priceTTC: number;
  pos: { maxBatchesNow: number };
  vitrine: { allocated: number; remaining: number; valorisation: number; stockName: string | null; mixedStock: boolean } | null;
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

const CATEGORY_META: Record<string, { label: string; tone: PillTone }> = {
  DRY: { label: 'Sec', tone: 'neutral' },
  FRESH: { label: 'Frais', tone: 'ok' },
  FROZEN: { label: 'Congelé', tone: 'info' },
  LIQUID: { label: 'Liquide', tone: 'info' },
  SPICE: { label: 'Épice', tone: 'warn' },
  DAIRY: { label: 'Laitier', tone: 'neutral' },
  FLOUR: { label: 'Farine', tone: 'gold' },
  SUGAR: { label: 'Sucre', tone: 'gold' },
  OTHER: { label: 'Autre', tone: 'neutral' },
};
const TONE_BADGE: Record<PillTone, string> = {
  neutral: 'bg-[#F1ECDF] text-[#5C523F]',
  ok: 'bg-[#E4F6E7] text-[#1B5E20]',
  crit: 'bg-[#FFE4E4] text-[#8D1F33]',
  warn: 'bg-[#FCEED7] text-[#7A4E1C]',
  info: 'bg-[#E4F0FF] text-[#1E468A]',
  gold: 'bg-[#FBF1CC] text-or-600',
  choco: 'bg-choco-600 text-[#FCF8EF]',
};

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

function GroupTitle({ icon, badgeClass, label }: { icon: React.ReactNode; badgeClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', badgeClass)}>{icon}</span>
      {label}
    </span>
  );
}

export default function VueStockPage() {
  const { activite, isLoading: activiteLoading } = useActivite();
  const [groupBy, setGroupBy] = useState<'stock' | 'categorie'>('stock');
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

  // Vue "par catégorie" : les mêmes ingrédients, mais fusionnés à travers les emplacements
  // (la catégorie est un attribut de l'ingrédient, pas de l'emplacement — pas de sens de la
  // répéter par Stock) puis regroupés par catégorie plutôt que par Stock physique.
  const categoryGroups = useMemo(() => {
    if (!data) return [];
    const byIngredient = new Map<string, IngredientRow>();
    for (const stock of data.stocks) {
      for (const ing of stock.ingredients) {
        const existing = byIngredient.get(ing.id);
        if (existing) {
          existing.qty += ing.qty;
          existing.valorisation += ing.valorisation;
          existing.lotsCount += ing.lotsCount;
          existing.lots = [...existing.lots, ...ing.lots];
          const candidates = [existing.nearestExpiry, ing.nearestExpiry].filter((d): d is string => !!d);
          existing.nearestExpiry = candidates.length ? candidates.sort()[0] : null;
        } else {
          byIngredient.set(ing.id, { ...ing, lots: [...ing.lots] });
        }
      }
    }

    const byCategory = new Map<string, IngredientRow[]>();
    for (const ing of byIngredient.values()) {
      const cat = ing.category ?? 'OTHER';
      const arr = byCategory.get(cat) ?? [];
      arr.push(ing);
      byCategory.set(cat, arr);
    }

    return [...byCategory.entries()]
      .map(([category, ingredients]) => ({
        category,
        valorisation: ingredients.reduce((s, i) => s + i.valorisation, 0),
        ingredients: ingredients.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [data]);

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
        stockName: b.stockName,
        expiry: b.dlcDate,
      }))
    : [];

  const baseIngredientColumns: DataTableColumn<IngredientRow>[] = [
    {
      key: 'name',
      label: 'Ingrédient',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.inAlert && <AlertTriangle size={13} className="text-[var(--color-warning)] shrink-0" />}
          <span className="font-medium text-choco-600">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Catégorie',
      sortable: true,
      sortValue: (r) => r.category ?? '',
      render: (r) => r.category ?? '—',
    },
    {
      key: 'qty',
      label: 'Qté dispo',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.qty,
      render: (r) => (
        <span className={r.inAlert ? 'text-[var(--color-warning)] font-semibold' : ''}>
          {r.qty} {r.unit.toLowerCase()}
        </span>
      ),
    },
    {
      key: 'priceUnit',
      label: 'Coût/unité',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.priceUnit,
      render: (r) => `${r.priceUnit.toFixed(4)}€`,
    },
    {
      key: 'valorisation',
      label: 'Valorisation',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.valorisation,
      render: (r) => <strong>{fmtEur(r.valorisation)}</strong>,
    },
    {
      key: 'lotsCount',
      label: 'Lots',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.lotsCount,
      render: (r) => r.lotsCount,
    },
    {
      key: 'nearestExpiry',
      label: 'DLC proche',
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.nearestExpiry ? new Date(r.nearestExpiry).getTime() : Number.POSITIVE_INFINITY),
      render: (r) => fmtDlc(r.nearestExpiry),
    },
  ];
  // En vue "par catégorie", la colonne Catégorie est redondante avec l'en-tête de groupe.
  const ingredientColumnsByStock = baseIngredientColumns;
  const ingredientColumnsByCategory = baseIngredientColumns.filter((c) => c.key !== 'category');

  const intermediaireColumns: DataTableColumn<IntermediaireRow>[] = [
    { key: 'name', label: 'Fiche', sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium text-choco-600">{r.name}</span> },
    {
      key: 'totalQty',
      label: 'Qté dispo',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.totalQty,
      render: (r) => `${r.totalQty} ${r.outputUnit.toLowerCase()}`,
    },
    {
      key: 'avgUnitCost',
      label: 'Coût moyen/unité',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.avgUnitCost,
      render: (r) => `${r.avgUnitCost.toFixed(4)}€`,
    },
    {
      key: 'valorisation',
      label: 'Valorisation',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.valorisation,
      render: (r) => <strong>{fmtEur(r.valorisation)}</strong>,
    },
    { key: 'batchesCount', label: 'Lots', align: 'right', sortable: true, sortValue: (r) => r.batchesCount, render: (r) => r.batchesCount },
    {
      key: 'nearestExpiry',
      label: 'DLC proche',
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.nearestExpiry ? new Date(r.nearestExpiry).getTime() : Number.POSITIVE_INFINITY),
      render: (r) => fmtDlc(r.nearestExpiry),
    },
    {
      key: 'stockName',
      label: 'Stock',
      sortable: true,
      sortValue: (r) => r.stockName ?? '',
      render: (r) =>
        r.mixedStock ? (
          <Pill tone="info">Plusieurs emplacements</Pill>
        ) : r.stockName ? (
          <span className="inline-flex items-center gap-1"><Warehouse size={12} className="text-neutral-400" />{r.stockName}</span>
        ) : (
          <span className="text-neutral-400 italic">non renseigné</span>
        ),
    },
  ];

  const finalColumns: DataTableColumn<FinalRow>[] = [
    { key: 'name', label: 'Produit', sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium text-choco-600">{r.name}</span> },
    { key: 'priceTTC', label: 'Prix TTC', align: 'right', sortable: true, sortValue: (r) => r.priceTTC, render: (r) => fmtEur(r.priceTTC) },
    {
      key: 'pos',
      label: 'POS (à la demande)',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.pos.maxBatchesNow,
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
      sortable: true,
      sortValue: (r) => r.vitrine?.remaining ?? -1,
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
      sortable: true,
      sortValue: (r) => r.vitrine?.valorisation ?? -1,
      render: (r) => (r.vitrine ? fmtEur(r.vitrine.valorisation) : <span className="text-neutral-400">—</span>),
    },
    {
      key: 'stockName',
      label: 'Stock',
      sortable: true,
      sortValue: (r) => (r.vitrine ? r.vitrine.stockName ?? '' : 'zzz_vente_directe'),
      render: (r) => {
        if (!r.vitrine) return <Pill tone="gold">Vente directe</Pill>;
        if (r.vitrine.mixedStock) return <Pill tone="info">Plusieurs emplacements</Pill>;
        return r.vitrine.stockName ? (
          <span className="inline-flex items-center gap-1"><Warehouse size={12} className="text-neutral-400" />{r.vitrine.stockName}</span>
        ) : (
          <span className="text-neutral-400 italic">non renseigné</span>
        );
      },
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

      <div className="rounded-[var(--rx-card)] border border-[var(--choco-100)] bg-[var(--choco-50)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-erp-lg font-bold text-choco-600 flex items-center gap-2">
            <Package size={16} /> Stocks — ingrédients
          </h2>
          <div className="flex gap-1.5">
            <button
              onClick={() => setGroupBy('stock')}
              className={cn(
                'h-8 px-3 rounded-[var(--rx-input)] text-erp-xs font-medium border inline-flex items-center gap-1.5',
                groupBy === 'stock' ? 'border-choco-600 bg-[var(--surface-hover)] text-choco-600' : 'border-[var(--line-2)] text-neutral-500'
              )}
            >
              <Warehouse size={13} /> Par emplacement
            </button>
            <button
              onClick={() => setGroupBy('categorie')}
              className={cn(
                'h-8 px-3 rounded-[var(--rx-input)] text-erp-xs font-medium border inline-flex items-center gap-1.5',
                groupBy === 'categorie' ? 'border-choco-600 bg-[var(--surface-hover)] text-choco-600' : 'border-[var(--line-2)] text-neutral-500'
              )}
            >
              <Tag size={13} /> Par catégorie
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupBy === 'stock' &&
            data?.stocks.map((stock) => (
              <Card
                key={stock.id}
                title={<GroupTitle icon={<Warehouse size={13} />} badgeClass="bg-choco-600 text-[#FCF8EF]" label={stock.name} />}
                subtitle={`${stock.ingredients.length} ingrédient(s) · Valorisation ${fmtEur(stock.valorisation)}`}
                padded={false}
                className="flex flex-col"
              >
                <div className="max-h-[340px] overflow-y-auto">
                  <DataTable
                    columns={ingredientColumnsByStock}
                    rows={stock.ingredients}
                    onRowClick={(r) => setIngredientDetail(r)}
                    emptyState="Aucun ingrédient en stock dans cet emplacement."
                  />
                </div>
              </Card>
            ))}
          {groupBy === 'stock' && data?.stocks.length === 0 && (
            <p className="text-erp-sm text-neutral-400 italic col-span-full">Aucun stock lié à cette activité.</p>
          )}

          {groupBy === 'categorie' &&
            categoryGroups.map((group) => {
              const meta = CATEGORY_META[group.category] ?? { label: group.category, tone: 'neutral' as PillTone };
              return (
                <Card
                  key={group.category}
                  title={<GroupTitle icon={<Tag size={13} />} badgeClass={TONE_BADGE[meta.tone]} label={meta.label} />}
                  subtitle={`${group.ingredients.length} ingrédient(s) · Valorisation ${fmtEur(group.valorisation)}`}
                  padded={false}
                  className="flex flex-col"
                >
                  <div className="max-h-[340px] overflow-y-auto">
                    <DataTable
                      columns={ingredientColumnsByCategory}
                      rows={group.ingredients}
                      onRowClick={(r) => setIngredientDetail(r)}
                      emptyState="Aucun ingrédient dans cette catégorie."
                    />
                  </div>
                </Card>
              );
            })}
          {groupBy === 'categorie' && categoryGroups.length === 0 && (
            <p className="text-erp-sm text-neutral-400 italic col-span-full">Aucun ingrédient en stock pour cette activité.</p>
          )}
        </div>
      </div>

      <div className="rounded-[var(--rx-card)] border border-[#E2C964] bg-[#FFFAE5] p-4 space-y-4">
        <h2 className="text-erp-lg font-bold text-or-600 flex items-center gap-2">
          <ShoppingBag size={16} /> Produits — intermédiaires &amp; finaux
        </h2>

        <div>
          <h3 className="text-erp-sm font-semibold text-choco-600 mb-2 flex items-center gap-2">
            <Layers size={14} /> Intermédiaires
          </h3>
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
          <h3 className="text-erp-sm font-semibold text-choco-600 mb-2 flex items-center gap-2">
            <ShoppingBag size={14} /> Finaux
          </h3>
          <Card padded={false}>
            <DataTable
              columns={finalColumns}
              rows={data?.finaux ?? []}
              onRowClick={(r) => setProductDetail(r)}
              emptyState="Aucun produit publié pour cette activité."
            />
          </Card>
        </div>
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
