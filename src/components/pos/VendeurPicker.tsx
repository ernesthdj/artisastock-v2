'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface VendeurOption {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Grille de sélection vendeur réutilisée par PinPad et par les écrans comptoir (caisse, vente,
// pointage) — un seul point pour la query 'pos-vendeurs-picker' (vendeurs actifs uniquement).
export function VendeurPicker({ selectedId, onSelect }: Props) {
  const { data: vendeurs } = useQuery({
    queryKey: ['pos-vendeurs-picker'],
    queryFn: async () => {
      const res = await apiClient.get<VendeurOption[]>('/api/v1/pos/vendeurs?activeOnly=true&pageSize=100');
      return res.data;
    },
  });

  return (
    <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
      {vendeurs?.length === 0 && (
        <p className="col-span-2 text-erp-sm text-neutral-400 italic text-center py-6">Aucun vendeur actif.</p>
      )}
      {vendeurs?.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelect(v.id)}
          className={`flex flex-col items-center gap-1.5 p-4 rounded-[var(--rx-input)] border transition-colors ${
            selectedId === v.id
              ? 'border-choco-600 bg-[var(--surface-hover)]'
              : 'border-[var(--line-2)] hover:bg-[var(--surface-hover)] hover:border-choco-600'
          }`}
        >
          <span className="w-10 h-10 rounded-full bg-choco-600 text-[#FCF8EF] flex items-center justify-center text-erp-sm font-semibold">
            {v.firstName[0]}{v.lastName[0]}
          </span>
          <span className="text-erp-sm font-medium text-choco-600">{v.firstName}</span>
        </button>
      ))}
    </div>
  );
}
