import { NextRequest } from 'next/server';
import { rotateRefreshToken } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
  }

  const { refreshToken } = body as { refreshToken?: string };
  if (!refreshToken) {
    return apiError('MISSING_TOKEN', 'refreshToken requis', 400);
  }

  const tokens = await rotateRefreshToken(refreshToken);
  if (!tokens) {
    return apiError('TOKEN_INVALID', 'Refresh token invalide ou expiré', 401);
  }

  return apiSuccess(tokens);
}
