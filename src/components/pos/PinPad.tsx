'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { Delete, X } from 'lucide-react';

interface VerifiedVendeur {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  open: boolean;
  onClose?: () => void;
  onVerified: (vendeur: VerifiedVendeur, pin: string) => void;
  title?: string;
  variant?: 'modal' | 'inline';
}

const PIN_LENGTH = 4;

// Pavé numérique réutilisé par chaque action comptoir sensible (pointage, caisse, vente).
// Identifie le vendeur par le PIN seul (aucune sélection préalable) — voir
// identifyVendeurByPin / docs/modules/POS.md. Aucune session Vendeur n'est stockée ici :
// c'est l'appelant (page Caisse) qui décide de mémoriser {vendeurId, pin} en mémoire pour
// éviter de le redemander pendant "sa vente", conformément à la demande explicite du
// 2026-07-26 (voir JOURNAL) — le serveur revérifie quand même le PIN à chaque action.
export function PinPad({ open, onClose, onVerified, title = 'Qui êtes-vous ?', variant = 'modal' }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: (data: { pin: string }) => apiClient.post<VerifiedVendeur>('/api/v1/pos/vendeurs/verify-pin', data),
    onSuccess: (res, variables) => {
      onVerified(res.data, variables.pin);
      setPin('');
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
      setPin('');
    },
  });

  const pressDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setError(null);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      verifyMutation.mutate({ pin: next });
    }
  };

  if (!open) return null;

  const pad = (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {[...Array(PIN_LENGTH)].map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full border-2 ${i < pin.length ? 'bg-choco-600 border-choco-600' : 'border-[var(--line-2)]'}`}
          />
        ))}
      </div>

      {error && <p className="text-erp-xs text-framboise-400 text-center">{error}</p>}

      <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
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
  );

  if (variant === 'inline') {
    return (
      <div className="space-y-4">
        <p className="text-erp-sm font-medium text-choco-600 text-center">{title}</p>
        {pad}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-0 rounded-[var(--rx-card)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">{title}</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{pad}</div>
      </div>
    </div>
  );
}
