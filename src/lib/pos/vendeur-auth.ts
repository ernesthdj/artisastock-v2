// src/lib/pos/vendeur-auth.ts — Vérification PIN Vendeur, partagée par toutes les actions
// comptoir sensibles (pointage, caisse, vente). Pas de session/jeton Vendeur : chaque action
// exige { vendeurId, pin } et revérifie ici, à chaque fois (décision d'architecture,
// voir docs/modules/POS-IMPLEMENTATION.md) — jamais de confiance aveugle au payload client.

import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Unicité du PIN par tenant — pinHash est un bcrypt salé (deux PINs identiques produisent
// des hash différents), donc impossible à garantir par contrainte DB : on doit comparer le
// PIN candidat à chaque vendeur existant, même approche que identifyVendeurByPin ci-dessous.
// Vérifié contre TOUS les vendeurs (actifs et désactivés), pas seulement les actifs, pour
// éviter qu'une réactivation future ne fasse resurgir une collision silencieuse.
export async function isPinTaken(tenantId: string, pin: string, excludeVendeurId?: string): Promise<boolean> {
  const vendeurs = await prisma.vendeur.findMany({
    where: { tenantId, ...(excludeVendeurId ? { id: { not: excludeVendeurId } } : {}) },
    select: { pinHash: true },
  });
  for (const v of vendeurs) {
    if (await verifyPassword(pin, v.pinHash)) return true;
  }
  return false;
}

export type VendeurAuthFailureCode = 'NOT_FOUND' | 'INACTIVE' | 'LOCKED' | 'INVALID_PIN';

export type VendeurAuthResult =
  | { ok: true; vendeur: { id: string; firstName: string; lastName: string } }
  | { ok: false; code: VendeurAuthFailureCode; message: string };

// Identifie le vendeur à partir du seul PIN (pavé numérique comptoir, sans sélection
// préalable) — compare le PIN à chaque vendeur actif du tenant jusqu'à trouver une
// correspondance. Compromis assumé (demandé explicitement, cf. docs/modules/POS.md) :
// le verrouillage anti-brute-force reste par-vendeur (voir verifyVendeurPin), donc un PIN
// qui ne correspond à aucun vendeur actif n'incrémente aucun compteur — on ne sait pas
// quel vendeur ciblait la tentative. Acceptable pour un boîtier comptoir à faible nombre
// de vendeurs ; à revoir (ex. throttle global par tenant) si l'usage réel le justifie.
export async function identifyVendeurByPin(tenantId: string, pin: string): Promise<VendeurAuthResult> {
  const vendeurs = await prisma.vendeur.findMany({ where: { tenantId, isActive: true } });

  for (const vendeur of vendeurs) {
    if (vendeur.lockedUntil && vendeur.lockedUntil > new Date()) continue;
    const valid = await verifyPassword(pin, vendeur.pinHash);
    if (valid) {
      if (vendeur.failedPinAttempts > 0) {
        await prisma.vendeur.update({ where: { id: vendeur.id }, data: { failedPinAttempts: 0, lockedUntil: null } });
      }
      return { ok: true, vendeur: { id: vendeur.id, firstName: vendeur.firstName, lastName: vendeur.lastName } };
    }
  }

  return { ok: false, code: 'INVALID_PIN', message: 'PIN incorrect' };
}

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
