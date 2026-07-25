'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, KeyRound } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { VendeurSheet } from '@/components/pos/VendeurSheet';
import { PinPad } from '@/components/pos/PinPad';
import { Crumb, Btn, Pill, DataTable, type DataTableColumn } from '@/components/ui';

interface Vendeur {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lockedUntil: string | null;
  createdAt: string;
}

export default function VendeursPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resetVendeurId, setResetVendeurId] = useState<string | null>(null);
  const [pinPadOpen, setPinPadOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-vendeurs'],
    queryFn: async () => {
      const res = await apiClient.get<Vendeur[]>('/api/v1/pos/vendeurs?pageSize=100');
      return { data: res.data, total: res.meta?.total ?? 0 };
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/v1/pos/vendeurs/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-vendeurs'] });
      toast.success('Vendeur mis à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const vendeurs = data?.data ?? [];
  const total = data?.total ?? 0;

  const isLocked = (v: Vendeur) => !!v.lockedUntil && new Date(v.lockedUntil) > new Date();

  const columns: DataTableColumn<Vendeur>[] = [
    {
      key: 'name',
      label: 'Nom',
      render: (v) => <span className="font-medium text-choco-600">{v.firstName} {v.lastName}</span>,
    },
    {
      key: 'status',
      label: 'Statut',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => can('pos.manage') && toggleActiveMutation.mutate({ id: v.id, isActive: !v.isActive })}
            disabled={!can('pos.manage') || toggleActiveMutation.isPending}
            className="disabled:cursor-default"
          >
            <Pill tone={v.isActive ? 'ok' : 'neutral'}>{v.isActive ? '● Actif' : '⏸ Désactivé'}</Pill>
          </button>
          {isLocked(v) && <Pill tone="crit">🔒 Verrouillé</Pill>}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 40,
      render: (v) =>
        can('pos.manage') ? (
          <button
            onClick={() => setResetVendeurId(v.id)}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-choco-600"
            title="Réinitialiser le PIN"
          >
            <KeyRound size={15} />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Crumb items={['Dashboard', 'Point de vente', 'Vendeurs']} className="mb-1" />
          <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Vendeurs</h1>
          <p className="text-erp-sm text-neutral-500 mt-0.5">{total} vendeur{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => setPinPadOpen(true)}>Tester le PIN</Btn>
          {can('pos.manage') && (
            <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setSheetOpen(true)}>
              Ajouter
            </Btn>
          )}
        </div>
      </div>

      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-neutral-100 rounded animate-skeleton" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={vendeurs}
            emptyState={
              <div className="text-center py-12">
                <p className="text-erp-lg text-neutral-500 mb-1">Aucun vendeur</p>
                <p className="text-erp-sm text-neutral-400">Ajoutez le premier membre de l&apos;équipe comptoir.</p>
              </div>
            }
          />
        )}
      </div>

      <VendeurSheet open={sheetOpen} onClose={() => setSheetOpen(false)} vendeurId={null} />
      <VendeurSheet open={!!resetVendeurId} onClose={() => setResetVendeurId(null)} vendeurId={resetVendeurId} />

      <PinPad
        open={pinPadOpen}
        onClose={() => setPinPadOpen(false)}
        onVerified={(v) => {
          toast.success(`Identité vérifiée : ${v.firstName} ${v.lastName}`);
          setPinPadOpen(false);
        }}
      />
    </div>
  );
}
