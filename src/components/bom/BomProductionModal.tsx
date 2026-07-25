'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';

interface AvailabilityLine {
  lineId: string;
  label: string;
  required: number;
  unit: string;
  availableInUnit: number;
  sufficient: boolean;
}

interface AvailabilityResult {
  lines: AvailabilityLine[];
  allSufficient: boolean;
}

interface CostResult {
  totalCost: number;
  unitCost: number;
  outputQty: number;
  outputUnit: string;
}

interface SimulateResult {
  nBatches: number;
  cost: CostResult;
  availability: AvailabilityResult;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sheetId: string;
  sheetName: string;
}

export function BomProductionModal({ open, onClose, sheetId, sheetName }: Props) {
  const queryClient = useQueryClient();
  const [nBatches, setNBatches] = useState(1);
  const [notes, setNotes] = useState('');

  // /cost renvoie uniquement le coût — /simulate combine coût + disponibilité (checkAvailability)
  // dans un seul appel, seule route qui retourne réellement { lines, allSufficient }.
  const { data: simulation, isLoading: loadingAvail } = useQuery<SimulateResult>({
    queryKey: ['bom-simulate-prod', sheetId, nBatches],
    queryFn: async () => {
      const res = await apiClient.get<SimulateResult>(`/api/v1/bom/sheets/${sheetId}/simulate?nBatches=${nBatches}`)
      return res.data
    },
    enabled: open && nBatches > 0,
  });

  const availability = simulation?.availability;
  const cost = simulation?.cost;

  const produceMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/bom/sheets/${sheetId}/produce`, { nBatches, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast.success('Production lancée avec succès');
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Erreur lors de la production');
      }
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#1a0f0a] rounded-xl shadow-2xl border border-amber-200 dark:border-amber-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20">
          <div>
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Lancer une production</h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{sheetName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30">
            <X size={20} className="text-amber-700 dark:text-amber-300" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Nb batches */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Nombre de lots
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={nBatches}
              onChange={(e) => setNBatches(parseFloat(e.target.value) || 1)}
              className="px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Coût estimé */}
          {cost && (
            <div className="flex items-center justify-between px-4 py-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <span className="text-sm text-amber-700 dark:text-amber-300">Coût estimé</span>
              <span className="font-bold text-amber-900 dark:text-amber-100">{formatPrice(cost.totalCost)}</span>
            </div>
          )}

          {/* Disponibilité */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              Disponibilité des ingrédients
            </p>
            {loadingAvail ? (
              <div className="flex items-center gap-2 text-amber-500 text-sm py-2">
                <Loader2 size={14} className="animate-spin" />
                Vérification...
              </div>
            ) : (
              <div className="space-y-1">
                {availability?.lines.map((line) => (
                  <div
                    key={line.lineId}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded border border-amber-100 dark:border-amber-900/40"
                  >
                    <div className="flex items-center gap-2">
                      {line.sufficient ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <XCircle size={14} className="text-red-500" />
                      )}
                      <span className="text-amber-900 dark:text-amber-100">{line.label}</span>
                    </div>
                    <span className={`text-xs ${line.sufficient ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {line.required.toFixed(2)} / {line.availableInUnit.toFixed(2)} {line.unit.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-amber-900/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => produceMutation.mutate()}
            disabled={!availability?.allSufficient || produceMutation.isPending}
            className="flex-1 py-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {produceMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Production en cours...
              </span>
            ) : (
              'Lancer la production'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
