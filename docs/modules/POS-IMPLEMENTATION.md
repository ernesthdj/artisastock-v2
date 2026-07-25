# Plan d'implémentation — Module POS

> mentalyas · Full-Stack Dev
> Date : 2026-07-25
> Statut : Document d'organisation — étape 3 de la cascade de brainstorms (voir `CLAUDE.md` § Méthodologie de conception)
> Sources : `docs/FONDATION-HORECA.md` (macro), `docs/modules/POS.md` (brainstorm module, UC1-UC12 + workflow Mermaid), `prisma/schema.prisma` (vérifié directement)

Ce document découpe l'implémentation du module POS en étapes séquentielles testables dans le navigateur, dans l'ordre du workflow défini au brainstorm (§4 et §8 de `POS.md`) : identité d'abord, puis caisse, puis vente, puis pointage/consultation admin.

---

## Décision d'architecture — authentification Vendeur (tranchée avant le code, pas un détail d'implémentation)

`Vendeur` est distinct de `User` (décidé au brainstorm). Le PIN n'est **pas** un remplacement du JWT admin : l'appareil comptoir reste connecté via le JWT admin existant (un membre du personnel, ou le patron, ouvre la tablette une fois avec son compte `User`). Le PIN identifie **quel Vendeur** effectue l'action courante.

Conséquence directe sur la sécurité (déjà écrite dans `POS.md` §7 hérité de `FONDATION-POS.md` : *"jamais confiance aveugle au payload client"*) : **aucune notion de session/jeton Vendeur** n'est introduite. Chaque action sensible (pointage, ouverture/fermeture de caisse, vente) exige `{ vendeurId, pin }` dans le payload et le serveur revérifie le PIN à chaque fois — pas de "déverrouillage" qui resterait valide sans re-saisie. Plus simple qu'un système de token séparé, et ça élimine complètement le risque d'un vendeur oublié "connecté" sur la tablette.

Verrouillage anti-brute-force (`Vendeur.failedPinAttempts`/`lockedUntil`, déjà au schéma) : incrémenté à chaque échec, remis à zéro à chaque succès, verrouillage temporaire au-delà d'un seuil.

---

## Résumé des étapes

| # | Objectif court | UC couverts |
|---|---|---|
| 1 | Schéma Prisma (`Vendeur`, `SessionCaisse`, `PointageHoraire`, `PosSale`, `PosSaleItem`) + permissions | Prérequis |
| 2 | Gestion des vendeurs (admin) + vérification PIN | UC1, UC11 |
| 3 | Session de caisse : ouverture/fermeture + écart | UC3, UC7 |
| 4 | Pointage horaire | UC2, UC8 |
| 5 | Écran de vente POS : produits + stock DIRECT + composition | UC4 |
| 6 | Finalisation vente : décrément DIRECT + blocage insuffisant | UC5, UC6 |
| 7 | Écrans admin de consultation (ventes, écarts, pointages) | UC9, UC10, UC12 |

---

## Étape 1 — Schéma Prisma + permissions

**Fichiers concernés** :
- `prisma/schema.prisma` — `Vendeur`, `SessionCaisse` (+ enum `SessionCaisseStatus`), `PointageHoraire`, `PosSale` (+ enum `PosPaymentMethod`), `PosSaleItem` ; back-relations sur `Tenant` et `Product`
- `prisma/seed.ts` — ajouter les nouvelles permissions à `ALL_PERMISSIONS`, éventuellement 1-2 vendeurs de démo
- `src/lib/constants/permissions.ts` — `pos.sell` (actions comptoir : vente/pointage/caisse, portée par l'appareil déjà authentifié), `pos.read` (consultation ventes/écarts/pointages), `pos.manage` (CRUD vendeurs)

**Definition of Done** :
- `npx prisma db push` appliqué sans erreur.
- Nouvelles permissions présentes à la fois dans `ALL_PERMISSIONS` (seed) et le type `Permission` (déjà vu deux fois comme piège dans ce projet — étapes 7 et 11 de Boutique/Produits).

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : aucun. `db push` appliqué sans reset (pas de risque de duplication — tables neuves, pas de `create()` non conditionnel touché). `pos.sell`/`pos.read`/`pos.manage` ajoutées aux deux endroits requis (`permissions.ts` + `ALL_PERMISSIONS` du seed) via un script ciblé, sans réexécuter `prisma/seed.ts` en entier (règle du projet — voir JOURNAL).

---

## Étape 2 — Gestion des vendeurs + vérification PIN

**Fichiers concernés** :
- `src/lib/validators/vendeur.ts` *(nouveau)* — schéma création (`firstName`, `lastName`, `pin` 4-6 chiffres) / mise à jour (`isActive`, reset PIN)
- `src/app/api/v1/pos/vendeurs/route.ts` *(nouveau)* — `GET` liste / `POST` création (hash PIN via bcrypt, comme `User.passwordHash`)
- `src/app/api/v1/pos/vendeurs/[id]/route.ts` *(nouveau)* — `PATCH` (activer/désactiver, reset PIN)
- `src/app/api/v1/pos/vendeurs/verify-pin/route.ts` *(nouveau)* — `POST { pin }`, cherche parmi les vendeurs actifs du tenant, incrémente/reset `failedPinAttempts`, verrouille après N échecs (ex. 5), renvoie le vendeur si succès — **ne renvoie jamais de token, juste l'identité vérifiée pour l'écran courant**
- `src/components/pos/VendeurManager.tsx` / page admin *(nouveau)* — CRUD vendeurs
- `src/components/pos/PinPad.tsx` *(nouveau)* — pavé numérique réutilisable (déclenche `verify-pin`), utilisé à chaque action sensible des étapes suivantes, pas seulement à l'écran d'accueil

**Test navigateur** :
1. Créer un vendeur avec PIN depuis l'admin.
2. Vérifier le PIN via le pavé → identité renvoyée.
3. PIN erroné 5 fois → verrouillage temporaire, message clair.
4. Vendeur désactivé → PIN refusé même correct.

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : le plan prévoyait un PIN de 4 à 6 chiffres — fixé à **4 chiffres exactement** à l'implémentation (validateur, `PinPad`, `VendeurSheet`), plus simple pour un pavé tactile comptoir et ça élimine une classe de bug de longueur variable (voir bug ci-dessous). `VendeurManager.tsx` du plan est devenu `VendeurSheet.tsx` (mode dual création/reset-PIN dans le même composant, plus proche du pattern Sheet déjà utilisé partout ailleurs dans le projet).

**Bugs trouvés et corrigés pendant le test navigateur** :
1. **Pavé PIN à longueur variable** : la garde de soumission autorisait 4-6 chiffres mais l'auto-vérification ne se déclenchait qu'à exactement 4 — cassé pour tout PIN à 5-6 chiffres, et la garde `pin.length >= PIN_LENGTH` (au lieu de `>`) était nécessaire pour éliminer tout risque de double-soumission. Corrigé en fixant le PIN à 4 chiffres partout et en durcissant la garde.
2. **Collision de code HTTP 401 (critique)** : `verify-pin` renvoyait 401 pour un PIN erroné, ce qui collisionnait avec l'intercepteur global de `apiClient` (401 → refresh JWT silencieux + retry automatique) — chaque mauvais PIN était rejoué une seconde fois côté client, doublant `failedPinAttempts` à chaque échec. Diagnostiqué via `read_network_requests` (2 requêtes réelles pour 1 tentative logique), confirmé reproductible même avec des clics lents (excluant une race condition). Corrigé en passant `INVALID_PIN`/`LOCKED`/`INACTIVE` en 400 (404 conservé pour `NOT_FOUND`), avec commentaire dans le code expliquant pourquoi 401 est réservé à l'expiration JWT réelle.

**Tests réels effectués** :
- PIN erroné une fois → "PIN incorrect (1/5)", une seule requête réseau, compteur DB à 1 (pas 2).
- PIN correct → "Identité vérifiée : Marie Dubois", compteur remis à 0.
- Verrouillage après 5 échecs testé directement via `verifyVendeurPin()` (script) : la 5e tentative verrouille 15 min, la 6e (même avec le bon PIN) est rejetée tant que verrouillée.
- Toggle actif/inactif testé dans le navigateur (`/fr/pos/vendeurs`) : désactivation → Pill "⏸ Désactivé" + toast, vendeur disparaît du picker du `PinPad` (liste `activeOnly=true`, "Aucun vendeur actif." affiché) ; réactivation → redevient sélectionnable.

---

## Étape 3 — Session de caisse

**Fichiers concernés** :
- `src/lib/validators/session-caisse.ts` *(nouveau)*
- `src/app/api/v1/pos/caisse/open/route.ts` *(nouveau)* — `POST { vendeurId, pin, openingFloat }`
- `src/app/api/v1/pos/caisse/[id]/close/route.ts` *(nouveau)* — `POST { vendeurId, pin, closingFloat }` → calcule `variance = closingFloat - (openingFloat + somme des ventes cash de la session)`
- `src/app/api/v1/pos/caisse/route.ts` *(nouveau)* — `GET` session ouverte courante (par vendeur/poste)
- UI comptoir : écran d'ouverture/fermeture de caisse

**Test navigateur** :
1. Ouvrir une caisse avec un fond déclaré → session `OPEN`.
2. Fermer avec un fond différent du fond attendu → écart calculé et affiché, pas juste stocké silencieusement.
3. Impossible de vendre sans caisse ouverte (vérifié à l'étape 6).

**Statut : ✅ Terminée le 2026-07-26.**

**Écart d'exécution constaté** : aucun sur les routes. Composant `VendeurPicker.tsx` extrait de `PinPad.tsx` (utilisé maintenant par `PinPad` et par la page `/pos/caisse`) — factorisation justifiée dès la deuxième utilisation, pas anticipée. La page `/pos/caisse` ne réutilise pas `PinPad` tel quel : chaque action sensible (ouvrir/fermer) combine PIN **et** montant dans un seul formulaire soumis en une fois à la route dédiée (qui revérifie le PIN elle-même), pour éviter de faire saisir le PIN deux fois de suite (identité puis action).

**Bug trouvé et corrigé (critique, hors du périmètre POS) — `apiClient` avalait les réponses `data: null` légitimes :** `GET /api/v1/pos/caisse?vendeurId=...` (aucune session ouverte) renvoyait bien `{success:true, data:null}` côté serveur, mais l'écran affichait "Caisse ouverte depuis Invalid Date · fond NaN€" au lieu du formulaire d'ouverture. Cause racine dans `src/lib/api-client.ts` : `data: json?.data ?? json` — l'opérateur `??` se déclenche aussi sur `null` (pas seulement `undefined`), donc dès que `data` valait explicitement `null`, le code retombait sur l'enveloppe complète `{success, data, ...}` au lieu de `null`, et le composant traitait cet objet (toujours "truthy") comme une session ouverte valide. Aucun endpoint du projet n'avait jusqu'ici renvoyé un `data: null` légitime en cas de succès — ce bug dormait depuis la création du client. Diagnostiqué en comparant un appel `fetch` direct en console (`{"success":true,"data":null}`) au rendu erroné de l'écran. Corrigé en ne retombant sur l'enveloppe que si `data` est réellement absent de la réponse (`'data' in json`), jamais quand elle vaut `null`.
**Règle apprise :** ne jamais utiliser `??`/`?.` pour distinguer "propriété absente" de "propriété présente valant `null`" — ces opérateurs traitent les deux cas identiquement. Utiliser `'clé' in obj` ou `Object.hasOwn` quand `null` est une valeur de succès légitime, pas une absence de valeur.

**Tests réels effectués (navigateur + appels API directs pour les cas non atteignables via l'UI seule) :**
- Ouverture (fond 100€) → `● Caisse ouverte depuis HH:MM · fond 100.00€`.
- Fermeture avec fond déclaré 95€ (aucune vente encore, donc attendu = 100€) → `Écart : -5.00€` (Pill rouge), affiché après fermeture.
- Réouverture après fermeture (fond 50€) → nouvelle session `OPEN` créée normalement pour le même vendeur.
- Double-ouverture (vendeur déjà en session `OPEN`) → `400 ALREADY_OPEN`, testé par appel direct.
- Fermeture d'une session par un **autre** vendeur que celui à qui elle appartient (PIN de l'autre vendeur correct) → `403 FORBIDDEN`, testé par appel direct.
- Fermeture d'une session déjà `CLOSED` → `400 ALREADY_CLOSED`.
- Fermeture d'un id de session inexistant → `404 NOT_FOUND`.
- PIN erroné sur `/open` → `400 INVALID_PIN` (jamais 401, même règle qu'à l'étape 2).
- Écart nul confirmé : fond de fermeture égal au fond d'ouverture (aucune vente) → `Écart : 0.00€`.
- Nettoyage : un vendeur de test "Ernest Hadjiu" (reliquat non intentionnel d'un script de test de la session précédente) et sa session de caisse ont été supprimés après usage, sur confirmation explicite de l'utilisateur.

---

## Étape 4 — Pointage horaire

**Fichiers concernés** :
- `src/app/api/v1/pos/vendeurs/[id]/clock-in/route.ts` / `clock-out/route.ts` *(nouveau)*
- UI comptoir : bouton pointage lié au PIN

**Test navigateur** :
1. Pointer l'arrivée → horodatage créé.
2. Pointer le départ → `clockOut` renseigné sur le même enregistrement, pas un nouveau.

---

## Étape 5 — Écran de vente : produits + stock DIRECT

**Fichiers concernés** :
- `src/app/api/v1/pos/products/route.ts` *(nouveau)* — liste des `Product` actifs avec leur stock `DIRECT` restant agrégé (même pattern que `vitrineQtyRemaining`, étape 9 de Boutique/Produits, appliqué au canal `DIRECT`)
- `src/app/[locale]/(dashboard)/pos/page.tsx` ou route dédiée hors du layout admin habituel *(nouveau — à trancher à l'implémentation selon l'ergonomie tactile réelle, cf. `POS.md` "Responsive universel : tablette, dalle tactile"* )
- Composition de vente en mémoire côté client (panier comptoir), pas encore de décrément (étape 6)

**Test navigateur** :
1. Écran affiche les produits avec leur stock `DIRECT` réel.
2. Produit à 0 en `DIRECT` grisé/indisponible à la sélection, cohérent avec le storefront (étape 9 Boutique/Produits).

---

## Étape 6 — Finalisation de la vente

**Fichiers concernés** :
- `src/app/api/v1/pos/sales/route.ts` *(nouveau)* — `POST { vendeurId, pin, sessionCaisseId, paymentMethod, items }` : vérifie caisse `OPEN` pour ce vendeur, décrémente `ProductChannelStock` canal `DIRECT` via `consumeChannelStockOrFlagConflict` (réutilisé tel quel, juste le paramètre `channel`), crée `PosSale`/`PosSaleItem` dans la même transaction — **rejet direct (400) si stock insuffisant, pas de statut `STOCK_CONFLICT`** (aucun paiement externe déjà capturé contrairement au webhook Stripe, donc pas de commande fantôme à gérer après coup)

**Test navigateur** :
1. Vente avec stock suffisant → succès, `ProductChannelStock` `DIRECT` décrémenté, ticket visible dans l'historique (étape 7).
2. Vente avec stock insuffisant → rejetée avec message clair, aucune écriture partielle.
3. Vente tentée sans caisse ouverte → rejetée.

---

## Étape 7 — Écrans admin de consultation

**Fichiers concernés** :
- `src/app/api/v1/pos/sales/route.ts` (`GET`, déjà créé étape 6, ajouter le filtrage vendeur/session/date)
- `src/app/api/v1/pos/caisse-sessions/route.ts` *(nouveau)* — liste avec écarts
- `src/app/api/v1/pos/pointages/route.ts` *(nouveau)* — RBAC : un Vendeur ne verrait que les siens si jamais un accès direct Vendeur existait ; pour l'instant ces écrans sont admin uniquement (`pos.read`)
- Pages admin : historique ventes, écarts de caisse, pointages

**Test navigateur** :
1. Historique des ventes visible avec vendeur/montant/mode de paiement par ticket.
2. Écarts de caisse listés par session.
3. Pointages de l'équipe consultables.

---

## Hors scope (rappel, cf. `POS.md` §7)

Mode hors-ligne, intégration terminal de paiement réel, impression de tickets, configuration sectorielle par flags, lien direct vers un futur module RH, TVA par canal — tous explicitement différés.
