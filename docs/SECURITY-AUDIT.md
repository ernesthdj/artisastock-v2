# Security Audit — ArtisaStock V2

**Date :** 2026-08-09
**Méthode :** Audit multi-agents (5 agents en parallèle) scopé précisément via le graphe de connaissances du projet (graphify — `graphify-out/graph.json`, 1886 nœuds / 3174 arêtes / 256 communautés). Le graphe a servi à identifier les god nodes (`withPermission()`, `getPrismaWithTenant()`, `apiClient`, JWT lifecycle) et les communautés denses (auth, RBAC, POS PIN, paiements, SQL brut) pour scoper chaque agent sur une liste de fichiers précise au lieu d'une exploration à l'aveugle du repo.
**Périmètre couvert :** Auth & sessions · RBAC & isolation tenant · Authentification PIN POS · Paiements/webhooks/uploads · SQL brut & fuite cross-tenant.
**Statut :** Aucun fix appliqué — audit uniquement, à traiter en session dédiée.

---

## Résumé exécutif

| Métrique | Valeur |
|----------|--------|
| Failles critiques | 3 |
| Failles élevées | 3 |
| Failles moyennes | 6 |
| Failles faibles / dette | 3 |
| Domaines confirmés sains | Webhook Stripe, calcul serveur des montants, Stripe Connect, SQL brut (0 injection/0 fuite), hash bcrypt, anti-énumération email |

---

## 🔴 Critiques

### FAILLE-001 — CRITIQUE — Contournement total du lockout PIN comptoir
**Fichier :** `src/lib/pos/vendeur-auth.ts` (+ `src/app/api/v1/pos/vendeurs/verify-pin/route.ts`, `src/lib/validators/vendeur.ts:21`)
**Description :** Le lockout anti-brute-force (5 tentatives / 15min) n'existe que dans `verifyVendeurPin(vendeurId, pin)`. Or `vendeurId` est **optionnel** dans le schéma de validation de `verify-pin` — s'il est omis, c'est `identifyVendeurByPin(tenantId, pin)` qui s'exécute à la place, et cette fonction n'incrémente jamais `failedPinAttempts`.
**Scénario d'exploitation :** Un attaquant qui appelle `POST /api/v1/pos/vendeurs/verify-pin` sans `vendeurId` peut tester les 10 000 combinaisons de PIN à 4 chiffres sans jamais déclencher de verrou, et retrouver le PIN de n'importe quel vendeur actif du tenant.
**Impact :** Compromission complète de l'auth comptoir (ventes, ouverture/fermeture caisse, pointage usurpés).
**Recommandation :** Rendre `vendeurId` obligatoire côté validateur ET serveur, ou appliquer un rate-limit global par tenant/IP sur le chemin sans `vendeurId`.

### FAILLE-002 — CRITIQUE — Fail-open sur le secret JWT (middleware Edge)
**Fichier :** `src/middleware.ts:103`
**Description :** `const jwtSecret = process.env.JWT_SECRET ?? '';` — si la variable d'environnement est absente (erreur de config déploiement), le middleware Edge vérifie les signatures HMAC avec une clé vide au lieu d'échouer bruyamment au démarrage. Incohérent avec `auth.ts:6` qui utilise `JWT_SECRET!` (assertion, sans validation de boot non plus).
**Scénario d'exploitation :** En cas de variable d'env manquante en prod, un attaquant qui devine ce mode dégradé peut forger un JWT signé avec `HMAC-SHA256('')` et passer le contrôle Edge.
**Recommandation :** Valider toutes les variables d'env critiques (`JWT_SECRET`, `JWT_REFRESH_SECRET`) au démarrage de l'app avec un `throw` explicite si absentes — jamais de fallback silencieux sur un secret.

### FAILLE-003 — CRITIQUE — Élévation de privilège via auto-promotion de rôle
**Fichier :** `src/app/api/v1/users/[id]/route.ts:31-58`
**Description :** `PATCH /api/v1/users/[id]` ne vérifie jamais que le `roleId` cible reste dans les permissions de l'appelant. Seule l'auto-désactivation (`isActive:false`) est bloquée (ligne 48) — pas l'auto-promotion.
**Scénario d'exploitation :** Un utilisateur possédant uniquement la permission `team.manage` peut s'auto-attribuer (ou attribuer à un complice) le rôle `isSystem` Admin du tenant via `PATCH /users/{soi-même}` avec `roleId: <adminRoleId>`, et obtenir instantanément toutes les permissions.
**Recommandation :** Comparer le rang/l'ensemble de permissions du `roleId` cible à celui de l'appelant avant d'écrire ; interdire explicitement l'assignation d'un rôle `isSystem` via cette route (réserver ça à un flux dédié, avec permission distincte).

---

## 🟠 Élevées

### FAILLE-004 — ÉLEVÉE — Absence totale de rate limiting sur les routes d'auth
**Fichiers :** `src/app/api/v1/auth/login/route.ts`, `/register/route.ts`, `/forgot-password/route.ts`, `/reset-password/route.ts`
**Description :** Aucune limite de débit, aucun lockout, aucun captcha sur ces 4 routes.
**Scénario d'exploitation :** Brute-force de mot de passe sur `/login` sans friction ; spam de création de tenants via `/register` ; spam d'emails via `/forgot-password`.
**Recommandation :** Rate limiter par IP + par compte (ex. Upstash Redis ou équivalent Vercel Edge Config), lockout progressif après N échecs.

### FAILLE-005 — ÉLEVÉE — Upload logo SVG stocké sans sanitisation (XSS stocké potentiel)
**Fichier :** `src/app/api/v1/upload/logo/route.ts:28-31`
**Description :** Contrairement aux formats raster (re-encodés par `sharp()`, ce qui les neutralise), les logos `image/svg+xml` sont stockés **bruts**, sans passer par `sharp` ni sanitisation. Le MIME est en plus lu depuis `file.type` (déclaré par le client, pas vérifié par magic bytes).
**Scénario d'exploitation :** Un SVG contenant `<script>` uploadé comme logo tenant, s'il est servi avec `Content-Type: image/svg+xml` depuis un domaine partagé avec l'app, exécute du JS dans le contexte de la page qui l'affiche.
**Recommandation :** Sanitiser le SVG (ex. `DOMPurify` côté serveur ou librairie dédiée `svgo`/`sanitize-html`) avant stockage, ou refuser purement le SVG pour les logos et n'accepter que des rasters re-encodés.

### FAILLE-006 — ÉLEVÉE — Élévation de privilège via invitation
**Fichier :** `src/app/api/v1/users/route.ts:8-11,61`
**Description :** Même défaut que FAILLE-003 mais côté invitation : `roleId` optionnel dans `inviteSchema`, non contrôlé par rapport aux droits de l'inviteur.
**Scénario d'exploitation :** Un porteur de `team.manage` peut inviter un nouvel utilisateur directement avec le rôle Admin.
**Recommandation :** Même fix que FAILLE-003, appliqué à la création.

---

## 🟡 Moyennes

### FAILLE-007 — MOYENNE — Révocation de session illusoire
**Fichier :** `src/lib/permissions.ts:16-47` (`withAuth`)
**Description :** `withAuth` vérifie uniquement la signature/expiration JWT, jamais l'existence de la session en DB. Après `logout` ou `reset-password` (suppression des sessions), l'ancien access token reste valide jusqu'à expiration naturelle (~15min). `withPermission` mitige partiellement (revérifie `isActive` en DB) mais pas les routes en simple `withAuth` (ex. `me/route.ts`).
**Recommandation :** Vérifier l'existence de la session en DB (ou une blocklist courte) même sur les routes `withAuth`-only, ou réduire drastiquement la durée de vie de l'access token.

### FAILLE-008 — MOYENNE — Fenêtre de non-atomicité webhook Stripe (commande dupliquée possible)
**Fichier :** `src/app/api/webhooks/stripe/route.ts:29-34, 50-57, 147-176`
**Description :** L'écriture de l'AuditLog d'idempotence (dédup par `event.id`) se fait **après** et **hors** de la transaction Prisma qui crée la commande.
**Scénario d'exploitation :** Un retry Stripe (timeout réseau, erreur transitoire) entre la fin de la transaction commande et l'écriture du log rejoue tout `handleCheckoutCompleted` → double commande + double décrément de stock.
**Recommandation :** Déplacer l'écriture de l'AuditLog dans la même transaction que la création de commande, ou ajouter une contrainte unique DB sur `stripeSessionId`.

### FAILLE-009 — MOYENNE — Rôle `isSystem` non protégé contre modification/suppression
**Fichier :** `src/app/api/v1/roles/[id]/route.ts:27-81`
**Description :** Aucun check explicite `existing.isSystem` avant PATCH/DELETE. Seule garde apparente sur DELETE : `_count.users > 0` (implicite).
**Recommandation :** Bloquer explicitement toute modification/suppression d'un rôle `isSystem`.

### FAILLE-010 — MOYENNE — Pas de protection anti-lockout tenant
**Fichier :** `src/app/api/v1/users/[id]/route.ts:47-50`
**Description :** Seule l'auto-désactivation est bloquée ; rien n'empêche un porteur de `team.manage` de désactiver tous les autres comptes `isSystem` un par un.
**Recommandation :** Empêcher la désactivation du dernier compte Admin actif d'un tenant.

### FAILLE-011 — MOYENNE — Test d'isolation tenant ne teste pas le vrai mécanisme
**Fichier :** `tests/integration/tenant-isolation.test.ts`
**Description :** Les mocks Prisma reçoivent `where.tenantId` déjà injecté manuellement par le test — `getPrismaWithTenant()` (le `$extends` réel) n'est jamais exercé. Fausse confiance de couverture.
**Recommandation :** Réécrire le test pour exercer le vrai client étendu, y compris le cas d'un `where` sans `tenantId` explicite (vérifier l'auto-injection).

### FAILLE-012 — MOYENNE — DoS CPU combiné à FAILLE-001
**Fichier :** `src/lib/pos/vendeur-auth.ts` (`identifyVendeurByPin`)
**Description :** Boucle `bcrypt.compare` sur tous les vendeurs actifs à chaque tentative, sans limite de débit (cf. FAILLE-001 + FAILLE-004) → consommation CPU soutenue possible en boucle.
**Recommandation :** Se résout naturellement en corrigeant FAILLE-001 et FAILLE-004.

---

## 🟢 Faibles / dette de sécurité

### FAILLE-013 — FAIBLE — `jwt.verify` sans allowlist d'algorithmes explicite
**Fichier :** `src/lib/auth.ts:37,41`
**Recommandation :** `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` — défense en profondeur contre confusion d'algorithme.

### FAILLE-014 — FAIBLE — Pas de détection de réutilisation de refresh token
**Fichier :** `src/lib/auth.ts:111-160`
**Description :** La rotation remplace le token en DB (pas de rejeu direct possible), mais aucune détection "vol détecté → révocation de toute la famille de sessions" si un refresh token déjà consommé est représenté.

### FAILLE-015 — FAIBLE — Incohérence architecturale RBAC (client Prisma brut + filtres manuels)
**Fichiers :** `src/app/api/v1/roles/*`, `src/app/api/v1/users/*`, `src/app/api/v1/tenants/current/*`
**Description :** Ces routes utilisent le client `prisma` brut avec filtres `tenantId` manuels au lieu de `getPrismaWithTenant()` (utilisé dans 41 autres fichiers du projet). Fonctionnellement correct dans le code actuel (précédé d'un `findFirst` scopé), mais fragile — pas de garantie structurelle comme le `$extends`. Contredit la règle #1 du JOURNAL ("Prisma $extends pour injection tenantId — jamais de filtre manuel répété").
**Recommandation :** Migrer ces routes vers `getPrismaWithTenant()` par cohérence et robustesse défense-en-profondeur.

---

## ✅ Confirmé sain (vérifié, pas de faux positif à corriger)

- **Webhook Stripe** : signature vérifiée via `stripe.webhooks.constructEvent` avec secret d'env + header `stripe-signature` — non forgeable.
- **Montant de commande** : toujours recalculé serveur depuis les prix produits en DB (checkout + webhook), jamais fait confiance à un montant client.
- **Isolation Stripe Connect multi-tenant** : `stripeAccountId` toujours dérivé du tenant résolu par slug/JWT, pas du body client.
- **SQL brut (3 fichiers flaggés par le graphe)** — `dashboard/kpi`, `dashboard/stock-alerts`, `ingredients/alerts` : tous en `$queryRaw` tagged-template (paramétré, pas d'injection), tous filtrés `WHERE tenantId = ${ctx.tenantId}` avec `ctx.tenantId` issu du JWT vérifié. Le graphe avait raison sur la **duplication de code** (3 requêtes quasi-identiques, à factoriser par hygiène) mais c'était un faux positif sur le risque sécurité. Aucun `$queryRawUnsafe`/`$executeRawUnsafe` dans tout le projet.
- **Hash mot de passe** : bcrypt coût 12, comparaison timing-safe.
- **Anti-énumération email** : `forgot-password` renvoie une réponse identique que l'email existe ou non.
- **Vérification JWT Edge** : `verifyJwtEdge` utilise réellement `crypto.subtle.verify` (pas juste un décodage du payload), ignore l'`alg` déclaré dans le header.
- **`getPrismaWithTenant()`** : `tenantId` toujours dérivé du JWT vérifié (`ctx.tenantId`), jamais d'un header/query param manipulable — le mécanisme central est solide.
- **`accept-invite`** : token vérifié (expiration + usage unique via `usedAt`), entropie nanoid(32) infaisable à bruteforcer.
- **PIN vendeur** : `isPinTaken()` bien appelée à la création ET à la réinitialisation (collision déjà corrigée le 2026-07-27) ; clock-in/out, ouverture/fermeture caisse, ventes re-vérifient tous le PIN serveur à chaque fois (aucune confiance dans un `vendeurId` client seul) ; `verify-pin` ne renvoie jamais 401 par erreur.

---

## Priorité de correction recommandée pour la prochaine session

1. FAILLE-001 (lockout PIN contournable) — comptoir en prod, exploitation triviale
2. FAILLE-003 + FAILLE-006 (élévation de privilège RBAC) — un seul fix (garde de rang de rôle) couvre les deux
3. FAILLE-002 (fail-open JWT_SECRET) — un `throw` au boot suffit
4. FAILLE-005 (SVG logo XSS) — sanitisation ou blocage du SVG
5. FAILLE-004 (rate limiting) — chantier plus large (infra), à planifier
6. Le reste (moyennes/faibles) peut suivre sans urgence
