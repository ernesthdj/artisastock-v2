# ArtisaStock V2 — Dossier Technique Complet

> **Généré le** : 2026-08-12, via exploration exhaustive du code source (7 agents de recherche parallèles) + le graphe de connaissances Graphify du projet (1886 nœuds, 3174 arêtes, 256 communautés, rebuild du 2026-08-10).
> **Objectif de ce document** : servir de matière première complète et précise à la génération de synthèses de présentation et de cartes mentales (Gemini NotebookLM). Il privilégie l'exhaustivité et la précision technique à la concision — chaque affirmation est ancrée sur un fichier réel du code source.
> **Portée** : couvre l'intégralité du code (`src/`, `prisma/`, `scripts/`, `tests/`), toute la documentation projet (`docs/`), l'historique Git et le journal de développement.
> **Avertissement méthodologique important** : certains documents de conception du projet (`docs/ARCHITECTURE.md`, `docs/UI-DESIGN.md`) sont **antérieurs à des pivots majeurs** et ne reflètent plus le code réel (ex. le doc d'architecture décrit NextAuth, le code utilise un JWT maison ; le doc UI décrit une palette orange/vert, le code utilise une palette chocolat/or/framboise). Ce dossier signale systématiquement ces écarts et fait toujours autorité sur l'état **réel** du code plutôt que sur l'intention documentée.

---

## Table des matières

1. Vision, contexte et origine du projet
2. Architecture technique
3. Modèle de données (schéma Prisma complet)
4. Authentification, sessions, RBAC
5. Module BOM — Nomenclature de fabrication
6. Module Achats, Ingrédients, Stock, Fournisseurs
7. Module Recettes (legacy, parallèle au BOM)
8. Module POS (Point de Vente comptoir)
9. Module Équipe
10. Module Boutique en ligne (storefront) & CMS
11. Commandes, Facturation, TVA, Stripe
12. Vue Flux (widget Hub)
13. Dashboard
14. Paramètres (Settings)
15. Modules stubs / non implémentés
16. Système UI (Design System)
17. Internationalisation (i18n)
18. Tests et qualité
19. Outillage, scripts, déploiement
20. Sécurité — Audit complet
21. QA — Bugs historiques
22. Scénarios de test réels (personas)
23. Lignée V1 → V2 (contexte académique)
24. Règles apprises (Journal — 53 règles, organisées par thème)
25. Historique chronologique du projet
26. Synthèse de maturité — état des lieux global
27. Annexe — Inventaire des incohérences et gaps connus

---

## 1. Vision, contexte et origine du projet

### 1.1 Filiation académique

ArtisaStock_V2 n'est pas un projet isolé : c'est un même projet qui mature à travers plusieurs échéances académiques successives, plutôt que d'être recommencé à chaque fois.

1. **PDSGBD** (examen de gestion de base de données) — projet initial nommé `charlesnadejda-project`, interface **C# WinForms** imposée par l'examen. Idée de départ : une application de gestion de stock pour la mère et le beau-père de l'auteur, chocolatiers/pâtissiers artisanaux — un cas d'usage réel, pas hypothétique.
2. **PID** (examen à venir, exigences pas encore clarifiées) — c'est ArtisaStock_V2 dans son état courant (migration React/Next.js du projet V1) qui doit servir cet examen.
3. **TFE** (Travail de Fin d'Études, horizon 1+ an) — le projet continuera d'évoluer jusqu'à devenir le livrable final du Bachelier.

### 1.2 Le pivot HORECA (brainstorm macro, 2026-07-24)

Le projet s'est recentré : d'une app de gestion de stock pour artisan pâtissier isolé, vers une plateforme modulaire pour **patron de restaurant (HORECA)**, avec à terme trois modules — **RH + ERP + POS** — partageant une seule source de vérité : le **stock en base de données**.

**Différenciateur central** : une discipline de stock rigide et non contournable — pas de vente au noir possible, pas de vol invisible, pertes/négligences automatiquement tracées. Ce principe est directement inspiré des 15 ans d'expérience hôtellerie de l'auteur : RESTOMAX est cité comme repoussoir (architecture cassée), Securex comme bon outil mais cloisonné (silotage entre RH/ERP/POS que le projet veut justement éliminer).

**Précaution légale documentée** : Dolibarr est cité comme référence fonctionnelle d'inspiration uniquement (licence GPL-3.0-or-later incompatible avec une réutilisation littérale de code dans un SaaS commercial fermé — analyse fonctionnelle/schéma uniquement, jamais de copie de code).

**Documents de fondation produits** :
- `docs/FONDATION.md` (2026-06-07) — vision originale, aujourd'hui dépassée : SaaS ERP + CMS e-commerce pour artisans alimentaires, excluant explicitement à l'époque le POS physique et le RH (les deux sont depuis devenus centraux).
- `docs/FONDATION-HORECA.md` (2026-07-24) — le pivot macro qui absorbe et généralise le précédent.
- `docs/FONDATION-POS.md` (2026-07-23) — brainstorm POS spécifique, rédigé côté instance V1, largement absorbé dans le document HORECA.

### 1.3 Méthodologie de conception — cascade de brainstorms

Codifiée dans le `CLAUDE.md` du projet, obligatoire pour tout module d'envergure :

1. **Brainstorm macro** — vision globale, persona, différenciateurs (fait le 2026-07-24).
2. **Brainstorm par module** — doit produire explicitement des **use cases** et un **workflow utilisateur complet** bout-en-bout (pas une simple liste de fonctionnalités).
3. **Implémentation guidée par ce workflow**, testée dans le navigateur au fur et à mesure — jamais uniquement en fin de développement.

Règle explicite : ne jamais sauter l'étape 2 pour un module conséquent, sous peine de décalage entre intention et implémentation.

### 1.4 Architecture modulaire — activable/désactivable, API-first

Chaque module (RH, ERP, POS, Boutique, futurs modules) doit pouvoir être activé/désactivé indépendamment et communiquer avec les autres modules/la DB **uniquement via API** — jamais de couplage direct en dur. Même un module reporté (RH) doit voir les modules construits avant lui (POS) exposer par avance les points d'API nécessaires à une intégration future.

### 1.5 Chronologie des cascades de modules déjà menées

Boutique/Produits (brainstorm + impl, 2026-07-24/25) → POS (brainstorm + impl, 2026-07-25/26, avec une révision architecturale majeure le 2026-07-26) → Vue Flux/Hub (brainstorm + impl, 2026-07-26, portée réduite assumée) → Équipe (brainstorm + impl, 2026-07-28). Le module RH reste en attente ("quand pertinent").

---

## 2. Architecture technique

### 2.1 Stack technologique

| Catégorie | Technologie |
|---|---|
| Framework | Next.js ^15.0.0 (App Router), React/React-DOM ^18.3.0 |
| Langage | TypeScript ^6.0.3 (strict mode) |
| ORM / DB | Prisma ^5.22.0, PostgreSQL (hébergé Supabase) |
| i18n | next-intl ^3.20.0 (locales `fr`/`nl`, préfixe toujours présent) |
| Auth | JWT maison (`jsonwebtoken` + `bcryptjs`), **pas** NextAuth malgré ce qu'indique `docs/ARCHITECTURE.md` |
| Paiement | Stripe ^17.0.0 (Connect Express, comptes destinataires) |
| Email transactionnel | Resend ^4.0.0 |
| Fichiers / images | UploadThing ^7.2.0 + `sharp` (traitement d'image) — **note : upload non finalisé, voir §15** |
| PDF | `@react-pdf/renderer` ^3.4.4 — **note : génération actuelle produit du HTML, pas un vrai PDF, voir §11** |
| UI | Design system maison sur primitives Radix UI, `class-variance-authority`, `tailwind-merge`, `lucide-react`, `sonner` (toasts) — shadcn/ui scaffoldé (`components.json`) mais peu utilisé tel quel |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` (prévu pour le CMS builder — jamais implémenté, voir §15) |
| Formulaires | `react-hook-form` ^7.81 + `zod` ^3.23 + `@hookform/resolvers` |
| État / data-fetching | Zustand ^5 (panier storefront), TanStack React Query ^5 |
| Style | Tailwind CSS ^3.4, PostCSS, Autoprefixer |
| Tests | Vitest ^2.1 (+ `@vitest/coverage-v8`), specs Playwright rédigées mais **non exécutables** (dépendance absente) |

**Absences notables** malgré des variables d'environnement présentes dans `.env.example` : `next-auth`, `@sentry/nextjs`, `@upstash/ratelimit`/`@upstash/redis`, `@playwright/test` — intégrations soit abandonnées au profit d'une solution maison (auth), soit jamais câblées (monitoring, rate limiting, tests e2e).

### 2.2 Topologie de déploiement

- **Hébergement applicatif** : Vercel (projet lié via CLI — `projectId: prj_TwGIlHd5wn7m23O3xZb4tAsQJKH3`).
- **Base de données** : PostgreSQL géré par Supabase, région **AWS eu-west-1** (project ref `qhnduvxkopohyfynjmfy`), Postgres 17.6.1.147. Deux URLs de connexion : `DATABASE_URL` (pooler PgBouncer, port 6543, utilisé au runtime) et `DIRECT_URL` (connexion directe, port 5432, réservée aux migrations Prisma).
- **Gestion du schéma** : exclusivement via Prisma (`prisma migrate`/`db push`) — les outils natifs Supabase (config.toml, migrations Supabase) ne sont **pas** utilisés ; Supabase sert uniquement d'hébergeur Postgres managé.
- **Stockage fichiers** : UploadThing (pas Supabase Storage, malgré ce que suggère le diagramme d'archi initial).
- **⚠️ Incident de dérive de schéma documenté** (règle #42, 2026-07-27) : `git push` ne déploie **jamais** le schéma Prisma vers Supabase (seulement le code applicatif via Vercel). Un push de schéma oublié sur plusieurs sessions a fait dériver silencieusement la prod (3 tables entières manquantes, modèle `Product` resté sur l'ancien schéma pré-BOM). Corrigé via `prisma migrate diff --from-empty` + `supabase db query --linked` après vérification qu'aucune ligne n'était affectée. **Règle opérationnelle la plus lourde de conséquences du projet** : toute session touchant `schema.prisma` doit se conclure par un vrai `prisma db push` prod ou un script SQL équivalent appliqué manuellement.
- **Limite d'environnement agent** : le sandbox de développement scrube automatiquement les vraies valeurs `DATABASE_URL`/`DIRECT_URL` récupérées via `vercel env pull` — tout accès direct à la prod depuis l'agent est donc impossible ; contournement documenté via `supabase link` + `supabase db query --linked`.

### 2.3 Sécurité transverse (`next.config.ts`)

En-têtes appliqués à toutes les routes : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS (`max-age=31536000; includeSubDomains`), `Permissions-Policy` restrictive (caméra/micro/géoloc désactivés), et une CSP autorisant explicitement Stripe (`js.stripe.com`), UploadThing, Google Fonts. `serverExternalPackages: ['@react-pdf/renderer']` (exclu du bundling serveur Next).

### 2.4 Multi-tenancy — `src/lib/prisma.ts`

Mécanisme central : `getPrismaWithTenant(tenantId)`, construit avec l'API Prisma `$extends({query: {$allOperations(...)}})` — un unique hook intercepte **toutes** les opérations sur **tous** les modèles.

- **`GLOBAL_MODELS`** (jamais scopés) : `Session`, `PasswordResetToken`, `AuditLog`, `CookieConsent` — soit sans notion de tenant, soit délibérément cross-tenant (audit, consentement).
- **`TENANT_SCOPED_VIA_PARENT`** (également exclus de l'injection auto, mais pour une raison différente) : `BomLevel`, `BomSheet`, `BomLine`, `ActiviteStock` — ces modèles **n'ont pas de colonne `tenantId` propre** (le tenant se déduit via la chaîne de FK parentes, ex. `BomLevel → BomContext.tenantId`). Injecter un filtre `tenantId` planterait au runtime ("Unknown argument"). **Conséquence documentée dans le code** : toute route touchant ces modèles doit vérifier manuellement l'appartenance tenant via la chaîne parente — ce n'est pas automatique pour ces 4 modèles.
- Pour tous les autres modèles : lecture → `tenantId` fusionné dans `where` ; création → fusionné dans `data` ; mutation (update/delete/upsert) → fusionné dans `where` (et dans `data` pour la branche `create` d'un `upsert`).
- **⚠️ Incohérence architecturale documentée (FAILLE-015, sécurité)** : `roles/*`, `users/*`, `tenants/current/*` utilisent le client Prisma brut avec filtrage manuel `tenantId` au lieu de `getPrismaWithTenant()` — fonctionnellement correct aujourd'hui mais contredit la règle #1 du journal et représente un risque de régression futur.

### 2.5 Middleware (`src/middleware.ts`)

Un unique middleware gère à la fois l'auth API et le routage i18n :

1. `pathname === '/api/webhooks/stripe'` → bypass total (la vérification de signature Stripe a besoin du corps brut, gérée dans le handler lui-même).
2. `pathname` commence par `/api/` :
   - Routes publiques exactes (`/api/v1/auth/{register,login,forgot-password,reset-password,verify-email,refresh}`) ou préfixes publics (`/api/v1/storefront/`, `/api/storefront/`) → pas d'auth.
   - Sinon : extraction du Bearer token, vérification JWT **Edge-compatible** via Web Crypto (`crypto.subtle.verify`, HMAC-SHA256, décodage base64url manuel — implémentation maison car `jsonwebtoken` (Node) est incompatible avec le runtime Edge). Sur succès, injection des headers `x-user-id/x-tenant-id/x-user-email/x-user-role/x-session-id` pour les Route Handlers en aval.
3. `pathname` commence par `/storefront/` → bypass total du middleware i18n (`intlMiddleware`). C'est volontaire : le storefront public vit **hors** du segment `[locale]` (`src/app/storefront/[tenantSlug]/`) ; le router systématiquement à travers `intlMiddleware` provoquait un 404 (redirection incorrecte vers `/fr/storefront/...`) — bug corrigé le 2026-07-24.
4. Sinon (pages) → délégation à `intlMiddleware` (next-intl).

**⚠️ Point de sécurité (FAILLE-002, critique)** : `const jwtSecret = process.env.JWT_SECRET ?? '';` — un secret manquant fait échouer silencieusement vers une chaîne vide au lieu de crasher au démarrage. Voir §20.
**Autre limite** : aucun rate-limiting n'est appliqué dans ce middleware malgré la présence de variables d'environnement Upstash — package absent. Aucune vérification RBAC non plus au niveau middleware (entièrement délégué aux Route Handlers via `withPermission()`).

### 2.6 Écart majeur avec `docs/ARCHITECTURE.md`

Ce document (rédigé 2026-06-07, avant le pivot BOM/POS/multi-stock) décrit une architecture **substantiellement différente** du code actuel. Tableau de synthèse :

| Domaine | Ce que dit le doc | Ce que fait le code réel |
|---|---|---|
| Auth | NextAuth v5, `getToken()` | JWT maison (`jsonwebtoken`+`bcryptjs`), modèle `Session` en DB, vérif Edge via Web Crypto |
| Produit/Recette | `Product.recipeId` → `Recipe`, `VatRate` enum fixe | `Product.bomSheetId` → `BomSheet` (BOM), `Product.vatRateId` → `TenantVatRate` (dynamique) |
| Stock | Champ scalaire simple sur `Ingredient` | `Ingredient.stock` dénormalisé, vérité réelle dans `Lot` (FIFO) |
| POS | Non mentionné | Sous-domaine entier : `Vendeur`, `SessionCaisse`, `PointageHoraire`, `PosSale` |
| Permissions | 8 modules, ~17 clés | 14 modules, 33 clés (voir §4) |
| Env | Sentry + Upstash listés | Packages absents, intégrations non câblées |

**Conclusion pour ce dossier** : `docs/ARCHITECTURE.md` reste utile pour comprendre l'intention initiale (conventions de nommage, stratégie de cache, politique CSP), mais le code source (`schema.prisma`, `middleware.ts`, `auth.ts`) fait toujours autorité sur l'état réel.

### 2.7 Configuration — fichiers clés

- **`tsconfig.json`** : `strict: true`, `target: ES2017`, `moduleResolution: bundler`, alias `@/* → ./src/*`.
- **`tailwind.config.ts`** : palette de marque "Charles & Nadejda" (choco/or/framboise/creme — noms réels des artisans à l'origine du projet), échelle de police custom `erp-xs`→`erp-3xl`, ombres/rayons custom. `components.json` (config shadcn) référence encore `baseColor: "orange"`, incohérent avec la palette réellement en place — reliquat de scaffolding jamais réaligné.
- **`vitest.config.ts`** : environnement `node`, couverture v8 sur `src/lib/**` uniquement (exclut `prisma.ts`/`email.ts`/`stripe.ts`), seuils 70% lignes/fonctions, 60% branches.
- **Aucune CI** : pas de `.github/workflows/`, aucune configuration CI trouvée nulle part dans le repo — tous les contrôles qualité (lint/typecheck/tests) sont manuels et locaux.

---

## 3. Modèle de données (schéma Prisma complet)

Fichier source : `prisma/schema.prisma`, 1145 lignes, `datasource` PostgreSQL avec double URL (pooler + directe).

### 3.1 Enums (20 au total)

`Plan` (FREE_TRIAL/STARTER/PRO/ENTERPRISE) · `OrderStatus` (NEW/CONFIRMED/STOCK_CONFLICT/IN_PREPARATION/READY/PICKED_UP/CANCELLED) · `InvoiceStatus` (DRAFT/ISSUED/PAID/CANCELLED) · `VatRate` (FOOD_6/STANDARD_21 — legacy, voir §7) · `UnitOfMeasure` (KG/G/MG/CG/L/DL/CL/ML/PIECE/DOZEN) · `BomInputType` (INGREDIENT/SHEET) · `PhysicalType` (SOLID/LIQUID/POWDER/PIECE) · `BomSourceType` (LOT_INGREDIENT/BOM_STOCK) · `StockChannel` (VITRINE/DIRECT) · `ClosureReason` (WASTE/STAFF/OTHER) · `DayOfWeek` · `BlockType` (HERO/TEXT/IMAGE/GALLERY/PRODUCTS/CONTACT/TESTIMONIALS/MAP/CUSTOM_HTML) · `NotificationType` · `GdprRequestType` (ACCESS/DELETION) · `GdprRequestStatus` (PENDING/PROCESSED/REJECTED) · `SessionCaisseStatus` (OPEN/CLOSED) · `PosPaymentMethod` (CASH/CARD).

### 3.2 Domaine : Tenant & Auth

- **`Tenant`** — `slug` (unique), `plan`, `locale`, `vatNumber?`, `address?` (Json), `settings` (Json libre — sert aussi de stockage pour `stripeAccountId`, préférences de notifications), `trialEndsAt?`, `isActive`, `deletedAt?`. Relation vers pratiquement tous les modèles tenant-scopés.
- **`User`** — `email` (unique **par tenant**, `@@unique([email, tenantId])`), `passwordHash`, `role?` (FK nullable), `sessions[]`, `isActive`, `onboardingDone`, `deletedAt?`.
- **`Session`** — `token`/`refreshToken` (uniques), `expiresAt`, `userAgent?`, `ipAddress?`.
- **`UserInvitation`** — `token` (unique, nanoid(32)), `roleId?`, `expiresAt` (7 jours), `usedAt?`, `invitedById`.
- **`PasswordResetToken`** — modèle global (pas de tenant).

### 3.3 Domaine : RBAC

- **`Role`** — `permissions` (Json, tableau de clés string), `isSystem` (défaut false — le rôle "Admin" est protégé par ce flag ; **⚠️ aucune protection serveur réelle contre modification/suppression**, voir §20 FAILLE-009), `@@unique([tenantId, name])`.

### 3.4 Domaine : Ingrédients & Stock (matières premières)

- **`Ingredient`** — `unit`, `physicalType` (défaut PIECE), `density?` (obligatoire en Zod si LIQUID/POWDER, non contraint en DB), `priceUnit`, `pricePack?`, `packSize?`, `unitsPerLot` (défaut 1), **`stock`** (Decimal, défaut 0, **intentionnellement dénormalisé** — commentaire explicite dans le schéma : c'est la somme de `Lot.quantityAvailable`, maintenue transactionnellement à chaque achat/édition/suppression de lot et à chaque consommation FIFO ; "jamais modifiable directement, pas de PATCH stock générique"), `alertThreshold`, `isAlertActive`, `dlcDaysReference?`, `defaultStockId?`, `supplierId?`, `@@unique([tenantId, name])`.
- **`Lot`** — instance d'achat = batch physique, unité FIFO. `purchaseDate`, `expiryDate?`, `quantityInitial`, `quantityAvailable`, `unitPrice` (Decimal — "HTVA par conditionnement, toujours stocké HTVA"), `totalPriceHT`, `vatRate` (défaut STANDARD_21).
- **`Supplier`** — `address?` (Json structuré), `@@unique([tenantId, name])`.

### 3.5 Domaine : Recettes (legacy — voir §7 pour le détail)

`Recipe`, `RecipeIngredient`, `RecipeVersion` — coexistent avec le BOM mais ne sont **jamais peuplés** par le seed de démo, qui construit tous ses produits via le BOM. Indice fort que ce sous-domaine est superseded en pratique.

### 3.6 Domaine : BOM — Nomenclature de fabrication (voir §5 pour le détail fonctionnel)

`BomContext` → `BomLevel` (ordonné, `order` commence à 1) → `BomSheet` (fiche de fabrication) → `BomLine` (ligne d'input, `INGREDIENT` xor `SHEET`) ; `BomProduction` (un événement de production) → `BomProductionLine` (traçabilité fine, une ligne par lot/stock réellement consommé, `unitCostAtTime` gelé) ; `BomStock` (stock physique de produits semi-finis/finis issus d'une production, `stockId?` nullable — null pour la vente POS "à la demande", jamais stockée).

### 3.7 Domaine : Produits finis

- **`Product`** — `bomSheetId` (**requis**, → `BomSheet`), `vatRateId` (**requis**, → `TenantVatRate` dynamique, pas l'enum fixe), `priceHT`/`priceTTC`, `marginTargetFactor?`, `isPerishable`, `allergens` (Json), `isVisible`, `isClickCollect`, `@@unique([tenantId, slug])`.
- **`TenantVatRate`** — bibliothèque de taux TVA configurable par tenant, remplace l'enum `VatRate` figé pour les produits vendables.
- **`ProductChannelStock`** — stock scindé par canal de vente (`VITRINE`/`DIRECT`), lié à un `BomStock` précis, `qtyAllocated`/`qtyRemaining`.
- **`StockClosure`** — clôture de fin de journée pour périssables, `reason` (WASTE/STAFF/OTHER), `closedByUserId` — pièce centrale anti-fraude.

### 3.8 Domaine : Activités & Stocks (emplacements physiques)

`Activite` (branche métier, ex. "Boulangerie") ↔ `Stock` (emplacement physique) via la table de jointure N:N `ActiviteStock` — un même `Stock` peut être partagé entre plusieurs `Activite`.

### 3.9 Domaine : Commandes / Clients

- **`Customer`** — `@@unique([tenantId, email])`, `gdprConsent`.
- **`Order`** — `orderNumber` (format `CMD-YYYY-XXXX`), `status`, totaux HT/TVA/TTC, créneaux de retrait, `trackingToken` (unique, cuid — URL de suivi publique), `statusHistory` (Json, historique des transitions), `cgvAcceptedAt` (requis).
- **`OrderItem`** — `vatRatePercent` (Decimal, **snapshot figé au moment de la commande**, pas une référence à l'enum ni au `TenantVatRate` courant).

### 3.10 Domaine : Facturation

**`Invoice`** — `orderId` (unique, relation 1:1), `invoiceNumber` (`FACT-YYYY-XXXX`), snapshot vendeur/acheteur, `vatBreakdown` (Json), `lines` (Json), `pdfUrl?`.

### 3.11 Domaine : Créneaux de retrait

`PickupSlot` (gabarits récurrents par jour de semaine) + `ClosedDay` (jours fermés ponctuels).

### 3.12 Domaine : CMS

`Page` (blocs Json, `isSystem` pour les pages non supprimables) + `SiteConfig` (1:1 par tenant — template, logo, couleurs, polices, réseaux sociaux, `isPublished`).

### 3.13 Domaine : Notifications / Conformité / Audit

`NotificationLog`, `CookieConsent` (modèle global), `GdprRequest`, `AuditLog` (modèle global, complètement autonome, sans relations Prisma).

### 3.14 Domaine : POS

`Vendeur` (identité PIN, **distincte** de `User`/JWT admin — `pinHash`, `failedPinAttempts`, `lockedUntil?`) · `SessionCaisse` (`openingFloat`/`closingFloat`/`variance`, `status`) · `PointageHoraire` (clock-in/out) · `PosSale`/`PosSaleItem` (`productionId?` → `BomProduction`, `unitCost` — snapshot figé, jamais recalculé).

**Commentaire de schéma obsolète repéré** : le modèle `PosSale` porte encore le commentaire *"la vérité du stock reste ProductChannelStock, jamais dupliquée ici"* — ce commentaire date d'avant la révision "vente à la demande" du 2026-07-26 (§0 de `docs/modules/POS.md`) et ne reflète plus la réalité (la vérité du stock POS est désormais le stock d'ingrédients via `consumeFIFO`, pas `ProductChannelStock`). À corriger dans une future session de nettoyage documentaire.

---

## 4. Authentification, sessions, RBAC

### 4.1 Cycle de vie JWT — `src/lib/auth.ts`

Deux secrets distincts : `JWT_SECRET` (access token) et `JWT_REFRESH_SECRET` (refresh token), tous deux requis (non-null-assertion — l'import du module plante si absents).

| Fonction | Rôle |
|---|---|
| `generateAccessToken` | Signe avec `JWT_SECRET`, expiration 15 min par défaut |
| `generateRefreshToken` | Signe avec `JWT_REFRESH_SECRET`, expiration 7 jours (session normale) |
| `generateRefreshTokenLong` | Idem, 30 jours ("se souvenir de moi") |
| `hashPassword` / `verifyPassword` | bcrypt, 12 rounds |
| `createSession` | Génère `sessionId` (nanoid), signe la paire de tokens, **persiste une ligne `Session`** en DB, met à jour `User.lastLoginAt` |
| `revokeSession` | `DELETE` la ligne `Session` — c'est la suppression de la ligne qui invalide la session, pas un flag |
| `rotateRefreshToken` | Vérifie l'ancien refresh token, exige la correspondance `sessionId` **et** `refreshToken` en DB (anti-réutilisation), génère un nouveau couple et **réécrit la ligne `Session` existante** (rotation single-use). ⚠️ Asymétrie notée : la rotation retombe toujours sur une expiration de 7 jours, même si la session d'origine était un "remember me" 30 jours. |
| `extractBearerToken` | Parse l'en-tête `Authorization` |

**Modèle de révocation** : les access tokens (15 min) sont vérifiables sans DB (y compris à l'Edge) — un token révoqué mais pas encore expiré reste donc valide sur les routes qui ne font que `withAuth` (sans re-vérification DB), jusqu'à son expiration naturelle. Voir FAILLE-007 en §20.

### 4.2 RBAC — `src/lib/constants/permissions.ts` + `src/lib/permissions.ts`

**33 permissions réparties en 14 modules** :

| Module | Permissions |
|---|---|
| Ingrédients & Stock | `ingredients.read/write/delete` |
| Recettes | `recipes.read/write/delete` |
| Produits | `products.read/write/delete/allocate/close` |
| Commandes | `orders.read/manage` |
| Facturation | `invoices.read/generate` |
| CMS | `cms.read/write/publish` |
| Équipe | `team.read/manage` |
| Paramètres | `settings.read/write/flush_data` |
| BOM | `bom.read/write/produce` |
| Activités & Stocks | `activites.read/write`, `stocks.read/write` |
| Achats | `achats.read/write` |
| Taux de TVA | `tenant-vat-rates.read/write` |
| POS | `pos.sell/read/manage` |
| Vue Flux | `flow.read` |

**`withAuth(request, handler)`** — extrait/vérifie le token, construit un `AuthContext` (`{userId, tenantId, email, role, sessionId}`).

**`withPermission(request, required, handler)`** — enveloppe `withAuth` puis **re-fetch l'utilisateur en DB** pour vérifier fraîcheur (`tenantId` cohérent, `isActive`, `!deletedAt` — garde contre un token encore valide pour un compte désormais désactivé/supprimé). Si `role.isSystem === true` (Admin), **bypass total** de la vérification de permission. Sinon, exige que **toutes** les permissions demandées (`.every()`) soient présentes dans `role.permissions`.

**Rôles seedés par défaut** (à l'inscription d'un tenant) : **Admin** (`isSystem: true`, toutes permissions) · **Artisan** (`ingredients.*`, `recipes.*`, `bom.*`, `activites.read`, `stocks.read`, `achats.*`) · **Responsable** (`pos.read`, `orders.*`, `invoices.read`, `team.read`, `activites.read`, `stocks.read`) · **RH** (`team.read` uniquement — point d'entrée en attente d'un futur module RH).

**⚠️ Risque de divergence documenté (règle #28)** : le type `Permission` et le tableau `ALL_PERMISSIONS` codé en dur dans `prisma/seed.ts` peuvent diverger silencieusement — aucune erreur TypeScript tant qu'une route n'utilise pas la permission fantôme dans `withPermission()`. Un incident réel s'est déjà produit (permission `flow.read` manquante sur les rôles Admin prod, corrigée en urgence).

### 4.3 Deux notions homonymes de "Vendeur" — piège de vocabulaire

Le mot français "Vendeur" désigne **deux systèmes d'identité totalement distincts** dans ce projet :
1. Un **rôle** `User`-facing (back-office) pour la gestion de commandes (seedé par le module Recettes legacy).
2. Le **modèle Prisma `Vendeur`** (§3.14) — personnel comptoir authentifié par PIN, sans aucun lien avec `User`/`Role`/JWT.

À bien distinguer dans toute présentation ou synthèse du projet.

---

## 5. Module BOM — Nomenclature de fabrication

C'est le moteur de coût et de production central du projet, générique par construction (validé sur deux personas radicalement différents : boulangerie et bar à cocktails, sans aucun changement de schéma ni de code — règle #50).

### 5.1 Hiérarchie N0/N1/N2+

`BomContext` (regroupement par activité) → plusieurs `BomLevel` (ordonnés, `order` commence à 1) → chaque niveau contient des `BomSheet` (fiches).

- **N1 (order === 1)** = niveau "Ingrédients", **protégé et obligatoire** : impossible à supprimer quel que soit son rang, impossible d'y créer une fiche BOM, impossible d'y produire, jamais utilisable comme sous-produit d'une autre fiche. Toute tentative renvoie `403 FORBIDDEN`.
- **N2+** : seul le niveau d'ordre **maximum** est supprimable (règle héritée fidèlement de V1, `BomNiveauDAL.Delete`) — un niveau intermédiaire ne peut jamais être supprimé tant qu'un niveau supérieur existe. Bloqué aussi si des `BomProduction` y font référence.
- **Règle de hiérarchie des lignes** (`src/lib/bom/validateLine.ts`, `validateSubSheetHierarchy`) : une sous-fiche utilisée en input `SHEET` dans une fiche de niveau N doit être d'un niveau M **strictement inférieur** à N, et jamais de niveau 1.

### 5.2 Calcul de coût récursif — `src/lib/bom/cost.ts`

`calculateBomCost(sheetId, nBatches, prisma, visited)` :
- **Détection de cycle** via `Set<string>` — lève une erreur si `sheetId` déjà visité (capturée en `422 BOM_CYCLE`).
- Ligne `INGREDIENT` : conversion d'unité vers l'unité de stock, × `priceUnit`.
- Ligne `SHEET` : conversion vers l'unité de sortie de la sous-fiche, calcul du nombre de sous-batches nécessaires, **appel récursif** avec une copie du set `visited` (empêche la ré-entrée sur un même chemin mais autorise plusieurs branches parallèles vers la même sous-fiche).
- Retourne coût total et coût unitaire, détaillé ligne par ligne.

### 5.3 FIFO — `src/lib/bom/fifo.ts`

- **`checkAvailability(sheetId, nBatches, prisma)`** — hors transaction, simulation seule (compare le stock dénormalisé `Ingredient.stock` / les agrégats `BomStock.qtyAvailable`). **Commentaire explicite dans le code** : risque TOCTOU, non fiable en environnement concurrent, purement indicatif pour l'UI.
- **`consumeFIFO({sheetId, productionId, nBatches}, tx)`** — **le mécanisme anti-TOCTOU réel**, exécuté dans la transaction Prisma :
  - Relit les `Lot` (tri `purchaseDate ASC`) ou `BomStock` (tri `producedAt ASC`) **frais dans la transaction**.
  - Si insuffisant → `throw`, rollback complet (tout ou rien).
  - Consomme lot par lot du plus ancien au plus récent, décrémente `Lot.quantityAvailable`.
  - **`unitCostAtTime = lot.totalPriceHT / lot.quantityInitial`** — coût réel par unité de base, **jamais** `lot.unitPrice` seul (qui est le prix par conditionnement — bug historique corrigé, règle #38, surestimation d'un facteur = taille du conditionnement).
  - Crée **une `BomProductionLine` par lot réellement touché** (traçabilité fine), décrémente `Ingredient.stock` en cohérence.

### 5.4 Conversion d'unités — deux systèmes parallèles non interopérables

**Constat architectural notable** : deux systèmes de conversion coexistent, chacun cohérent en interne mais avec des unités de base différentes :
- `src/lib/bom/units.ts` (module BOM) — base **G**/**ML**/**PIECE**. `convert()`, `compatibleUnits()`, `formatQty()`.
- `src/lib/constants/units.ts` (module Recettes legacy) — base **KG**/**L**/**PIECE**. `convertToBase()` uniquement.

Pas un bug fonctionnel en soi (chaque module reste cohérent), mais une duplication à connaître pour tout refactor futur.

### 5.5 Workflow de production — `POST /api/v1/bom/sheets/[id]/produce`

Permission `bom.produce`. `stockId` **obligatoire** (contrairement à la vente POS à la demande, jamais stockée) — principe de "discipline de stock" explicite en commentaire de code : toute production manuelle doit déclarer où elle est rangée, exactement comme un achat déclare son `Stock`.

1. Vérifie que l'activité a au moins un stock lié (409 sinon).
2. Vérifie que le `stockId` fourni fait partie des stocks liés à l'activité.
3. Phase 1 (hors TX) : `checkAvailability` → 409 `STOCK_INSUFFICIENT` si manquant. Calcul du coût.
4. Phase 2 (TX) : crée `BomProduction` (coût figé), appelle `consumeFIFO` (re-vérification réelle), crée `BomStock`.

C'est le **seul chemin de production manuelle** de l'application (un commentaire dans `production/page.tsx` le confirme explicitement).

### 5.6 Routes API (`src/app/api/v1/bom/**`)

Contexts (CRUD + création atomique avec niveaux), Levels (CRUD, garde N1/dernier-niveau), Sheets (CRUD, duplication, coût, simulation, production), Lines (CRUD avec validation de hiérarchie), Productions (historique paginé par contexte).

### 5.7 Frontend

**Pages fonctionnelles** : `bom/page.tsx` (liste des contextes), `bom/[contextId]/page.tsx` (2 colonnes niveaux/fiches, N1 avec panneau dédié cadenassé), `bom/[contextId]/production/page.tsx` (Kanban 3 colonnes : sélection/simulation/historique, simulation inline avant confirmation en 2 temps).

**Composants notables** : `BomSheetEditor.tsx` (595 lignes, gestion des lignes en mémoire avant POST atomique — règle #23), sélecteur d'unité auto-restreint au groupe compatible de l'ingrédient/sous-fiche sélectionné (règle #25).

### 5.8 Bug potentiel repéré (à vérifier)

`src/app/api/v1/recipes/[id]/versions/route.ts` sélectionne un champ `costHT` qui **n'existe pas** sur le modèle `RecipeVersion` (qui expose `totalCost`/`costPerServing`) — lèvera probablement une erreur Prisma au runtime si l'endpoint est appelé. Non corrigé au moment de la rédaction de ce dossier.

---

## 6. Module Achats, Ingrédients, Stock, Fournisseurs

### 6.1 Achats — création d'un `Lot`

`POST /api/v1/achats` :
1. Vérifie que `ingredient.packSize` est défini (sinon 422 — la fiche ingrédient doit être complète avant tout achat).
2. Conversion saisie → conditionnements selon `purchaseMode` (`LOT` ou `CONDITIONNEMENT`).
3. `quantityInitial = nbConditionnements × ingredient.packSize`.
4. Normalisation systématique en HTVA (`priceMode: 'TTC'` ⇒ division par `1 + vatRate%`).
5. Transaction : crée le `Lot`, incrémente `Ingredient.stock`.

`PATCH /api/v1/achats/[id]` : `ingredientId` verrouillé après création. Règle v1 explicite préservée : si quantité re-saisie, la **consommation déjà effectuée est préservée** (`newQuantityAvailable = max(0, quantityInitial(nouveau) - consumed)`), le delta répercuté sur `Ingredient.stock`.

`DELETE` : bloqué (409) si le lot a déjà été partiellement consommé — "les données de traçabilité seraient perdues".

### 6.2 Ingrédients

CRUD standard, soft-delete. `DELETE` bloqué par 3 gardes séquentiels : lots avec stock disponible, utilisation dans une `BomLine`, utilisation dans une `RecipeIngredient`.

**Synchronisation tripartite de prix** dans `IngredientSheet.tsx` (formulaire) : prix base ↔ prix conditionnement ↔ prix lot, avec garde anti-récursion (`useRef`).

### 6.3 Stocks (emplacements physiques)

CRUD simple. Pas de `DELETE` exposé (jugé trop risqué sans réimplémentation complète de la garde v1) — `isActive` sert de "soft off".

### 6.4 Fournisseurs

CRUD standard, soft-delete, `address` en JSON structuré.

### 6.5 Vue Stock Global (`vue-stock/page.tsx`)

Tableau de bord de valorisation globale, groupement par emplacement ou par catégorie, avec panneaux de détail par lot au clic.

### 6.6 Écart backend/frontend notable

Les modules **Recettes** et **Fournisseurs** ont un backend API entièrement fonctionnel (CRUD, coût, versioning, cascade) mais leurs pages dashboard (`recipes/page.tsx`, `suppliers/page.tsx`) sont de purs placeholders `<Empty>` — "en développement". Écart à documenter clairement dans toute synthèse de maturité.

---

## 7. Module Recettes (legacy, parallèle au BOM)

Sous-domaine historiquement antérieur au BOM, toujours présent dans le schéma mais **jamais peuplé** par le seed de démonstration (indice fort de son statut "legacy").

- `calculateRecipeCost(ingredients, servings)` (`src/lib/costs.ts`) — synchrone, pure (règle #8), utilise le système d'unités base KG/L (§5.4).
- `recalculateRecipesCascade(tenantId, ingredientId)` — trigger de cascade appelé uniquement quand `priceUnit` d'un ingrédient change (`PATCH /ingredients/[id]`). **Aucun équivalent n'existe pour le BOM** — les coûts BOM sont toujours recalculés à la demande, jamais mis en cache/cascade côté serveur.
- Versioning : chaque `PATCH` sur une `Recipe` crée un snapshot `RecipeVersion` avant modification.
- **Bug BUG-002 (historique, corrigé)** : duplication de recette appelait `calculateRecipeCost` avec des strings au lieu d'objets — TypeError systématique, corrigé.

---

## 8. Module POS (Point de Vente comptoir)

### 8.1 Principe fondamental — révision "vente à la demande" (§0, 2026-07-26)

**Design original (historique, remplacé)** : le POS réutilisait `ProductChannelStock` (canal `DIRECT`), symétrique du canal `VITRINE` de la boutique en ligne.

**Révision réelle livrée**, déclenchée par le scénario d'un vrai patron de bar à cocktails ("Le Shaker") : les recettes POS ne sont **pas** du stock pré-fabriqué mais des **fiches BOM** — une vente doit déclencher une **vraie production en temps réel**, jamais une décrémentation de stock intermédiaire. Citation directe de `docs/modules/POS.md` : *"dans un bar à cocktails, produire d'avance n'a de sens que pour la Boutique Web… au comptoir, chaque commande est unique et doit consommer le stock d'ingrédients au moment exact de la vente."*

Conséquences concrètes :
- `GET /pos/products` calcule la disponibilité en direct via `checkAvailability(bomSheetId, 1, prisma)`.
- `POST /pos/sales` crée une vraie `BomProduction`, appelle `consumeFIFO`, puis crée un `BomStock` avec `qtyAvailable: 0` (produit et vendu dans le même instant, jamais inventorié).
- `PosSaleItem` porte `productionId` (FK) et `unitCost` (snapshot de coût réel, indépendant du prix de vente) — permet un vrai calcul de marge par vente.
- Le canal `DIRECT` est retiré du panneau d'allocation produit (mais l'enum reste toléré en lecture pour les lignes legacy).

**⚠️ Conséquence critique confirmée en scénario réel** (voir §22) : ce modèle **casse totalement** le cas d'usage boulangerie (pain déjà cuit, invendable au comptoir faute de chemin API pour vendre du stock pré-produit).

### 8.2 Authentification PIN — `src/lib/pos/vendeur-auth.ts`

`MAX_ATTEMPTS = 5`, `LOCKOUT_MINUTES = 15`.

- **`isPinTaken(tenantId, pin, excludeVendeurId?)`** — puisque `pinHash` est un hash bcrypt salé, l'unicité ne peut pas être une contrainte DB ; comparaison bcrypt contre chaque vendeur existant (actif **et** inactif).
- **`identifyVendeurByPin(tenantId, pin)`** — boucle sur tous les vendeurs actifs non verrouillés, compare bcrypt jusqu'à trouver une correspondance. **N'incrémente jamais aucun compteur d'échec en cas de non-correspondance** — c'est le chemin utilisé par le pavé PIN principal (`PinPad.tsx`), et c'est aussi **FAILLE-001** de l'audit sécurité (contournement total du lockout, voir §20).
- **`verifyVendeurPin(tenantId, vendeurId, pin)`** — vérifie un vendeur précis, applique réellement le lockout (5 tentatives → 15 min de blocage).
- **Convention HTTP** : échecs PIN toujours en `400`, jamais `401` (évite une collision avec l'intercepteur de rafraîchissement JWT silencieux de `apiClient`, qui doublait les tentatives comptabilisées — bug historique corrigé).

### 8.3 Workflow de vente complet — `POST /api/v1/pos/sales`

1. Validation du body (`posSaleSchema`).
2. `verifyVendeurPin` — re-vérifié serveur systématiquement, indépendamment de l'état "déverrouillé" côté client.
3. Vérifie que la `SessionCaisse` existe, appartient au vendeur, est `OPEN`.
4. Charge les produits demandés (doivent être actifs).
5. **Hors transaction** : `calculateBomCost` par ligne (coût précalculé).
6. **Dans `prisma.$transaction`**, pour chaque ligne : crée `BomProduction`, appelle `consumeFIFO` (re-vérification anti-TOCTOU réelle — si insuffisant, rollback total, tout ou rien), crée `BomStock` (`qtyAvailable: 0`), accumule la ligne de vente (`unitCost` figé, `unitPriceTTC` du produit).
7. Crée `PosSale` + `PosSaleItem[]`.

C'est **le même mécanisme exact** que "lancer une production BOM" manuellement, déclenché implicitement et atomiquement à la caisse.

### 8.4 Cycle de vie caisse

`POST /caisse/open {vendeurId, pin, openingFloat}` → refuse si une session `OPEN` existe déjà pour ce vendeur. `POST /caisse/[id]/close {vendeurId, pin, closingFloat}` → calcule `variance = closingFloat - (openingFloat + Σ ventes cash de la session)`.

### 8.5 Pointage (clock-in/out)

`POST /vendeurs/[id]/clock-in {pin}` / `clock-out {pin}` — un seul pointage ouvert (`clockOut: null`) autorisé à la fois par vendeur.

### 8.6 Frontend

**`pos/caisse/page.tsx`** — écran comptoir consolidé, machine à états : verrouillé (PinPad) → déverrouillé sans session → session ouverte (grille produits + panier) → clôture. Décrémentation optimiste du badge de disponibilité au clic (règle #39), sans attendre le round-trip réseau.

**`pos/historique/page.tsx`** — 3 onglets (Ventes/Caisse/Pointages) sur une seule page.

**Consolidation UX documentée** : les pages séparées `/pos/vente` et `/pos/pointage` ont été supprimées suite au feedback utilisateur *"trop d'étapes séparées avant de pointer des ventes"* — tout fusionné dans `/pos/caisse`. Le pavé PIN identifie sans présélection de vendeur (`identifyVendeurByPin`), l'identité reste "déverrouillée" en mémoire React (jamais persistée) le temps d'une vente.

---

## 9. Module Équipe

Écran unifié `/settings/team` (3 onglets, un seul écran) — pas de schéma nouveau nécessaire : les modèles `User`/`Role`/`UserInvitation`/`Vendeur` existaient déjà et fonctionnaient ; le vrai gap était purement frontend (page 404, lien d'invitation cassé).

1. **Collaborateurs** — `User`s du dashboard, invitation par email (mot de passe choisi par l'invité, jamais connu de l'admin), rôle assignable inline, activation/désactivation (auto-désactivation bloquée).
2. **Vendeurs POS** — les entités `Vendeur` (PIN comptoir, absorbées depuis l'ancienne page `/pos/vendeurs`), reset de PIN, outil "Tester le PIN".
3. **Rôles** — CRUD sur `Role` avec éditeur de permissions par cases à cocher groupées par module (`PERMISSION_GROUPS`). Suppression désactivée côté UI si le rôle a des utilisateurs assignés ou est `isSystem` — **mais aucune garde équivalente côté serveur** (FAILLE-009).

**⚠️ Faille de sécurité majeure confirmée (FAILLE-003/006, critique/élevée)** : aucune vérification n'empêche un titulaire de `team.manage` de s'auto-promouvoir (ou de promouvoir un tiers) au rôle Admin `isSystem`, via `PATCH /api/v1/users/[id]` ou lors d'une invitation. Voir §20.

---

## 10. Module Boutique en ligne (storefront) & CMS

### 10.1 Principe de conception

**"Le stock est la vérité"** — seul ce qui existe physiquement en stock peut être publié, le storefront reflète l'état quasi temps réel. Contrairement au POS, la boutique en ligne modélise du **stock pré-produit et alloué** (`ProductChannelStock`, canal `VITRINE`).

### 10.2 Décisions de conception verrouillées (2026-07-24)

1. `OrderItem.vatRatePercent` = **snapshot figé** au moment de la commande, indépendant de tout changement ultérieur de `TenantVatRate`.
2. Clôture de périssable : granularité par canal, scindable en plusieurs lignes si le devenir des unités restantes est mixte.
3. Conflit de stock au webhook Stripe : la commande est créée quand même mais en statut dédié `STOCK_CONFLICT` — jamais de remboursement automatique ni de correction silencieuse (paiement déjà capturé).

### 10.3 Pages storefront publiques (`src/app/storefront/[tenantSlug]/`)

Hors segment `[locale]`, sans i18n ni auth. `layout.tsx` (server) vérifie `config.isPublished`, sinon `notFound()`. `catalog/` (grille produits, badge rupture de stock), `cart/` (Zustand persisté localStorage), `checkout/` (formulaire client + créneau de retrait + CGV), `order/pending/` (spinner 3s puis succès statique — ne vérifie rien lui-même, le webhook fait le vrai travail), `order/[trackingToken]/` (suivi public par token opaque, refetch 30s).

**Route manquante repérée** : le header (`StorefrontHeader.tsx`) génère des liens vers `/page/[slug]` (pages CMS) mais **aucun fichier de route correspondant n'existe** — ces liens de nav donnent un 404.

### 10.4 CMS — état réel

Backend complet : CRUD de pages (`Page.blocks` en Json), sanitisation `DOMPurify` sur les blocs `CUSTOM_HTML`/`TEXT` (seul point explicite de mitigation XSS du CMS), publication globale (`SiteConfig.isPublished`).

**⚠️ Le CMS est backend-only** : la page admin `/cms` est un pur stub `<Empty>` — aucun éditeur drag & drop n'a jamais été implémenté (malgré `@dnd-kit` en dépendance), et la route publique de rendu (`/page/[slug]`) n'existe pas non plus. Aujourd'hui, un tenant ne peut personnaliser que `SiteConfig` (logo/couleurs/polices/template), pas construire de pages de contenu arbitraires.

**Incohérence de code repérée** : `site-config/route.ts` définit un schéma `templateChangeSchema` mort (`boulangerie/patisserie/traiteur`) jamais utilisé, tandis que la vraie route `site-config/template/route.ts` utilise une liste différente (`artisan/modern/classic/minimal`).

### 10.5 Publication d'un produit — workflow complet

1. Stock produit via le moteur BOM (`BomStock` confirmé).
2. Admin ouvre `ProductPublishSheet`, choisit une `BomSheet`, prix HT, taux TVA.
3. `POST /api/v1/products` — gate de **producibilité** (`checkAvailability`, pas existence de stock déjà produit — révisé pour coller au modèle POS à la demande, règle #36).
4. Produit créé mais **pas encore vendable en ligne** (0 `ProductChannelStock`).
5. `ProductAllocationPanel` — alloue une quantité d'un `BomStock` précis entre `VITRINE`/`DIRECT`, re-validée serveur contre le vrai `qtyAvailable` moins tout ce qui est déjà alloué tenant-wide.
6. Produit désormais achetable en ligne.

---

## 11. Commandes, Facturation, TVA, Stripe

### 11.1 Cycle de vie de commande — `src/lib/constants/order-status.ts`

Machine à états stricte (`VALID_TRANSITIONS`) :

| De | Vers |
|---|---|
| NEW | CONFIRMED, CANCELLED |
| CONFIRMED | IN_PREPARATION, CANCELLED |
| STOCK_CONFLICT | CONFIRMED, CANCELLED |
| IN_PREPARATION | READY, CANCELLED |
| READY | PICKED_UP, CANCELLED |
| PICKED_UP / CANCELLED | *(terminal)* |

`STOCK_CONFLICT` n'est **jamais** atteint via une transition admin — uniquement posé par le webhook Stripe ; l'admin le résout ensuite manuellement vers `CONFIRMED` ou `CANCELLED`. Passage à `READY` déclenche `sendOrderReadyEmail` (best-effort, non bloquant).

### 11.2 Paiement — Stripe Connect Express, modèle "destination charge"

`createCheckoutSession()` crée une session **au nom du compte connecté** du tenant (`{stripeAccount: stripeAccountId}`), avec `application_fee_amount` = **2% de frais de plateforme** prélevés sur chaque vente, le reste transféré directement au compte Stripe du tenant (`transfer_data.destination`).

### 11.3 Webhook — point d'écriture unique de la commande

`POST /api/webhooks/stripe` (pas de JWT, vérifié par signature Stripe uniquement). Idempotence via `AuditLog` (`entityId = event.id`, court-circuite les doublons). `handleCheckoutCompleted` :
1. Upsert `Customer`.
2. Re-calcule les prix depuis l'état **courant** des produits/taux TVA (pas les valeurs au moment de l'ajout au panier).
3. Dans une transaction : `consumeChannelStockOrFlagConflict` (re-vérification FIFO fraîche, tout ou rien) **avant** de créer la commande — si insuffisant, statut `STOCK_CONFLICT` mais la commande est créée quand même (paiement déjà capturé, jamais de remboursement auto).
4. `sendOrderConfirmationEmail` (best-effort) après commit.

C'est le **seul endroit** où une `Order` storefront est créée — la route `checkout/route.ts` ne fait que créer la session Stripe.

### 11.4 `consumeChannelStockOrFlagConflict` — `src/lib/products/channel-stock.ts`

Consomme `ProductChannelStock` en FIFO (tri par `bomStock.producedAt`), tout ou rien à l'échelle de la commande complète. Distinct du FIFO du module BOM (domaine différent : stock alloué par canal vs stock ingrédient).

### 11.5 Facturation

`POST /api/v1/invoices/generate/[orderId]` — génère une facture réelle : construit le détail HT/TTC par ligne à partir du **snapshot figé** `OrderItem.vatRatePercent` (jamais re-lu depuis le produit courant), `buildVatBreakdown` calcule les sous-totaux par taux, numérotation séquentielle (`FACT-YYYY-XXXX`).

**⚠️ Limitation documentée non résolue** : `generateInvoicePdf()` (`src/lib/pdf.ts`) retourne en réalité un buffer **HTML**, pas un vrai binaire PDF — servi avec un header `Content-Type: application/pdf` trompeur. Le commentaire du code lui-même reconnaît la limitation ("en prod, remplacer par Puppeteer/WeasyPrint/pdfmake" — jamais fait).

**BUG-001 (historique, confirmé corrigé)** : `pdf.ts` référençait `line.baseHT`/`line.vatAmount` alors que `VatBreakdownLine` expose `base`/`amount` — produisait `NaN` sur tous les montants TVA. Vérifié corrigé dans le code actuel.

**⚠️ Écart backend/frontend majeur** : le backend de facturation est **entièrement fonctionnel** (génération, liste, détail, export PDF) mais la page admin `/invoices` est un pur stub `<Empty>` "en cours de construction" — aucune UI pour déclencher la génération, pas de bouton, pas de lien de téléchargement nulle part. C'est l'exemple le plus net de décalage backend/frontend du projet (règle #52).

### 11.6 TVA — deux systèmes parallèles

`src/lib/utils/vat.ts` (legacy, centré sur l'enum `VatRate` fixe — utilisé uniquement par le module Achats aujourd'hui) vs `src/lib/costs.ts` (`calculatePriceTTC/HT`, `calculateVatAmount` — agnostique au taux, utilisé par tout le flux Boutique/Produits/Commandes migré vers `TenantVatRate`). `buildVatBreakdown()` (dans `vat.ts` malgré le nom du fichier) est la fonction réellement consommée par le flux Facture/Commande.

### 11.7 Incohérence potentiellement bloquante repérée

`checkoutSchema` (`src/lib/validators/order.ts`) exige `cgvAccepted: z.literal(true)`, mais le payload réellement envoyé par `checkout/page.tsx` ne semble **jamais inclure ce champ** (seulement un booléen local `cgv` validé côté client par un schéma différent) — pourrait faire échouer systématiquement la validation Zod serveur (`400 VALIDATION_ERROR`) sur un vrai checkout. **Non vérifié plus loin, à confirmer avant de considérer ce flux fiable en production.**

---

## 12. Vue Flux (widget Hub)

### 12.1 Principe — agrégation en lecture pure, zéro champ stocké dédié

Documenté explicitement dans `docs/modules/FLUX.md` : un tableau associe chaque champ d'une maquette de référence à sa réalité en base — systématiquement **calculé à la volée**, jamais stocké :
- Regroupement stocks par activité → dérivé de la jointure N:N `ActiviteStock`.
- Alerte de stock par emplacement → dérivée via `Lot.stockId → Ingredient.alertThreshold`.
- Canal actif (POS/Boutique) par activité → dérivé via `Product.bomSheetId → BomSheet.level.context.activiteId`, filtré par `ProductChannelStock.qtyRemaining > 0` — **jamais un simple toggle stocké**, décision architecturale délibérée anti-fraude (le graphe ne peut pas "mentir" sur un canal ouvert).

### 12.2 Endpoint — `GET /api/v1/activites/[id]/flow-summary`

Permission `flow.read`. Agrège en une réponse : alertes stock par emplacement lié, nombre de fiches BOM actives, résumé par canal (POS/Boutique — produits + quantité restante), sessions caisse ouvertes (**tenant-wide, pas scopées à l'activité** — `Vendeur`/`SessionCaisse` n'ont aucun lien avec `Activite` en base).

### 12.3 Composant — `src/components/flux/FlowCanvas.tsx`

Rendu SVG maison (courbes de Bézier reliant 4 nœuds : stocks/activité/pos/boutique), drag & drop implémenté à la main via Pointer Events (pas de librairie DnD), position **non persistée** (réinitialisée au rechargement, bouton "Réorganiser").

**Bug historique corrigé (règle #33)** : le panneau latéral était initialement en `flex` (rétrécissait le canvas à l'ouverture), ce qui déplaçait les éléments sous le curseur entre les deux clics d'un double-clic et empêchait sa détection. Corrigé en passant le panneau en `position: absolute` (overlay).

### 12.4 Historique d'implémentation — auto-critique documentée (règle #34)

La première version était un écran dédié (`/flux`, entrée de nav propre) avec un layout statique **sans** drag & drop. L'utilisateur a rejeté les deux choix après avoir vu le résultat : le widget a été intégré au Hub/Dashboard (écran et entrée de nav dédiés supprimés), et le vrai drag & drop réintroduit car silencieusement abandonné du brief original. Cet épisode est explicitement cité dans le journal comme leçon : ne jamais réduire silencieusement la portée d'une fonctionnalité actée au brainstorm sans le signaler d'abord.

---

## 13. Dashboard

`dashboard/page.tsx` — en-tête de salutation, bandeau de 4 KPI (commandes du jour, CA du jour, CA du mois, alertes stock), 2 colonnes (dernières commandes / alertes stock), widget Vue Flux conditionnel (`can('flow.read') && activite`).

**Routes API** (`src/app/api/v1/dashboard/*`, `withAuth` uniquement) :
- `kpi/route.ts` — 5 requêtes en parallèle (`Promise.all`) : commandes/CA du jour, CA du mois, alertes stock (SQL brut), 5 dernières commandes.
- `recent-orders/route.ts` et `revenue/route.ts` (séries temporelles jour/mois) — **routes existantes mais actuellement non consommées par la page** — probablement destinées à une future vue graphique.
- `stock-alerts/route.ts` — SQL brut, triée par criticité (`stock - alertThreshold` ascendant), limite 20.

---

## 14. Paramètres (Settings)

### 14.1 Page racine `/settings`

Card "Compte" (activation/désactivation tenant, avec garde métier bloquant si des `BomContext` actifs ou du stock d'ingrédients actif existent), Card "Taux de TVA" (CRUD `TenantVatRate`), **bandeau stub explicite** annonçant que le reste du module ("facturation/notifications/intégrations" évoqués dans la description) est en développement, et la "Danger Zone" (flush de données de test).

### 14.2 Flush de données de test — `src/lib/settings/flush-data.ts`

Mécanisme de suppression sélective **tenant-scopée**, distinct du script `scripts/flush-db-local.ts` (qui tronque toutes les tables toutes tenants confondus, local uniquement). Ne touche jamais `User`/`Role`/`Tenant`/`Session`.

6 catégories (`pos`, `commandes`, `recettes`, `produits`, `achats`, `stocks`), une seule liste `GLOBAL_STEPS` ordonnée selon les contraintes FK `onDelete: Restrict` du schéma (ex. `bomLine` avant `bomSheet`/`bomContext` pour lever les FK auto-référentielles).

**Garde-fous** : confirmation obligatoire par saisie exacte du nom du tenant (revérifiée côté serveur, jamais fait confiance au seul contrôle client), exécution dans une transaction unique avec un `AuditLog` (atomicité garantie), gestion explicite des violations de contrainte FK (`409 DEPENDENCY_CONFLICT`, rollback total).

---

## 15. Modules stubs / non implémentés

Constat blunt, issu d'une lecture directe des fichiers de page :

| Page | Backend | Frontend | État réel |
|---|---|---|---|
| `devis/page.tsx` | ❌ Aucune route `/api/v1/devis` | Placeholder `<Empty>` | **Totalement inexistant**, front et back |
| `planning/page.tsx` | ❌ Aucun backend | Placeholder `<Empty>` | **Totalement inexistant** |
| `mouvements/page.tsx` | ❌ Aucun backend | Placeholder `<Empty>` | **Totalement inexistant** (nécessiterait une agrégation de `Lot`/`BomProduction`/`BomStock`, jamais construite) |
| `invoices/page.tsx` | ✅ API complète et fonctionnelle | Placeholder `<Empty>` | **Backend prêt, UI totalement absente** — cas le plus net de décalage arrière/avant du projet |
| `cms/page.tsx` | ✅ CRUD pages + sanitisation | Placeholder `<Empty>` | Backend prêt, aucun éditeur visuel jamais construit |
| `recipes/page.tsx`, `suppliers/page.tsx` | ✅ CRUD complets | Placeholder `<Empty>` | Backend prêt, UI dashboard absente |

**Upload de fichiers — également un stub déguisé** : `src/app/api/v1/upload/{image,logo}/route.ts` valide, redimensionne (`sharp`) et ré-encode réellement les images, mais **ne les persiste jamais nulle part** — retourne une URL `mockUrl`/`logoUrl` fabriquée (`https://cdn.artisastock.be/...`) qui ne sert rien. Pire : la route logo **écrit cette URL fictive** dans `SiteConfig.logo` en DB, comme si l'upload avait réussi.

**GDPR — module intake-only** : `POST /api/v1/gdpr/requests` et la route publique équivalente créent bien des `GdprRequest` en base (`status: PENDING`), avec une défense anti-énumération d'email correcte (réponse `201` identique que l'email existe ou non). Mais **aucune route `[id]` n'existe** pour faire évoluer le statut d'une demande — aucun chemin de code pour marquer une demande traitée, ni pipeline automatisé d'export/anonymisation. Gap réel de conformité.

---

## 16. Système UI (Design System)

### 16.1 Composants (`src/components/ui/**`, barrel `index.ts`)

15 composants : `Btn` (variantes via `cva`), `Input`, `Select`, `Field`, `Pill` (badges de statut, tons), `StatusPipeline` (stepper de workflow), `SmartButton`, `KpiCard`, `ViewToggle`, `Tabs`, `Card`, `DataTable`, `Toolbar`, `Crumb`, `Empty`.

**Pattern récurrent** : plusieurs composants (`Pill`, `KpiCard`, `SmartButton`, `StatusPipeline`) définissent un type `Tone` union + une `Record<Tone,string>` de classes indexée par prop — convention de style cohérente réutilisée dans tout le design system plutôt que de la logique conditionnelle par composant.

**`DataTable`** — tri à 3 états par colonne (asc → desc → ordre original → asc, via `sortable`/`sortValue`), ajouté après coup de façon purement additive (règle #41).

### 16.2 `cn()` et le piège `tailwind-merge` (règle #17)

`extendTailwindMerge()` enseigne à `tailwind-merge` les échelles custom du projet (`text-erp-*`, `rounded-rx-*`, `shadow-sh-*`) — sans cette extension, `text-erp-sm` et une couleur `text-[#hex]` se percutaient silencieusement (texte invisible en prod).

### 16.3 Palette réelle vs documentée

`docs/UI-DESIGN.md` documente une palette orange/vert générique, **obsolète** — le code réel (`tailwind.config.ts`) utilise une palette de marque "Charles & Nadejda" : `choco` (chocolat), `or` (doré), `framboise` (rouge CTA), `creme` (fond crème), nommée d'après les artisans réels à l'origine du projet.

---

## 17. Internationalisation (i18n)

`next-intl`, locales `['fr', 'nl']`, préfixe toujours présent (`localePrefix: 'always'`). Storefront volontairement hors i18n (§2.5).

**Couverture réelle limitée** : `messages/fr.json` et `messages/nl.json` ne comptent que **67 clés** au total sur 6 namespaces (`common`, `nav`, `storefront`, `auth`, `admin`, `errors`) — structurellement identiques entre les deux langues (zéro clé divergente), mais très en retrait par rapport à la surface réelle de l'ERP (BOM, POS, Équipe, Achats — aucune de ces zones n'a de clés de traduction dédiées). Suggère que l'essentiel de l'UI ERP utilise des chaînes françaises codées en dur plutôt que `next-intl`, et que le support NL est un squelette minimal.

---

## 18. Tests et qualité

### 18.1 Répartition (`tests/**`)

- **Unitaires** (9 fichiers) : coût BOM, unités BOM, coûts recettes/TVA, formatage, statuts commande, slugs, validateurs auth/ingrédients.
- **Intégration** (3 fichiers) : cycle JWT complet (y compris rejet de signature altérée), cascade de recalcul de coût, **isolation multi-tenant**.
- **E2E Playwright** (2 fichiers, `auth.spec.ts` + `order-flow.spec.ts`) — **non exécutables actuellement** : `@playwright/test` absent des dépendances, aucun `playwright.config.ts`, aucun script `test:e2e`. Rédigés comme spécification à câbler plus tard, pas comme porte CI active.

### 18.2 Limite de fiabilité documentée (FAILLE-011, sécurité)

`tests/integration/tenant-isolation.test.ts` n'exerce pas le vrai mécanisme `getPrismaWithTenant()` — le `where.tenantId` est injecté manuellement par le test lui-même, donnant une **fausse confiance de couverture**.

### 18.3 Configuration

`vitest.config.ts` : couverture v8 scopée à `src/lib/**` (exclut les wrappers de service externe), seuils 70% lignes/fonctions, 60% branches — non mesurés/appliqués automatiquement en l'absence de CI.

---

## 19. Outillage, scripts, déploiement

### 19.1 Scripts npm

`dev`/`build`/`start`/`lint`/`typecheck`, `db:generate`/`db:migrate`/`db:push`/`db:seed`/`db:studio`, `test`/`test:unit`/`test:integration` (pas de `test:e2e`).

### 19.2 Scripts de maintenance (`scripts/**`)

Pattern récurrent documenté : script Prisma/TS écrit pour le dev local, puis **porté à la main en SQL brut idempotent** pour la prod, parce que le sandbox de développement ne peut pas atteindre la vraie `DATABASE_URL` (règle #32). Exemples : `backfill-flow-permission.ts`/`.sql`, `backfill-pos-permissions.ts`/`.sql`, `flush-db-local.ts` (garde de sécurité : refuse de s'exécuter si l'hôte n'est pas `localhost`), `pos-schema-migration.sql`, `prod-schema-catchup-2026-07-27.sql` (script transactionnel de rattrapage de dérive de schéma, le plus lourd du repo — voir §2.2).

### 19.3 Absence de CI

Aucun `.github/workflows/`, aucune configuration CI trouvée nulle part — tous les contrôles qualité sont manuels et locaux à ce jour.

---

## 20. Sécurité — Audit complet

Source : `docs/SECURITY-AUDIT.md` (2026-08-09), méthode : 5 agents en parallèle guidés par le graphe de connaissances Graphify (god nodes, communautés denses). **Statut : audit uniquement, zéro correctif appliqué au moment de la rédaction de ce dossier.**

### 20.1 Critique (🔴)

| ID | Titre | Fichiers | État |
|---|---|---|---|
| **FAILLE-001** | Contournement total du lockout PIN — `identifyVendeurByPin` (chemin par défaut du pavé PIN) n'incrémente jamais `failedPinAttempts`, permettant un brute-force illimité des 10 000 PIN à 4 chiffres | `src/lib/pos/vendeur-auth.ts`, `pos/vendeurs/verify-pin/route.ts` | **Ouvert** |
| **FAILLE-002** | `JWT_SECRET` fail-open — `?? ''` au lieu d'un throw au démarrage si absent | `src/middleware.ts:103` | **Ouvert** |
| **FAILLE-003** | Élévation de privilège par auto-promotion — `PATCH /api/v1/users/[id]` ne vérifie jamais que le `roleId` cible reste dans le périmètre de permission de l'appelant ; seule l'auto-désactivation est bloquée | `src/app/api/v1/users/[id]/route.ts` | **Ouvert** |

### 20.2 Élevé (🟠)

| ID | Titre |
|---|---|
| **FAILLE-004** | Aucun rate-limiting sur les routes d'authentification (login/register/forgot-password/reset-password) |
| **FAILLE-005** | Logos SVG uploadés stockés bruts (contrairement aux formats raster ré-encodés via `sharp`), MIME lu depuis `file.type` déclaré côté client — potentiel XSS stocké |
| **FAILLE-006** | Même défaut que FAILLE-003 sur le chemin d'invitation (`roleId` optionnel non contrôlé) |

### 20.3 Moyen (🟡)

FAILLE-007 (révocation de session illusoire — `withAuth` seul ne vérifie jamais l'existence DB de la session), FAILLE-008 (fenêtre non atomique webhook Stripe — écriture d'idempotence hors transaction de commande), FAILLE-009 (rôle `isSystem` non protégé contre modification/suppression), FAILLE-010 (pas de garde anti-auto-verrouillage — rien n'empêche de désactiver tous les autres comptes admin un par un), FAILLE-011 (test d'isolation tenant qui ne teste pas le vrai mécanisme, fausse confiance), FAILLE-012 (DoS/CPU — `identifyVendeurByPin` boucle `bcrypt.compare` sur tous les vendeurs actifs, non throttlé, combiné à FAILLE-001).

### 20.4 Faible / dette (🟢)

FAILLE-013 (`jwt.verify` sans allowlist d'algorithme explicite), FAILLE-014 (pas de détection de réutilisation de refresh token), FAILLE-015 (incohérence architecturale — plusieurs routes utilisent le client Prisma brut au lieu de `getPrismaWithTenant()`, voir §2.4).

### 20.5 Points confirmés sains (aucun correctif nécessaire)

Vérification de signature webhook Stripe, montants de commande toujours recalculés serveur (jamais confiance au client), isolation tenant Stripe Connect correcte, requêtes SQL brutes systématiquement tenant-filtrées via templates taggés (jamais de `$queryRawUnsafe`), hachage bcrypt coût 12, anti-énumération sur `forgot-password`, vérification JWT Edge via `crypto.subtle` correcte, mécanisme central `getPrismaWithTenant()` solide, sécurité du token `accept-invite`.

### 20.6 Priorité de correction recommandée (telle que documentée)

1. FAILLE-001 (bypass lockout PIN — exploitable trivialement, en prod)
2. FAILLE-003 + FAILLE-006 (élévation de privilège RBAC — une seule garde de rang corrige les deux)
3. FAILLE-002 (JWT_SECRET fail-open — un throw au démarrage suffit)
4. FAILLE-005 (XSS SVG)
5. FAILLE-004 (rate limiting — effort d'infra plus lourd)
6. Reste du moyen/faible, sans urgence

---

## 21. QA — Bugs historiques

Source : `docs/QA-REPORT.md` (2026-07-14).

- **BUG-001 (critique, corrigé)** — champs `baseHT`/`vatAmount` inexistants dans `pdf.ts` vs `base`/`amount` réels de `VatBreakdownLine` → `NaN` sur tous les montants TVA des factures. Vérifié corrigé dans le code actuel.
- **BUG-002 (critique, corrigé)** — duplication de recette appelait `calculateRecipeCost` avec des strings au lieu d'objets typés → `TypeError` systématique. Corrigé.
- **BUG-003 (mineur, non corrigé)** — champ `totalTTC` inutilisé transmis à `buildVatBreakdown()`, inoffensif mais à nettoyer.
- **BUG-004 (mineur, corrigé plus tard, session du 2026-07-16)** — le frontend proposait une transition `NEW → CONFIRMED` que le backend ne reconnaissait pas au moment du rapport QA ; aligné depuis.

---

## 22. Scénarios de test réels (personas)

### 22.1 Boulangerie (`docs/SCENARIO-BOULANGERIE.md`, 2026-08-09, test live en navigateur sur prod)

| Sous-scénario | Verdict |
|---|---|
| Patron — fiches ingrédients/recettes (BOM) | ✅ Fonctionne globalement |
| Étudiants — fiches techniques journalières | ⚠️ Gap fonctionnel, pas de contournement propre |
| Vendeuses — vente comptoir depuis stock produit | ❌ **Incompatibilité architecturale confirmée** |
| Boutique en ligne — commande J-1, stock réservé | ❌ **Totalement inaccessible, bug de déploiement confirmé** |

**Le cas critique #3** : la révision "vente à la demande" du POS (§8.1) rend **littéralement invendables au comptoir** des pains déjà cuits et en stock — le picker de publication produit (`GET /bom/sheets?hasStock=true`) ne liste que les fiches producibles immédiatement à partir du stock d'ingrédients bruts, jamais les fiches ayant déjà du stock produit. Vendre un produit publié déclenche une **re-fabrication automatique en temps réel**, sans jamais toucher aux pains déjà cuits. Deux pistes de correction proposées : réintroduire le canal `DIRECT` pré-produit (jamais réellement supprimé du schéma), ou rendre le mode configurable par produit/activité.

**Le cas critique #4** : `/storefront/[tenantSlug]/catalog` renvoie 404 même avec `isPublished: true` confirmé côté API. Cause isolée : `layout.tsx` fait un `fetch` serveur-à-serveur avec un fallback `http://localhost:3000` si `NEXT_PUBLIC_APP_URL` est absent en prod — échoue silencieusement (`try/catch → null → notFound()`). L'API elle-même répond parfaitement en appel direct navigateur. **Conséquence : aucun client ne peut atteindre la boutique d'aucun tenant aujourd'hui**, alors même que le module est documenté "terminé, 12/12 étapes".

Règles ajoutées au journal : #46 à #49.

### 22.2 Traiteur événementiel cocktails (`docs/SCENARIO-TRAITEUR-COCKTAILS.md`, 2026-08-09)

| Zone testée | Verdict |
|---|---|
| Moteur BOM appliqué aux cocktails | ✅ Fonctionne sans aucune adaptation |
| Devis personnalisé événementiel | ❌ Inexistant — stub pur |
| Facturation à lignes libres (personnel, location) | ❌ Inexistant — module entier stub |
| Formule de dotation en personnel par nombre d'invités | ❌ Inexistant — aucun modèle de données |
| Location de matériel (verres) | ❌ Inexistant — modèle de stock incompatible avec un cycle prêt/retour |

**Ce qui fonctionne** : création réelle de 7 ingrédients spiritueux/mixers, achats réels au cl, fiche BOM "Negroni" construite et confirmée exactement comme une recette de pain — **confirme la généricité totale du moteur BOM**, aucun changement de schéma/code nécessaire pour changer de persona du tout au tout (boulangerie → bar à cocktails).

**Verdict explicite du rapport** : *"Ce n'est pas un bug à corriger : c'est un module à concevoir et construire entièrement"* — suit la méthodologie du projet (cascade de brainstorms avant tout code).

Règles ajoutées au journal : #50 à #53.

### 22.3 Workflow Complet (`docs/SCENARIO-WORKFLOW-COMPLET.md`, 2026-07-26)

**Nature importante à noter** : contrairement aux deux scénarios précédents, ce document est un **script de test à exécuter manuellement** (12 phases, checklist), pas un rapport de résultats — toutes les cases sont vides au moment de la rédaction de ce dossier. Il documente la couverture de test *prévue*, pas des résultats confirmés.

---

## 23. Lignée V1 → V2 (contexte académique)

Documentation dédiée : `docs/Traduction V1/` — un tunnel documentaire entre deux instances Claude Code parallèles (une sur `charlesnadejda-project`/V1 en lecture seule, une sur `artisastock-v2` en implémentation), structuré selon le circuit utilisateur réel du script de défense d'examen V1 (scénario Bar/Long Island Ice Tea).

### 23.1 Architecture V1

C# WinForms desktop (Single-Form Architecture) + storefront Laravel B2C + MySQL partagé (20 tables + 1 vue + 22 migrations v04→v22). 48 fichiers `.cs`, 15 DAL, 80+ routes Laravel implicites, ~33 fonctionnalités majeures, 30+ règles métier.

### 23.2 Rôles V1 — un contraste frappant

**V1 n'a qu'un seul rôle : ADMIN.** Aucune granularité RBAC — tout le back-office WinForms est gated par `role='admin'` uniquement (vs `role='client'` pour un compte boutique). V2 introduit un système de permissions à 33 clés / 14 modules — un des sauts qualitatifs les plus marquants entre les deux versions.

### 23.3 Pattern transversal Fiche vs Instance

Documenté explicitement (`15-reference-pattern-fiche-instance.md`) — deux paires structurellement identiques :

| | Fiche (classe/définition) | Instance |
|---|---|---|
| Ingrédient | `fiches_ingredients` | Lot d'achat |
| Recette BOM | `bom_fiches` | Production réalisée (`bom_stocks`) |

**L'asymétrie critique** : un `Lot` se crée librement via un formulaire dédié — une déclaration utilisateur de "ce que je possède physiquement". Un `BomStock` (V1) **n'a jamais eu de chemin de création manuelle** — aucun formulaire, aucune méthode `Insert()` n'existe ; il ne peut être écrit qu'en effet de bord à l'intérieur de l'exécution d'une production, avec quantité/coût/date tous dérivés/calculés, jamais saisis librement. Cela garantit qu'aucun stock de produit fabriqué de toutes pièces ne peut exister sans production traçable.

**Recommandation V1 → V2 explicitement retenue** : ne jamais exposer une route générique `POST /api/v1/bom/stocks` — le seul chemin d'écriture doit rester la route d'exécution de production, exactement comme en V1. (Vérifié respecté dans le code V2 actuel — `BomStock` n'est créé que par `bom/sheets/[id]/produce` et par la vente POS à la demande.)

### 23.4 14 règles métier "à ne pas oublier en V2"

Tous les niveaux insérés atomiquement à la création du contexte ; aucun niveau protégé par son rang (seul le dernier niveau créé est supprimable) ; niveau N ne consomme que M<N ; exclusivités mutuelles (ingrédient XOR fiche, lot XOR bom_stock) ; détection de cycle ; FIFO strict ; double vérification anti-TOCTOU ; coûts figés au moment de la production (jamais recalculés rétroactivement) ; snapshot de prix sur les lignes de commande ; stock jamais négatif ; dénormalisation intentionnelle de certains champs ; 1 produit web par fiche BOM (unique) ; seuil d'alerte calculé dynamiquement (jamais stocké).

### 23.5 Corrections documentaires apportées en cours de route

Un audit initial (`V1-FEATURE-AUDIT.md`) contenait deux inexactitudes corrigées ensuite par lecture directe du code source V1 : (1) il n'existe pas de "niveau N0 protégé" en V1 — `ordre` commence à 1, aucun niveau n'est protégé par son rang ; (2) `ActiviteDAL.Delete` (suppression physique) n'est **pas** protégé en cascade malgré sa documentation XML — la FK `bom_contextes→activites` est `RESTRICT`, pas `CASCADE` ; le chemin sûr est `Desactiver()`.

---

## 24. Règles apprises (Journal — 53 règles, organisées par thème)

> Source : `docs/JOURNAL.md`, table "Règles apprises". Note : le tableau source contient un doublon de numérotation (deux entrées portant le numéro 9) — reproduit tel quel, ce n'est pas une erreur de synthèse.

### Sécurité & contrôle d'accès

- **#1** — Prisma `$extends` pour injection `tenantId` — jamais de filtre manuel répété.
- **#4** — `withPermission` extrait tenantId/userId des headers injectés par le middleware.
- **#22** — Signature réelle de `withPermission`/`withAuth` = `(request, permission?, handler)` — plusieurs routes legacy jamais migrées, cassées depuis le début.
- **#43** — Un paramètre de garde de sécurité optionnel (ex. `vendeurId` facultatif) ne doit jamais désactiver la protection principale (lockout anti-brute-force) — un chemin alternatif doit hériter des mêmes garde-fous.
- **#44** — Jamais de fallback silencieux (`?? ''`) sur un secret d'environnement — doit crasher le démarrage.
- **#45** — Une permission de gestion d'équipe ne doit jamais permettre d'assigner un rôle de rang supérieur au sien — comparer le rang cible au rang appelant avant toute écriture.

### Modèle de données / discipline de stock / BOM

- **#13** — N0/niveaux créés atomiquement à la création du contexte.
- **#14** — Détection de cycle BOM via `Set<string>` visited.
- **#15** — *(obsolète, remplacée par #26)* FIFO MVP décrémentait seulement `Ingredient.stock`.
- **#16** — Unités MG/CG/CL/DL ajoutées pour le BOM.
- **#19** — Les champs `Decimal` Prisma sérialisent en **string** en JSON — toujours `Number(...)` avant calcul.
- **#24** — N1 est un niveau structurel protégé, distinct de la règle "dernier niveau supprimable" des N2+.
- **#25** — Unité de ligne BOM toujours reprise automatiquement de l'ingrédient/sous-fiche sélectionné.
- **#26** — FIFO doit traiter symétriquement les lignes `INGREDIENT` et `SHEET`, sinon la hiérarchie N1→N2→N3 ne consomme jamais le stock produit d'une sous-fiche.
- **#29** — `Ingredient.stock` dénormalisé n'a de sens que si un vrai `Lot` existe derrière — jamais de `stock: N` en seed sans `Lot` correspondant.
- **#35** — Un canal de vente à la demande doit calculer la disponibilité en direct et déclencher une vraie production/FIFO à la vente, coût snapshoté indépendamment du prix de vente.
- **#36** — Un gate de publication doit vérifier la **producibilité**, pas l'existence de stock déjà produit.
- **#38** — `unitCostAtTime` doit être un coût par unité de base (`totalPriceHT / quantityInitial`), jamais le prix par conditionnement seul.
- **#40** — `BomStock` doit avoir un lien vers un `Stock` physique, comme `Lot.stockId` — même discipline pour tout ce qui est produit, pas seulement acheté.
- **#47** — Un modèle "à la demande" n'est valable que pour une fabrication en quelques secondes/minutes — pour une production longue non parallélisable à la vente, le stock déjà produit doit rester vendable ; jamais un canal câblé en dur sur un seul modèle sans point de configuration.
- **#50** — Le moteur BOM est générique par construction — confirmé sur un persona totalement différent sans aucun changement de schéma/code.
- **#53** — Le modèle de stock suppose une consommation définitive — aucun concept de prêt/retour/caution ; la location de matériel est un domaine de données distinct à concevoir séparément.

### Frontend / UX

- **#11** — Styles inline pour couleurs custom (évite les problèmes de purge Tailwind).
- **#12** — Layout flex-row pour sidebar fixe sans padding codé en dur.
- **#17** — `tailwind-merge` ignore les échelles custom sans `extendTailwindMerge` — collision silencieuse (texte invisible).
- **#18** — Next.js 15 + React 18 : `useParams()` de `next/navigation`, jamais `params` en prop.
- **#20** — `apiClient` déballe déjà `json.data` une fois — jamais `res.data.data` sur les endpoints paginés.
- **#23** — Formulaire avec sous-ressources : construire en mémoire, envoyer atomiquement avec le POST parent.
- **#27** — Vérifier `NAV_GROUPS` avant de créer une route `settings/*` — plusieurs stubs existent sans lien de nav, injoignables et jamais testés.
- **#30** — `??`/`?.` ne distinguent pas "absent" de "présent mais null" — utiliser `'clé' in obj` quand `null` est une valeur de succès légitime.
- **#31** — Préférer des `queryKey` React Query hiérarchiques pour permettre l'invalidation en cascade.
- **#33** — Un panneau `flex` déplace les éléments sous le curseur entre les deux clics d'un double-clic — toujours `position: absolute` pour un panneau ouvert par clic sur élément double-cliquable.
- **#37** — Un champ number optionnel vide (`''`) devient `0` via `z.coerce.number()`, échouant silencieusement `.positive()` — utiliser `setValueAs`.
- **#39** — Un badge de disponibilité à côté d'un panier doit afficher `serveur - déjà_dans_le_panier` en état dérivé pur.
- **#41** — Tri de `DataTable` ajouté de façon purement additive, pattern réutilisable.
- **#48** — Un rôle métier combiné ne permet jamais de composer un accès lecture-seule pour un tiers de confiance partielle.
- **#49** — Un placeholder visuellement proche d'une vraie valeur (ex. densité "0.79" en gris) cause des échecs de validation silencieux et déroutants.

### Tests & discipline de processus

- **#7** — `VatBreakdownLine` expose `base`/`amount`, pas `baseHT`/`vatAmount`.
- **#8** — `calculateRecipeCost` est synchrone et pure.
- **#9** *(doublon)* — tests unitaires sans mock / intégration mock Prisma ; Edge Runtime incompatible avec `jsonwebtoken`, utiliser Web Crypto.
- **#34** — Ne jamais réduire silencieusement le scope d'une fonctionnalité actée au brainstorm sans le signaler d'abord — même sous contrainte de temps.
- **#46** — Un `fetch` serveur vers sa propre API doit utiliser une base URL fiable en prod — `?? 'http://localhost:3000'` casse silencieusement ; un module peut être "terminé" en code et pourtant 404 systématique en prod, indétectable par `tsc`/`build`, seul un vrai test navigateur le révèle.
- **#51** — Le nom d'une fonctionnalité stub peut trahir une portée bien plus étroite que ce que son emplacement dans le nav suggère.
- **#52** — Un module peut être *entièrement* absent côté UI alors qu'une route API partielle existe déjà — toujours vérifier l'UI live, jamais déduire du seul code backend.

### Tooling / infra / déploiement

- **#2** — JWT custom (access 15min / refresh 7j-30j), pas NextAuth, pour une API pure.
- **#3** — Déduplication des webhooks Stripe via `AuditLog.entityId = event.id`.
- **#5** — Cascade de recalcul de coût déclenchée depuis PATCH ingrédient si `priceUnit` change.
- **#6** — PDF factures : HTML → Buffer UTF-8 (swap Puppeteer en prod — jamais fait, voir §11.5).
- **#10** — Tailwind ne compile pas sans `postcss.config.js`.
- **#21** — `email.ts` ne doit jamais throw au chargement du module si `RESEND_API_KEY` absent.
- **#28** — Le type `Permission` et le tableau `ALL_PERMISSIONS` du seed peuvent diverger silencieusement.
- **#32** — Ce sandbox scrube les vraies `DATABASE_URL`/`DIRECT_URL` — contournement via `supabase link` + `supabase db query --linked`.
- **#42** — `git push` ne déploie jamais le schéma Prisma vers Supabase — règle la plus lourde de conséquences du projet, cause directe de l'incident de dérive de schéma du 2026-07-27.

---

## 25. Historique chronologique du projet

- **2026-06-07** — Scaffolding initial vide (`/hub new`).
- **2026-07-13/14/15** — Cœur backend construit (Prisma+middleware tenant, auth JWT, webhooks Stripe, PDF factures, cascade de coût) ; QA : 2 bugs critiques corrigés, ~155 cas de test écrits ; design system + layout ERP construits, fix critique postcss, JWT rendu Edge-compatible.
- **2026-07-16** — BUG-004 corrigé (statuts alignés, 19 tests passent) ; `V1-FEATURE-AUDIT.md` produit ; schéma/lib/api/frontend/tests du module BOM construits (Kanban production).
- **2026-07-21** — Session de déploiement : plusieurs bugs frontend/runtime trouvés et corrigés (règles #17-#22).
- **2026-07-23** — Extraction V1 approfondie, pattern Fiche/Instance documenté ; atomicité de l'éditeur de fiches BOM et protection N1 établies (#23-#25) ; brainstorm module POS.
- **2026-07-24** — Pivot macro HORECA exporté ; bug critique FIFO sous-fiche corrigé (#26, remplace #15 obsolète) ; Boutique/Produits étape 1.
- **2026-07-25** — Boutique/Produits étape 2 (bibliothèque de taux TVA) ; POS étapes 1-2 (schéma + vendeurs/PIN) ; règles #27-#29.
- **2026-07-26** — Journée dense POS : session caisse, brainstorm+implémentation Vue Flux (portée réduite assumée), pointage, écran de vente, finalisation de vente, écrans admin ("POS complet 7/7"), puis **révision architecturale majeure** : modèle de vente à la demande introduit via le scénario "Le Shaker" (3 bugs trouvés/corrigés, règles #36-#38), UI comptoir consolidée. Vue Stock Global construite puis itérée deux fois (#40).
- **2026-07-27** — Journée dense : fix badge PIN (#39), tri DataTable (#41), fix unicité PIN, feature "Zone de danger" (flush sélectif), **incident critique de dérive de schéma prod** découvert et corrigé (#42, incident fondateur de la règle opérationnelle la plus lourde du projet). Fix widget Vue Flux invisible en prod (permission `flow.read` jamais backfillée).
- **2026-07-28** — Module Équipe construit : découverte que le backend RBAC (User/Role/UserInvitation) était déjà entièrement construit mais **totalement inatteignable** (lien d'invitation 404, `/settings/team` stub statique malgré un lien de nav actif). 3 rôles par défaut à l'inscription, page accept-invite, écran Équipe unifié à 3 onglets.
- **2026-08-09** — Journée d'audit en 3 parties, **zéro correctif de code, zéro commit de code** (pur audit/test/documentation) : rebuild complet Graphify (1886 nœuds/3174 arêtes/256 communautés) + audit sécurité 5 agents (`SECURITY-AUDIT.md`, 3 critiques/3 élevées non corrigées) ; test live persona boulangerie (`SCENARIO-BOULANGERIE.md`) ; test live persona traiteur cocktails (`SCENARIO-TRAITEUR-COCKTAILS.md`). 11 nouvelles règles journal (#43-#53).
- **2026-08-10 00:20** — Session de clôture consolidant la journée d'audit du 2026-08-09 ; un seul commit docs-only poussé.
- **2026-08-12** — Ce dossier technique complet est produit (présente session).

---

## 26. Synthèse de maturité — état des lieux global

### ✅ FAIT et vérifié en live

Moteur BOM central (recettes, hiérarchie multi-niveaux N1-N3, FIFO, coût récursif, détection de cycle) — confirmé généralisable à deux personas radicalement différents (boulangerie, traiteur cocktails) sans aucun changement de schéma ; mécanisme central d'isolation multi-tenant (`getPrismaWithTenant()`) ; plomberie d'authentification JWT ; écran Équipe/RBAC (depuis le 2026-07-28) ; gestion des webhooks Stripe (confirmée saine par l'audit sécurité).

### ⚠️ PARTIEL / architecturalement en décalage

Module POS — fonctionnellement complet pour un persona à la demande (bar) mais **confirmé cassé par design** pour un persona à stock pré-produit (boulangerie) ; Devis/Recettes/Planning sont des coquilles vides ; le CMS Builder est un stub même si le code du storefront client existe (et est actuellement inatteignable en prod à cause d'un bug de configuration).

### ❌ CONNU-CASSÉ / failles de sécurité ouvertes

Les 3 failles critiques + 3 élevées de l'audit du 2026-08-09 sont **toutes encore non corrigées** à la date de rédaction — le contournement du lockout PIN et l'élévation de privilège par auto-promotion de rôle sont tous deux décrits comme trivialement exploitables en production aujourd'hui.

### 🚫 STUB / inexistant

Devis événementiel, module Facturation (UI totalement absente malgré un backend complet), formules de dotation en personnel, location de matériel — aucun n'a de présence schéma, API, ou UI.

### Discipline de processus

Le projet a une habitude d'auto-documentation inhabituellement rigoureuse (règles de journal, tests de scénarios réels en navigateur plutôt que revue de code statique, méthodologie explicite "brainstorm en cascade avant code"). Mais l'incident de dérive de schéma du 2026-07-27 et l'audit du 2026-08-09 (zéro correctif appliqué) montrent tous deux un motif récurrent : **l'audit/la découverte de problèmes va plus vite que leur correction**.

---

## 27. Annexe — Inventaire des incohérences et gaps connus

Liste consolidée, toutes sources confondues, pour référence rapide :

1. **Sécurité critique non corrigée** : bypass lockout PIN (FAILLE-001), fail-open JWT_SECRET (FAILLE-002), élévation de privilège auto-promotion de rôle (FAILLE-003/006) — voir §20.
2. **POS incompatible avec un modèle à stock pré-produit** (boulangerie) — voir §8.1, §22.1.
3. **Storefront inaccessible en prod** (`NEXT_PUBLIC_APP_URL` mal configuré) — voir §10.3, §22.1.
4. **Module Facturation** : backend complet, UI totalement absente — voir §11.5, §15.
5. **Module CMS** : backend complet, UI totalement absente (pas d'éditeur, pas de rendu de page publiée) — voir §10.4.
6. **Upload de fichiers non fonctionnel** : traite les images mais ne les stocke jamais réellement, écrit une URL fictive en DB pour les logos — voir §15.
7. **GDPR intake-only** : aucun chemin pour faire évoluer le statut d'une demande — voir §15.
8. **`recipes/[id]/versions/route.ts`** — sélectionne un champ `costHT` inexistant sur `RecipeVersion` — voir §5.8.
9. **Génération de PDF factures produit en réalité du HTML**, jamais migré vers un vrai moteur PDF — voir §11.5.
10. **`checkoutSchema` exige `cgvAccepted`** mais le payload réel du formulaire de checkout semble ne jamais l'inclure — à vérifier, potentiellement bloquant — voir §11.7.
11. **Deux systèmes de conversion d'unités non interopérables** (BOM base G/ML vs Recettes legacy base KG/L) — voir §5.4.
12. **Deux systèmes de calcul TVA parallèles** (`vat.ts` legacy enum vs `costs.ts` agnostique au taux) — voir §11.6.
13. **`docs/ARCHITECTURE.md` et `docs/UI-DESIGN.md` obsolètes** par rapport au code réel — voir §2.6, §16.3.
14. **Modules Recettes et Fournisseurs** : backend complet, UI dashboard en stub — voir §6.6.
15. **Route storefront `/page/[slug]` manquante** malgré des liens de nav qui y pointent — voir §10.3.
16. **Incohérence de nommage de templates** entre `site-config/route.ts` (schéma mort) et `site-config/template/route.ts` (liste réellement utilisée) — voir §10.4.
17. **Commentaire de schéma obsolète** sur le modèle `PosSale` (référence encore `ProductChannelStock` comme vérité du stock, plus vrai depuis la révision "vente à la demande") — voir §3.14.
18. **Absence totale de CI** — voir §2.7, §18, §19.3.
19. **Spécifications E2E Playwright non exécutables** (dépendance absente) — voir §18.1.
20. **Test d'isolation tenant qui ne teste pas le vrai mécanisme** (FAILLE-011) — voir §20.3.

---

*Fin du dossier technique complet. Document généré par exploration exhaustive du code source et de la documentation projet — chaque section est ancrée sur des fichiers réels du dépôt `artisastock-v2`.*
