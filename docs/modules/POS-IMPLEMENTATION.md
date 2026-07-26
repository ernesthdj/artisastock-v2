# Plan d'implémentation — Module POS

> mentalyas · Full-Stack Dev
> Date : 2026-07-25
> Statut : Document d'organisation — étape 3 de la cascade de brainstorms (voir `CLAUDE.md` § Méthodologie de conception)
> Sources : `docs/FONDATION-HORECA.md` (macro), `docs/modules/POS.md` (brainstorm module, UC1-UC12 + workflow Mermaid), `prisma/schema.prisma` (vérifié directement)

Ce document découpe l'implémentation du module POS en étapes séquentielles testables dans le navigateur, dans l'ordre du workflow défini au brainstorm (§4 et §8 de `POS.md`) : identité d'abord, puis caisse, puis vente, puis pointage/consultation admin.

---

## Décision d'architecture — authentification Vendeur (tranchée avant le code, pas un détail d'implémentation)

`Vendeur` est distinct de `User` (décidé au brainstorm). Le PIN n'est **pas** un remplacement du JWT admin : l'appareil comptoir reste connecté via le JWT admin existant (un membre du personnel, ou le patron, ouvre la tablette une fois avec son compte `User`). Le PIN identifie **quel Vendeur** effectue l'action courante.

Conséquence directe sur la sécurité (déjà écrite dans `POS.md` §7 hérité de `FONDATION-POS.md` : *"jamais confiance aveugle au payload client"*) : chaque action sensible (pointage, ouverture/fermeture de caisse, vente) exige `{ vendeurId, pin }` dans le payload et **le serveur revérifie le PIN à chaque fois** — ce principe reste inchangé après la refonte ci-dessous, seule l'expérience UI change (voir §9).

Verrouillage anti-brute-force (`Vendeur.failedPinAttempts`/`lockedUntil`, déjà au schéma) : incrémenté à chaque échec, remis à zéro à chaque succès, verrouillage temporaire au-delà d'un seuil.

### Révision du 2026-07-26 — retour utilisateur après usage réel

Après avoir testé les étapes 2-6 en conditions réelles (un seul vendeur actif au comptoir), l'utilisateur a demandé une refonte UX : *"il y a trop d'étapes séparées avant de pointer des ventes qui cassent le workflow"*. Deux changements, actés explicitement (pas une simplification silencieuse) :

1. **Identification par PIN seul, sans sélection préalable du vendeur** — le pavé numérique est désormais le point d'entrée par défaut de la Caisse ; le PIN identifie qui l'a tapé (`identifyVendeurByPin`, compare contre tous les vendeurs actifs du tenant). **Compromis de sécurité assumé** : le verrouillage anti-brute-force reste par-vendeur, mais un PIN qui ne correspond à aucun vendeur actif n'incrémente aucun compteur (on ne sait pas qui ciblait la tentative) — acceptable pour un comptoir à faible nombre de vendeurs, à revoir (throttle global par tenant) si l'usage réel le justifie.
2. **"Déverrouillage" pour la durée d'une vente** — une fois le PIN vérifié, le vendeur reste identifié côté client (`{vendeurId, pin}` en mémoire React, jamais persisté) le temps de composer et finaliser **une** vente, sans redemander le code à chaque étape (ouverture de caisse si besoin, ajout au panier, finalisation). Le serveur, lui, **continue de revérifier le PIN à chaque requête** — rien ne change côté sécurité serveur, seul le nombre de fois où l'humain retape son code diminue. Dès la vente finalisée (ou fermeture de caisse), le POS revient automatiquement au pad numérique — pas de "session" qui persiste au-delà.

**Conséquence sur la structure des pages** : `/pos/vente` et `/pos/pointage` sont supprimées, tout est consolidé dans `/pos/caisse` (pad → identification → vente/ouverture-fermeture caisse, + un accès direct "Début/Fin de service" pour le pointage, avec son propre mini-pavé PIN si aucun vendeur n'est déjà identifié). `/pos/vendeurs` (admin CRUD) reste séparée, hors du parcours comptoir.

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
- `src/lib/validators/pointage.ts` *(nouveau)* — schéma `{ pin }` seul (le vendeur est identifié par l'URL, pas par le corps)
- `src/app/api/v1/pos/vendeurs/[id]/clock-in/route.ts` *(nouveau)* — rejette `ALREADY_CLOCKED_IN` (400) si un pointage sans `clockOut` existe déjà pour ce vendeur
- `src/app/api/v1/pos/vendeurs/[id]/clock-out/route.ts` *(nouveau)* — cherche le pointage ouvert le plus récent (`clockOut: null`), rejette `NOT_CLOCKED_IN` (400) si aucun
- `src/app/api/v1/pos/vendeurs/[id]/pointage/route.ts` *(nouveau)* — `GET` le pointage ouvert courant, utilisé par l'UI pour savoir quel formulaire afficher
- `src/app/[locale]/(dashboard)/pos/pointage/page.tsx` *(nouveau)* — même pattern que `/pos/caisse` (`VendeurPicker` + formulaire PIN unique par action)
- `src/lib/constants/nav.ts` — entrée "Pointage" ajoutée au groupe Point de vente (permission `pos.sell`, entre Caisse et Vendeurs)

**Test navigateur** :
1. Pointer l'arrivée → horodatage créé, écran bascule automatiquement sur le formulaire de départ (sans reload).
2. Pointer le départ → `clockOut` renseigné sur le même enregistrement ; re-sélectionner le vendeur relance un cycle propre (formulaire d'arrivée).

**Statut : ✅ Terminée le 2026-07-26.**

**Écart d'exécution constaté** : aucun sur les routes — plan suivi tel quel. Une route `GET .../pointage` (non prévue explicitement dans le plan) a été ajoutée pour que l'UI sache quel formulaire afficher, sur le même modèle que `GET /pos/caisse?vendeurId=`.

**Tests réels effectués (navigateur + appels API directs pour les cas d'erreur)** :
- Cycle complet au navigateur : arrivée pointée (16:03) → départ pointé (16:04) → re-sélection du vendeur → nouveau cycle propre proposé.
- PIN erroné sur `/clock-in` → `400 INVALID_PIN` (jamais 401, même règle que les étapes 2-3).
- `/clock-out` sans arrivée pointée → `400 NOT_CLOCKED_IN`.
- Double `/clock-in` consécutif → le premier réussit (`201`), le second rejeté `400 ALREADY_CLOCKED_IN`.
- Vendeur et pointages de test supprimés après vérification.

---

## Étape 5 — Écran de vente : produits + stock DIRECT

**Fichiers concernés** :
- `src/app/api/v1/pos/products/route.ts` *(nouveau)* — liste des `Product` actifs (`isActive`, `deletedAt: null` — volontairement pas `isVisible`/`isClickCollect`, concepts storefront non pertinents au comptoir) avec leur stock `DIRECT` restant agrégé (même pattern que `vitrineQtyRemaining`, étape 9 de Boutique/Produits, appliqué au canal `DIRECT`)
- `src/app/[locale]/(dashboard)/pos/vente/page.tsx` *(nouveau)* — même layout dashboard que Caisse/Pointage/Vendeurs (cohérence avec le reste du module, pas de layout tactile dédié pour cette première passe)
- `src/lib/constants/nav.ts` — entrée "Vente" ajoutée (permission `pos.sell`, entre Caisse et Pointage)
- Composition de vente en mémoire côté client (`useState` panier), pas encore de décrément (étape 6)

**Test navigateur** :
1. Écran affiche les produits avec leur stock `DIRECT` réel.
2. Précondition caisse ouverte respectée : sans session `OPEN` pour le vendeur sélectionné, message explicite + pas d'accès au catalogue (au lieu de l'écran de vente).
3. Ajout/retrait au panier (steppers +/-), total recalculé en direct, retrait total supprime la ligne.

**Statut : ✅ Terminée le 2026-07-26.**

**Écart d'exécution constaté** : route dans `(dashboard)/pos/vente/` plutôt qu'un layout tactile séparé — décision prise à l'implémentation par cohérence avec Caisse/Pointage/Vendeurs (déjà tous dans le layout admin standard malgré la mention "ergonomie tactile" du brainstorm) ; à revoir si l'usage réel sur tablette le justifie.

**Tests réels effectués** : précondition "aucune session de caisse ouverte" affichée correctement (message + lien implicite vers Caisse) ; après ouverture de caisse, catalogue affiché avec 2 produits réels et leur stock `DIRECT` (`Pain de campagne` 150 dispo, `Croissant pur beurre` 35 dispo) ; ajout de 2× Pain + 1× Croissant → total 8.92€ correct ; décrément du Croissant à 0 → ligne supprimée du panier, total recalculé à 7.42€.

---

## Étape 6 — Finalisation de la vente

**Fichiers concernés** :
- `src/lib/validators/pos-sale.ts` *(nouveau)* — `{ vendeurId, pin, sessionCaisseId, paymentMethod, items: [{productId, quantity}] }`
- `src/app/api/v1/pos/sales/route.ts` *(nouveau)* — vérifie que la session appartient au vendeur et est `OPEN`, décrémente `ProductChannelStock` canal `DIRECT` via `consumeChannelStockOrFlagConflict` (réutilisé tel quel, juste le paramètre `channel`), crée `PosSale`/`PosSaleItem` dans la même transaction (`throw` d'un sentinel si stock insuffisant → rollback complet de la transaction, capturé ensuite pour renvoyer 400) — **rejet direct, pas de statut `STOCK_CONFLICT`** (aucun paiement externe déjà capturé contrairement au webhook Stripe)
- `src/app/[locale]/(dashboard)/pos/vente/page.tsx` — formulaire de finalisation câblé (choix Espèces/Carte + PIN), invalide la query produits au succès pour rafraîchir le stock affiché

**Test navigateur** :
1. Vente avec stock suffisant → succès, `ProductChannelStock` `DIRECT` décrémenté, ticket visible dans l'historique (étape 7).
2. Vente avec stock insuffisant → rejetée avec message clair, aucune écriture partielle.
3. Vente tentée sans caisse ouverte → rejetée.

**Statut : ✅ Terminée le 2026-07-26.**

**Écart d'exécution constaté** : le plan mentionnait un rejet "direct 400" sans préciser le mécanisme — implémenté via un symbole sentinel jeté dans le callback de `$transaction` (garantit qu'aucune écriture n'est commitée, même partiellement, si `consumeChannelStockOrFlagConflict` renvoie `false`), plutôt qu'un simple `return null` qui aurait quand même commité la transaction. Cast `tx as unknown as PrismaClient` nécessaire : le client tenant-scopé (`getPrismaWithTenant`) n'est structurellement pas assignable au type `PrismaClient` attendu par `consumeChannelStockOrFlagConflict`, bien que compatible à l'exécution (mêmes délégués de modèle).

**Tests réels effectués** : vente réelle au navigateur (1× Pain de campagne, Espèces, PIN) → stock `DIRECT` 150→149 dispo affiché en direct après invalidation de la query, panier vidé. Tentative avec quantité > stock disponible (Croissant, via appel API direct) → `400 INSUFFICIENT_STOCK`, stock inchangé avant/après (35→35, aucune écriture partielle). Vente tentée avec une session de caisse fermée entre-temps → `400 SESSION_CLOSED`.

---

## Étape 6bis — Refonte comptoir consolidée (retour utilisateur, voir décision d'architecture révisée en tête de document)

**Fichiers concernés** :
- `src/lib/pos/vendeur-auth.ts` — `identifyVendeurByPin(tenantId, pin)` *(nouveau)* : identifie le vendeur par le PIN seul, sans `vendeurId` connu à l'avance (compare contre chaque vendeur actif du tenant)
- `src/lib/validators/vendeur.ts` — `verifyPinSchema.vendeurId` devient optionnel
- `src/app/api/v1/pos/vendeurs/verify-pin/route.ts` — bascule vers `identifyVendeurByPin` si `vendeurId` absent du payload
- `src/components/pos/PinPad.tsx` — retire la présélection via `VendeurPicker`, pavé affiché directement ; nouveau prop `variant: 'modal' | 'inline'` ; `onVerified(vendeur, pin)` renvoie désormais aussi le PIN saisi (pour que l'appelant le mémorise en mémoire, cf. décision révisée)
- `src/app/[locale]/(dashboard)/pos/caisse/page.tsx` — **réécrite entièrement** : pad numérique par défaut → une fois identifié (`unlocked: {id, firstName, lastName, pin}` en state), ouverture de caisse si besoin puis vente (panier, produits, finalisation) sans redemander le PIN, retour automatique au pad après vente finalisée ou caisse fermée ; boutons "Début de service"/"Fin de service" toujours visibles (réutilisent le PIN déjà mémorisé si un vendeur est identifié, sinon ouvrent un mini-pavé PIN dédié)
- `src/app/[locale]/(dashboard)/pos/vente/` et `.../pos/pointage/` — **supprimées** (fonctionnalité absorbée par `/pos/caisse`)
- `src/lib/constants/nav.ts` — entrées "Vente" et "Pointage" retirées

**Tests réels effectués** : pad numérique affiché par défaut (plus de grille de sélection vendeur) ; PIN de Marie (1234) tapé seul → identifiée directement, session de caisse déjà ouverte détectée sans re-prompt ; vente (1× Pain de campagne) composée et finalisée sans jamais retaper le PIN → toast "Vente finalisée — 3.71€" → retour automatique au pad ; "Début de service" sans vendeur identifié → mini-pavé PIN dédié → PIN de Marie → rejet correct `ALREADY_CLOCKED_IN` (pointage déjà ouvert d'un test antérieur) ; "Fin de service" → PIN → "Départ pointé", modal fermée, retour au pad.

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
