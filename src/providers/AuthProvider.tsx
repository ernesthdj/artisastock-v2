'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await apiClient.get<AuthUser>('/api/v1/auth/me');
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const res = await apiClient.post<{ accessToken: string; refreshToken: string }>(
      '/api/v1/auth/login',
      { email, password, rememberMe }
    );
    localStorage.setItem('access_token', res.data.accessToken);
    localStorage.setItem('refresh_token', res.data.refreshToken);
    await fetchMe();
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/v1/auth/logout', {});
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
