// src/lib/pos/vendeur-auth.ts — Vérification PIN Vendeur, partagée par toutes les actions
// comptoir sensibles (pointage, caisse, vente). Pas de session/jeton Vendeur : chaque action
// exige { vendeurId, pin } et revérifie ici, à chaque fois (décision d'architecture,
// voir docs/modules/POS-IMPLEMENTATION.md) — jamais de confiance aveugle au payload client.

import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type VendeurAuthFailureCode = 'NOT_FOUND' | 'INACTIVE' | 'LOCKED' | 'INVALID_PIN';

export type VendeurAuthResult =
  | { ok: true; vendeur: { id: string; firstName: string; lastName: string } }
  | { ok: false; code: VendeurAuthFailureCode; message: string };

export async function verifyVendeurPin(
  tenantId: string,
  vendeurId: string,
  pin: string
): Promise<VendeurAuthResult> {
  const vendeur = await prisma.vendeur.findFirst({ where: { id: vendeurId, tenantId } });
  if (!vendeur) return { ok: false, code: 'NOT_FOUND', message: 'Vendeur introuvable' };
  if (!vendeur.isActive) return { ok: false, code: 'INACTIVE', message: 'Ce vendeur est désactivé' };

  if (vendeur.lockedUntil && vendeur.lockedUntil > new Date()) {
    return {
      ok: false,
      code: 'LOCKED',
      message: `Verrouillé jusqu'à ${vendeur.lockedUntil.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`,
    };
  }

  const valid = await verifyPassword(pin, vendeur.pinHash);

  if (!valid) {
    const attempts = vendeur.failedPinAttempts + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await prisma.vendeur.update({
      where: { id: vendeur.id },
      data: { failedPinAttempts: attempts, lockedUntil },
    });
    return {
      ok: false,
      code: 'INVALID_PIN',
      message: lockedUntil
        ? `PIN incorrect — verrouillé ${LOCKOUT_MINUTES} minutes`
        : `PIN incorrect (${attempts}/${MAX_ATTEMPTS})`,
    };
  }

  if (vendeur.failedPinAttempts > 0 || vendeur.lockedUntil) {
    await prisma.vendeur.update({
      where: { id: vendeur.id },
      data: { failedPinAttempts: 0, lockedUntil: null },
    });
  }

  return { ok: true, vendeur: { id: vendeur.id, firstName: vendeur.firstName, lastName: vendeur.lastName } };
}
