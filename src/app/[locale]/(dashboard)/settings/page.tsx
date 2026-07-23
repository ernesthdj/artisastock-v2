'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, Btn, Pill, Empty } from '@/components/ui';
import { usePermissions } from '@/hooks/use-permissions';

interface Tenant {
  id: string;
  name: string;
  isActive: boolean;
}

export default function ParamtresPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [confirming, setConfirming] = useState(false);

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

      <Empty
        icon="⚙️"
        title="Paramètres"
        desc="Configurez votre espace artisan, facturation, notifications et intégrations. Le reste du module Paramètres est en cours de construction."
        action={<Pill tone="gold">🚧 En développement</Pill>}
      />
    </div>
  );
}
