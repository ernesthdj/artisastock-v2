'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2, Plus } from 'lucide-react';

type ClosureReason = 'WASTE' | 'STAFF' | 'OTHER';
type Channel = 'VITRINE' | 'DIRECT';

const REASON_LABELS: Record<ClosureReason, string> = {
  WASTE: 'Jeté / Perte',
  STAFF: 'Don équipe',
  OTHER: 'Autre',
};

interface ClosureRecord {
  id: string;
  qty: string;
  reason: ClosureReason;
  note: string | null;
  closedAt: string;
  closedByUser: { firstName: string; lastName: string };
}

interface ChannelStockRow {
  id: string;
  channel: Channel;
  qtyRemaining: string;
  closures: ClosureRecord[];
}

interface ProductDetail {
  id: string;
  channelStock: ChannelStockRow[];
}

interface ClosureLine {
  key: string;
  reason: ClosureReason | '';
  note: string;
  qty: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName: string;
}

function makeLine(qty: number): ClosureLine {
  return { key: Math.random().toString(36).slice(2), reason: '', note: '', qty };
}

export function ProductClosureModal({ open, onClose, productId, productName }: Props) {
  const queryClient = useQueryClient();
  const [vitrineLines, setVitrineLines] = useState<ClosureLine[]>([]);
  const [directLines, setDirectLines] = useState<ClosureLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<Channel, string | null>>({ VITRINE: null, DIRECT: null });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: async () => {
      const res = await apiClient.get<ProductDetail>(`/api/v1/products/${productId}`);
      return res.data;
    },
    enabled: open && !!productId,
  });

  const totalFor = (channel: Channel) =>
    product?.channelStock.filter((c) => c.channel === channel).reduce((sum, c) => sum + Number(c.qtyRemaining), 0) ?? 0;

  const vitrineTotal = totalFor('VITRINE');
  const directTotal = totalFor('DIRECT');

  useEffect(() => {
    if (open && product) {
      setVitrineLines(vitrineTotal > 0 ? [makeLine(vitrineTotal)] : []);
      setDirectLines(directTotal > 0 ? [makeLine(directTotal)] : []);
      setErrors({ VITRINE: null, DIRECT: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const closures = product?.channelStock
    .flatMap((c) => c.closures.map((cl) => ({ ...cl, channel: c.channel })))
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()) ?? [];

  const split = (channel: Channel) => {
    const lines = channel === 'VITRINE' ? vitrineLines : directLines;
    const setLines = channel === 'VITRINE' ? setVitrineLines : setDirectLines;
    setLines([...lines, makeLine(0)]);
  };

  const updateLine = (channel: Channel, key: string, patch: Partial<ClosureLine>) => {
    const setLines = channel === 'VITRINE' ? setVitrineLines : setDirectLines;
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (channel: Channel, key: string) => {
    const setLines = channel === 'VITRINE' ? setVitrineLines : setDirectLines;
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const validateChannel = (channel: Channel, lines: ClosureLine[], total: number): string | null => {
    if (lines.length === 0) return null;
    const sum = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    if (Math.abs(sum - total) > 0.0001) {
      return `La somme (${sum}) doit être exactement égale au stock restant (${total})`;
    }
    for (const l of lines) {
      if (!l.reason) return 'Un motif est requis pour chaque ligne';
      if (l.reason === 'OTHER' && !l.note.trim()) return 'Une note est requise pour le motif "Autre"';
    }
    return null;
  };

  const handleSubmit = async () => {
    const vitrineError = validateChannel('VITRINE', vitrineLines, vitrineTotal);
    const directError = validateChannel('DIRECT', directLines, directTotal);
    setErrors({ VITRINE: vitrineError, DIRECT: directError });
    if (vitrineError || directError) return;

    setSubmitting(true);
    try {
      if (vitrineLines.length > 0) {
        await apiClient.post(`/api/v1/products/${productId}/closure`, {
          channel: 'VITRINE',
          lines: vitrineLines.map((l) => ({ reason: l.reason, note: l.note || undefined, qty: l.qty })),
        });
      }
      if (directLines.length > 0) {
        await apiClient.post(`/api/v1/products/${productId}/closure`, {
          channel: 'DIRECT',
          lines: directLines.map((l) => ({ reason: l.reason, note: l.note || undefined, qty: l.qty })),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['product-detail', productId] });
      toast.success('Journée clôturée');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const renderChannel = (channel: Channel, label: string, lines: ClosureLine[], total: number) => {
    if (total <= 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-erp-sm font-semibold text-choco-600">{label} — {total} restant(s)</p>
          <button onClick={() => split(channel)} className="text-erp-xs text-choco-500 hover:text-choco-600 flex items-center gap-1">
            <Plus size={12} /> Scinder
          </button>
        </div>
        {lines.map((line) => (
          <div key={line.key} className="flex gap-2 items-start">
            <select
              value={line.reason}
              onChange={(e) => updateLine(channel, line.key, { reason: e.target.value as ClosureReason })}
              className="form-input flex-1"
            >
              <option value="">Motif...</option>
              {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              type="number" step="0.01" min="0"
              value={line.qty}
              onChange={(e) => updateLine(channel, line.key, { qty: Number(e.target.value) || 0 })}
              disabled={lines.length === 1}
              className="form-input w-24"
            />
            {lines.length > 1 && (
              <button onClick={() => removeLine(channel, line.key)} className="p-2 text-neutral-400 hover:text-framboise-400">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {lines.some((l) => l.reason === 'OTHER') && (
          <input
            type="text"
            placeholder="Note (obligatoire pour Autre)"
            onChange={(e) => {
              const otherLine = lines.find((l) => l.reason === 'OTHER');
              if (otherLine) updateLine(channel, otherLine.key, { note: e.target.value });
            }}
            className="form-input"
          />
        )}
        {errors[channel] && <p className="text-erp-xs text-framboise-400">{errors[channel]}</p>}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <div>
            <h2 className="text-erp-lg font-semibold text-choco-600">Clôturer la journée</h2>
            <p className="text-erp-xs text-neutral-500 mt-0.5">{productName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="h-24 bg-[var(--line-1)] rounded animate-pulse" />
          ) : vitrineTotal <= 0 && directTotal <= 0 ? (
            <p className="text-erp-sm text-neutral-400 italic">Rien à clôturer aujourd&apos;hui — aucun stock restant.</p>
          ) : (
            <>
              {renderChannel('VITRINE', 'Vitrine', vitrineLines, vitrineTotal)}
              {renderChannel('DIRECT', 'Direct', directLines, directTotal)}
            </>
          )}

          <div>
            <p className="text-erp-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Historique des clôtures</p>
            {closures.length === 0 ? (
              <p className="text-erp-xs text-neutral-400 italic">Aucune clôture enregistrée.</p>
            ) : (
              <div className="space-y-1.5">
                {closures.map((c) => (
                  <div key={c.id} className="text-erp-xs px-3 py-2 rounded border border-[var(--line-1)]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-choco-600">
                        {c.channel === 'VITRINE' ? 'Vitrine' : 'Direct'} — {Number(c.qty)} — {REASON_LABELS[c.reason]}
                      </span>
                      <span className="text-neutral-400">{new Date(c.closedAt).toLocaleDateString('fr-BE')}</span>
                    </div>
                    <p className="text-neutral-500 mt-0.5">
                      Par {c.closedByUser.firstName} {c.closedByUser.lastName}
                      {c.note && ` — ${c.note}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--line-1)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--line-2)] rounded-[var(--rx-input)] text-erp-sm font-medium text-choco-600 hover:bg-[var(--surface-hover)] transition-colors"
          >
            Fermer
          </button>
          {(vitrineTotal > 0 || directTotal > 0) && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Clôturer
            </button>
          )}
        </div>
      </div>
    </>
  );
}
