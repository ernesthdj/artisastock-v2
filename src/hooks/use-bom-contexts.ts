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

// Même queryKey que bom/page.tsx (quand activiteId est omis) : le cache React Query est
// partagé, pas de requête dupliquée.
export function useBomContexts(activiteId?: string) {
  return useQuery<BomContext[]>({
    queryKey: activiteId ? ['bom-contexts', activiteId] : ['bom-contexts'],
    queryFn: async () => {
      const qs = activiteId ? `&activiteId=${activiteId}` : '';
      const res = await apiClient.get<BomContext[]>(`/api/v1/bom/contexts?pageSize=50${qs}`);
      return res.data;
    },
    enabled: activiteId === undefined || !!activiteId,
  });
}
