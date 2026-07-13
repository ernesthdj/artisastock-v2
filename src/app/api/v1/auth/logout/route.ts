import { NextRequest } from 'next/server';
import { revokeSession, extractBearerToken } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return apiError('UNAUTHORIZED', 'Authentification requise', 401);
  }

  await revokeSession(token);
  return apiSuccess({ message: 'Déconnecté avec succès' });
}
