'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { Delete, X } from 'lucide-react';

interface VendeurOption {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface VerifiedVendeur {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: (vendeur: VerifiedVendeur) => void;
  title?: string;
}

// Pavé numérique réutilisé par chaque action comptoir sensible (pointage, caisse, vente) —
// aucune notion de session Vendeur : on redemande le PIN à chaque fois (voir
// docs/modules/POS-IMPLEMENTATION.md § décision d'architecture).
export function PinPad({ open, onClose, onVerified, title = 'Qui êtes-vous ?' }: Props) {
  const [selectedVendeurId, setSelectedVendeurId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: vendeurs } = useQuery({
    queryKey: ['pos-vendeurs-picker'],
    queryFn: async () => {
      const res = await apiClient.get<VendeurOption[]>('/api/v1/pos/vendeurs?activeOnly=true&pageSize=100');
      return res.data;
    },
    enabled: open,
  });

  const verifyMutation = useMutation({
    mutationFn: (data: { vendeurId: string; pin: string }) =>
      apiClient.post<VerifiedVendeur>('/api/v1/pos/vendeurs/verify-pin', data),
    onSuccess: (res) => {
      onVerified(res.data);
      reset();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
      setPin('');
    },
  });

  const reset = () => {
    setSelectedVendeurId(null);
    setPin('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const PIN_LENGTH = 4;

  const pressDigit = (d: string) => {
    // Garde stricte à pin.length >= PIN_LENGTH (pas >=) : une fois les 4 chiffres saisis,
    // plus aucune frappe n'est acceptée tant que la vérification n'a pas répondu — élimine
    // tout risque de double-soumission si des clics arrivent plus vite que le re-render.
    if (!selectedVendeurId || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setError(null);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      verifyMutation.mutate({ vendeurId: selectedVendeurId, pin: next });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-0 rounded-[var(--rx-card)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">{title}</h2>
          <button onClick={handleClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        {!selectedVendeurId ? (
          <div className="p-5 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {vendeurs?.length === 0 && (
              <p className="col-span-2 text-erp-sm text-neutral-400 italic text-center py-6">Aucun vendeur actif.</p>
            )}
            {vendeurs?.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVendeurId(v.id)}
                className="flex flex-col items-center gap-1.5 p-4 rounded-[var(--rx-input)] border border-[var(--line-2)] hover:bg-[var(--surface-hover)] hover:border-choco-600 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-choco-600 text-[#FCF8EF] flex items-center justify-center text-erp-sm font-semibold">
                  {v.firstName[0]}{v.lastName[0]}
                </span>
                <span className="text-erp-sm font-medium text-choco-600">{v.firstName}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <button onClick={reset} className="text-erp-xs text-choco-500 hover:text-choco-600">← Changer de vendeur</button>

            <div className="flex justify-center gap-2">
              {[...Array(PIN_LENGTH)].map((_, i) => (
                <span
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 ${i < pin.length ? 'bg-choco-600 border-choco-600' : 'border-[var(--line-2)]'}`}
                />
              ))}
            </div>

            {error && <p className="text-erp-xs text-framboise-400 text-center">{error}</p>}

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  disabled={verifyMutation.isPending}
                  className="h-14 rounded-[var(--rx-input)] border border-[var(--line-2)] text-erp-lg font-semibold text-choco-600 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                >
                  {d}
                </button>
              ))}
              <div />
              <button
                onClick={() => pressDigit('0')}
                disabled={verifyMutation.isPending}
                className="h-14 rounded-[var(--rx-input)] border border-[var(--line-2)] text-erp-lg font-semibold text-choco-600 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={() => setPin(pin.slice(0, -1))}
                disabled={verifyMutation.isPending || pin.length === 0}
                className="h-14 rounded-[var(--rx-input)] border border-[var(--line-2)] flex items-center justify-center text-choco-600 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
              >
                <Delete size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
