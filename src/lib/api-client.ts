/**
 * Client HTTP léger pour les appels API internes.
 * Injecte automatiquement le Bearer token depuis localStorage.
 * Gère le refresh token silencieux (401).
 */

const BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL ?? '');

class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true
): Promise<{ data: T; status: number; meta?: PaginationMeta }> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Token expiré — tenter refresh
  if (res.status === 401 && retry) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        localStorage.setItem('access_token', refreshData.data.accessToken);
        localStorage.setItem('refresh_token', refreshData.data.refreshToken);
        return request<T>(method, path, body, false);
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = `/${window.location.pathname.split('/')[1]}/login`;
      }
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.message ?? 'Une erreur est survenue',
      res.status,
      json?.error?.details
    );
  }

  // Ne jamais retomber sur l'enveloppe complète quand `data` est explicitement `null` —
  // `json?.data ?? json` renvoyait l'enveloppe {success,data:null} au lieu de `null`,
  // cassant tout endpoint dont l'absence de ressource est un `null` légitime (ex. pas de
  // session de caisse ouverte), bug trouvé en testant POS étape 3.
  const data = json !== null && typeof json === 'object' && 'data' in json ? json.data : json;
  return { data, meta: json?.meta, status: res.status };
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { ApiError };
