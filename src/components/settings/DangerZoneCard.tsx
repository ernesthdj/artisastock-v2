'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Card, Btn, Input } from '@/components/ui';
import { FLUSH_CATEGORIES, type FlushCategoryId } from '@/lib/settings/flush-data';

interface FlushResult {
  deletedCounts: Record<string, number>;
  totalDeleted: number;
}

export function DangerZoneCard({ tenantName }: { tenantName: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<FlushCategoryId>>(new Set());
  const [confirmInput, setConfirmInput] = useState('');

  const allSelected = selected.size === FLUSH_CATEGORIES.length;
  const canSubmit = selected.size > 0 && confirmInput === tenantName;

  const toggle = (id: FlushCategoryId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(FLUSH_CATEGORIES.map((c) => c.id)));
  };

  const flushMutation = useMutation({
    mutationFn: () =>
      apiClient.post<FlushResult>('/api/v1/settings/flush-data', {
        categories: [...selected],
        confirmName: confirmInput,
      }),
    onSuccess: (res) => {
      toast.success(`${res.data.totalDeleted} enregistrement(s) supprimé(s)`);
      setSelected(new Set());
      setConfirmInput('');
      queryClient.invalidateQueries();
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur lors du flush'),
  });

  return (
    <Card
      title={
        <span className="flex items-center gap-1.5 text-framboise-500">
          <AlertTriangle size={14} /> Zone de danger
        </span>
      }
      subtitle="Vider les données de test — irréversible, ne touche jamais votre compte ni vos accès"
      className="border-framboise-200"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-erp-xs text-choco-500">Catégories à vider</span>
          <button type="button" onClick={toggleAll} className="text-erp-xs text-framboise-400 hover:underline">
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {FLUSH_CATEGORIES.map((cat) => (
            <label
              key={cat.id}
              className="flex items-start gap-2.5 px-3 py-2 rounded-[var(--rx-input)] border border-[var(--line-1)] hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(cat.id)}
                onChange={() => toggle(cat.id)}
                className="mt-0.5 accent-framboise-400"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-erp-sm text-choco-700 font-medium">{cat.label}</span>
                <span className="block text-[11.5px] text-neutral-500">{cat.description}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-[11.5px] text-neutral-500">
          Les catégories sont interdépendantes (ex. Produits référence Recettes &amp; BOM, Commandes/POS
          référencent Produits). En cas d&apos;erreur de dépendance, rien n&apos;est supprimé — sélectionnez
          « Tout » ou ajoutez les catégories liées.
        </p>

        <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--line-1)]">
          <span className="text-erp-xs text-choco-500">
            Pour confirmer, tapez le nom exact de votre espace (<strong>{tenantName}</strong>)
          </span>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={tenantName}
          />
        </div>

        <div className="flex justify-end">
          <Btn
            variant="danger"
            size="sm"
            disabled={!canSubmit || flushMutation.isPending}
            onClick={() => flushMutation.mutate()}
          >
            {flushMutation.isPending ? 'Suppression...' : 'Vider les données sélectionnées'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
