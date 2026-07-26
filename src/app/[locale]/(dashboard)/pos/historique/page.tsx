'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Crumb, Card, DataTable, Pill, Tabs, type DataTableColumn } from '@/components/ui';

interface PosSaleItem {
  id: string;
  quantity: number;
  unitPriceTTC: string;
  totalTTC: string;
  product: { name: string };
}
interface PosSale {
  id: string;
  vendeur: { firstName: string; lastName: string };
  paymentMethod: 'CASH' | 'CARD';
  totalTTC: string;
  createdAt: string;
  items: PosSaleItem[];
}
interface SessionCaisseRow {
  id: string;
  vendeur: { firstName: string; lastName: string };
  openingFloat: string;
  closingFloat: string | null;
  variance: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
}
interface PointageRow {
  id: string;
  vendeur: { firstName: string; lastName: string };
  clockIn: string;
  clockOut: string | null;
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });

function varianceTone(variance: number): 'ok' | 'warn' | 'crit' {
  if (variance === 0) return 'ok';
  return Math.abs(variance) < 1 ? 'warn' : 'crit';
}

export default function PosHistoriquePage() {
  const [tab, setTab] = useState<'ventes' | 'caisse' | 'pointages'>('ventes');

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['pos-sales-history'],
    queryFn: async () => (await apiClient.get<PosSale[]>('/api/v1/pos/sales')).data,
    enabled: tab === 'ventes',
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['pos-caisse-sessions-history'],
    queryFn: async () => (await apiClient.get<SessionCaisseRow[]>('/api/v1/pos/caisse-sessions')).data,
    enabled: tab === 'caisse',
  });

  const { data: pointages, isLoading: pointagesLoading } = useQuery({
    queryKey: ['pos-pointages-history'],
    queryFn: async () => (await apiClient.get<PointageRow[]>('/api/v1/pos/pointages')).data,
    enabled: tab === 'pointages',
  });

  const saleColumns: DataTableColumn<PosSale>[] = [
    { key: 'createdAt', label: 'Date', width: 130, render: (r) => fmtDateTime(r.createdAt) },
    { key: 'vendeur', label: 'Vendeur', width: 130, render: (r) => `${r.vendeur.firstName} ${r.vendeur.lastName}` },
    {
      key: 'items',
      label: 'Articles',
      render: (r) => r.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', '),
    },
    {
      key: 'paymentMethod',
      label: 'Paiement',
      width: 90,
      render: (r) => <Pill tone={r.paymentMethod === 'CASH' ? 'ok' : 'info'}>{r.paymentMethod === 'CASH' ? 'Espèces' : 'Carte'}</Pill>,
    },
    { key: 'totalTTC', label: 'Montant', width: 90, align: 'right', render: (r) => `${Number(r.totalTTC).toFixed(2)}€` },
  ];

  const sessionColumns: DataTableColumn<SessionCaisseRow>[] = [
    { key: 'openedAt', label: 'Ouverture', width: 130, render: (r) => fmtDateTime(r.openedAt) },
    { key: 'vendeur', label: 'Vendeur', width: 130, render: (r) => `${r.vendeur.firstName} ${r.vendeur.lastName}` },
    { key: 'status', label: 'Statut', width: 100, render: (r) => <Pill tone={r.status === 'OPEN' ? 'ok' : 'neutral'}>{r.status === 'OPEN' ? 'Ouverte' : 'Fermée'}</Pill> },
    { key: 'openingFloat', label: 'Fond ouv.', width: 90, align: 'right', render: (r) => `${Number(r.openingFloat).toFixed(2)}€` },
    { key: 'closingFloat', label: 'Fond ferm.', width: 90, align: 'right', render: (r) => (r.closingFloat != null ? `${Number(r.closingFloat).toFixed(2)}€` : '—') },
    {
      key: 'variance',
      label: 'Écart',
      width: 100,
      align: 'right',
      render: (r) =>
        r.variance != null ? (
          <Pill tone={varianceTone(Number(r.variance))}>
            {Number(r.variance) > 0 ? '+' : ''}
            {Number(r.variance).toFixed(2)}€
          </Pill>
        ) : (
          '—'
        ),
    },
  ];

  const pointageColumns: DataTableColumn<PointageRow>[] = [
    { key: 'vendeur', label: 'Vendeur', width: 150, render: (r) => `${r.vendeur.firstName} ${r.vendeur.lastName}` },
    { key: 'clockIn', label: 'Arrivée', width: 150, render: (r) => fmtDateTime(r.clockIn) },
    { key: 'clockOut', label: 'Départ', width: 100, render: (r) => (r.clockOut ? fmtTime(r.clockOut) : <Pill tone="ok">en cours</Pill>) },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Point de vente', 'Historique']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Historique POS</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">Ventes, sessions de caisse et pointages de l&apos;équipe.</p>
      </div>

      <Card padded={false}>
        <Tabs
          tabs={[
            { key: 'ventes', label: 'Ventes' },
            { key: 'caisse', label: 'Caisse' },
            { key: 'pointages', label: 'Pointages' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as typeof tab)}
          className="px-3"
        />

        <div>
          {tab === 'ventes' &&
            (salesLoading ? (
              <div className="p-6 text-erp-sm text-neutral-400">Chargement…</div>
            ) : (
              <DataTable columns={saleColumns} rows={sales ?? []} emptyState="Aucune vente enregistrée." />
            ))}

          {tab === 'caisse' &&
            (sessionsLoading ? (
              <div className="p-6 text-erp-sm text-neutral-400">Chargement…</div>
            ) : (
              <DataTable columns={sessionColumns} rows={sessions ?? []} emptyState="Aucune session de caisse." />
            ))}

          {tab === 'pointages' &&
            (pointagesLoading ? (
              <div className="p-6 text-erp-sm text-neutral-400">Chargement…</div>
            ) : (
              <DataTable columns={pointageColumns} rows={pointages ?? []} emptyState="Aucun pointage enregistré." />
            ))}
        </div>
      </Card>
    </div>
  );
}
