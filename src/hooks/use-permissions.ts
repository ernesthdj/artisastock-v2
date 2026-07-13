'use client';

import { useAuth } from '@/providers/AuthProvider';

export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.role?.permissions ?? [];

  const can = (permission: string): boolean => permissions.includes(permission);
  const canAny = (...perms: string[]): boolean => perms.some((p) => permissions.includes(p));
  const canAll = (...perms: string[]): boolean => perms.every((p) => permissions.includes(p));
  const isAdmin = (): boolean => user?.role?.name === 'Admin';

  return { can, canAny, canAll, isAdmin, permissions };
}
