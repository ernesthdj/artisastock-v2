// POST /api/v1/pos/vendeurs/verify-pin — Vérifie l'identité d'un vendeur au comptoir (UC1)
// Ne renvoie jamais de jeton — juste l'identité vérifiée pour l'écran courant. Réutilisé
// (côté serveur) par chaque action sensible qui suit (pointage, caisse, vente).

import { NextRequest } from 'next/server';
import { withPermission, apiSuccess, apiError } from '@/lib/permissions';
import { verifyPinSchema } from '@/lib/validators/vendeur';
import { verifyVendeurPin, identifyVendeurByPin } from '@/lib/pos/vendeur-auth';

export async function POST(request: NextRequest) {
  return withPermission(request, 'pos.sell', async (ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch {
      return apiError('INVALID_JSON', 'Corps de requête invalide', 400);
    }

    const parsed = verifyPinSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Données invalides', 400, parsed.error.issues);
    }

    const result = parsed.data.vendeurId
      ? await verifyVendeurPin(ctx.tenantId, parsed.data.vendeurId, parsed.data.pin)
      : await identifyVendeurByPin(ctx.tenantId, parsed.data.pin);
    if (!result.ok) {
      // Jamais 401 ici : c'est réservé par apiClient à l'expiration du JWT (retry automatique
      // silencieux) — un 401 sur un mauvais PIN déclencherait un second essai côté client,
      // doublant chaque échec dans failedPinAttempts (bug trouvé et corrigé en testant).
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return apiError(result.code, result.message, status);
    }

    return apiSuccess(result.vendeur);
  });
}
