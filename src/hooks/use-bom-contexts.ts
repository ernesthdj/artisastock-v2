'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface BomContext {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { levels: number };
}

// Même queryKey que bom/page.tsx : le cache React Query est partagé, pas de requête dupliquée.
export function useBomContexts() {
  return useQuery<BomContext[]>({
    queryKey: ['bom-contexts'],
    queryFn: async () => {
      const res = await apiClient.get<BomContext[]>('/api/v1/bom/contexts?pageSize=50');
      return res.data;
    },
  });
}
