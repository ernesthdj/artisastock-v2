'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Edit } from 'lucide-react';
import { Card, Btn, Pill, Empty, DataTable, type DataTableColumn } from '@/components/ui';
import { usePermissions } from '@/hooks/use-permissions';
import { TenantVatRateSheet } from '@/components/settings/TenantVatRateSheet';

interface Tenant {
  id: string;
  name: string;
  isActive: boolean;
}

interface TenantVatRate {
  id: string;
  label: string;
  ratePercent: string;
  isActive: boolean;
}

export default function ParamtresPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [confirming, setConfirming] = useState(false);
  const [vatSheetOpen, setVatSheetOpen] = useState(false);
  const [editingVatId, setEditingVatId] = useState<string | null>(null);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['tenant-current'],
    queryFn: async () => {
      const res = await apiClient.get<Tenant>('/api/v1/tenants/current');
      return res.data;
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => apiClient.patch('/api/v1/tenants/current/deactivate', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
      toast.success('Compte désactivé');
      setConfirming(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => apiClient.patch('/api/v1/tenants/current/reactivate', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-current'] });
      toast.success('Compte réactivé');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const { data: vatRates, isLoading: vatLoading } = useQuery({
    queryKey: ['tenant-vat-rates'],
    queryFn: async () => {
      const res = await apiClient.get<TenantVatRate[]>('/api/v1/tenant-vat-rates?pageSize=100');
      return res.data;
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/v1/tenant-vat-rates/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-vat-rates'] });
      toast.success('Taux de TVA mis à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const vatColumns: DataTableColumn<TenantVatRate>[] = [
    { key: 'label', label: 'Libellé', render: (v) => <span className="font-medium text-choco-600">{v.label}</span> },
    { key: 'rate', label: 'Taux', align: 'right', render: (v) => `${Number(v.ratePercent)} %` },
    {
      key: 'status',
      label: 'Statut',
      render: (v) => <Pill tone={v.isActive ? 'ok' : 'warn'}>{v.isActive ? '● Actif' : '⏸ Inactif'}</Pill>,
    },
    {
      key: 'actions',
      label: '',
      width: 90,
      render: (v) =>
        can('tenant-vat-rates.write') ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => { setEditingVatId(v.id); setVatSheetOpen(true); }}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-choco-600"
              title="Modifier"
            >
              <Edit size={14} />
            </button>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => toggleActiveMutation.mutate({ id: v.id, isActive: !v.isActive })}
              disabled={toggleActiveMutation.isPending}
            >
              {v.isActive ? 'Désactiver' : 'Réactiver'}
            </Btn>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-5">
      <Card
        title="Compte"
        subtitle="Statut de votre espace artisan"
        actions={
          !isLoading && tenant && can('settings.write') ? (
            tenant.isActive ? (
              confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-erp-xs text-choco-500">Confirmer ?</span>
                  <Btn variant="danger" size="sm" onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
                    {deactivateMutation.isPending ? 'Désactivation...' : 'Oui, désactiver'}
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setConfirming(false)}>Annuler</Btn>
                </div>
              ) : (
                <Btn variant="danger" size="sm" onClick={() => setConfirming(true)}>
                  Désactiver
                </Btn>
              )
            ) : (
              <Btn variant="primary" size="sm" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                {reactivateMutation.isPending ? 'Réactivation...' : 'Réactiver'}
              </Btn>
            )
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="h-5 w-40 bg-[var(--line-1)] rounded animate-pulse" />
        ) : tenant ? (
          <div className="flex items-center gap-2">
            <span className="text-erp-sm text-choco-700">{tenant.name}</span>
            <Pill tone={tenant.isActive ? 'ok' : 'warn'}>
              {tenant.isActive ? '● Actif' : '⏸ Désactivé'}
            </Pill>
          </div>
        ) : null}
      </Card>

      <Card
        title="Taux de TVA"
        subtitle="Bibliothèque de taux utilisée à la publication des produits"
        actions={
          can('tenant-vat-rates.write') ? (
            <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setEditingVatId(null); setVatSheetOpen(true); }}>
              Ajouter
            </Btn>
          ) : undefined
        }
      >
        {vatLoading ? (
          <div className="h-16 bg-[var(--line-1)] rounded animate-pulse" />
        ) : (
          <DataTable
            columns={vatColumns}
            rows={vatRates ?? []}
            emptyState={
              <div className="text-center py-6">
                <p className="text-erp-sm text-neutral-500">Aucun taux de TVA configuré.</p>
              </div>
            }
          />
        )}
      </Card>

      <Empty
        icon="⚙️"
        title="Paramètres"
        desc="Configurez votre espace artisan, facturation, notifications et intégrations. Le reste du module Paramètres est en cours de construction."
        action={<Pill tone="gold">🚧 En développement</Pill>}
      />

      <TenantVatRateSheet
        open={vatSheetOpen}
        onClose={() => { setVatSheetOpen(false); setEditingVatId(null); }}
        editingId={editingVatId}
        initialData={vatRates?.find((v) => v.id === editingVatId) ?? null}
        onSuccess={() => { setVatSheetOpen(false); setEditingVatId(null); }}
      />
    </div>
  );
}
