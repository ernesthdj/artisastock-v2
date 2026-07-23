'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/AuthProvider';

export interface Activite {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { stocks: number; bomContexts?: number };
}

interface ActiviteContextValue {
  activites: Activite[];
  activiteId: string;
  setActiviteId: (id: string) => void;
  activite: Activite | null;
  isLoading: boolean;
}

const ActiviteContext = createContext<ActiviteContextValue | null>(null);

const STORAGE_KEY = 'artisastock:activiteId';

export function ActiviteProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activiteId, setActiviteIdState] = useState('');

  const { data: activites = [], isLoading } = useQuery<Activite[]>({
    queryKey: ['activites-switcher'],
    queryFn: async () => {
      const res = await apiClient.get<Activite[]>('/api/v1/activites?pageSize=100');
      return res.data.filter((a) => a.isActive);
    },
    enabled: !!user,
  });

  const setActiviteId = useCallback((id: string) => {
    setActiviteIdState(id);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  // Restaure la sélection persistée au montage.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) setActiviteIdState(stored);
  }, []);

  // Si aucune sélection valide (première visite, activité supprimée/désactivée), retombe sur la première disponible.
  useEffect(() => {
    if (isLoading || activites.length === 0) return;
    const stillValid = activites.some((a) => a.id === activiteId);
    if (!activiteId || !stillValid) {
      setActiviteId(activites[0].id);
    }
  }, [isLoading, activites, activiteId, setActiviteId]);

  const activite = activites.find((a) => a.id === activiteId) ?? null;

  return (
    <ActiviteContext.Provider value={{ activites, activiteId, setActiviteId, activite, isLoading }}>
      {children}
    </ActiviteContext.Provider>
  );
}

export function useActivite() {
  const ctx = useContext(ActiviteContext);
  if (!ctx) throw new Error('useActivite must be used within ActiviteProvider');
  return ctx;
}
