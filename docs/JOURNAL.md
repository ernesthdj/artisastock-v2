# Journal — ArtisaStock_V2

## Regles apprises

| # | Regle | Fichier(s) | Date |
|---|-------|-----------|------|
| 1 | Prisma $extends pour injection tenantId — jamais de filtre manuel répété | src/lib/prisma.ts | 2026-07-13 |
| 2 | JWT custom (access 15min / refresh 7j-30j) — pas NextAuth pour une API pure | src/lib/auth.ts | 2026-07-13 |
| 3 | Stripe webhooks : déduplication via AuditLog.entityId = event.id | src/app/api/webhooks/stripe/route.ts | 2026-07-13 |
| 4 | withPermission HOF : extract tenantId/userId des headers injectés par middleware | src/lib/permissions.ts | 2026-07-13 |
| 5 | Cascade cost recalculation : déclencher depuis PATCH ingrédient si priceUnit change | src/app/api/v1/ingredients/[id]/route.ts | 2026-07-13 |
| 6 | PDF factures : HTML → Buffer UTF-8 (swap Puppeteer en prod) | src/lib/pdf.ts | 2026-07-13 |
| 7 | VatBreakdownLine expose `base`/`amount` — pas `baseHT`/`vatAmount` | src/lib/utils/vat.ts | 2026-07-14 |
| 8 | calculateRecipeCost est synchrone et pure — jamais async, signature (ingredients[], servings) | src/lib/costs.ts | 2026-07-14 |
| 9 | Next.js 15 middleware Edge Runtime : jsonwebtoken incompatible — utiliser Web Crypto API (crypto.subtle) | src/middleware.ts | 2026-07-15 |
| 10 | Tailwind ne compile pas sans postcss.config.js — fichier obligatoire même si Next.js semble l'auto-détecter | postcss.config.js | 2026-07-15 |
| 11 | Inline styles pour les couleurs custom dans les composants React — évite les problèmes de purge Tailwind avec valeurs arbitraires | AppSidebar.tsx, AppTitleBar.tsx | 2026-07-15 |
| 12 | Layout flex row (AppSidebar spacer + main flex:1) pour sidebar fixe sans padding-left codé en dur | (dashboard)/layout.tsx | 2026-07-15 |
| 9 | Tests unitaires : couvrir fonctions pures sans mock ; intégration : mock Prisma setup.ts | tests/ | 2026-07-14 |

| 13 | BOM : N0 auto-créé en transaction atomique à la création du contexte — jamais manuellement | api/v1/bom/contexts/route.ts | 2026-07-16 |
| 14 | BOM : cycle detection via Set<string> visited dans calculateBomCost récursif | src/lib/bom/cost.ts | 2026-07-16 |
| 15 | BOM MVP : FIFO simplifié décrémente Ingredient.stock (pas de lots) — à revoir au module Achats | src/lib/bom/fifo.ts | 2026-07-16 |
| 16 | UnitOfMeasure étendu : MG, CG, CL, DL ajoutés pour BOM | prisma/schema.prisma | 2026-07-16 |

## Historique

### SESSION BOM-KANBAN — 2026-07-16 (hub end)

### [2026-07-16 18:00] SESSION — End
**Résumé :** Module BOM complet V1→V2. Schéma Prisma 7 modèles, lib/bom (units/cost/fifo), 10 API routes, 3 pages (hub/détail/kanban production), 4 composants, tests unitaires. Commit b6e3692 pushé.
**Branche :** master
**Commits pushés :** 1

### SESSION BOM-KANBAN — 2026-07-16

### [2026-07-16 17:30] FEAT — bom/kanban-production
**Fichiers :**
- `src/app/api/v1/bom/sheets/[id]/simulate/route.ts` — CRÉÉ — GET combiné cost + availability (parallel Promise.all)
- `src/app/api/v1/bom/productions/route.ts` — CRÉÉ — GET paginé par contextId (join sheet→level→context)
- `src/app/[locale]/(dashboard)/bom/[contextId]/production/page.tsx` — CRÉÉ — Page Kanban 3 colonnes
- `src/app/[locale]/(dashboard)/bom/[contextId]/page.tsx` — MODIFIÉ — Bouton "► Production" dans le header

**Résumé :** Implémentation du Kanban de production fidèle au workflow V1 WinForms. 3 colonnes : Niveaux/Fiches (N0 non-cliquable), Simulation (inputs → table disponibilité vert/rouge → confirmation inline), Historique (groupé par jour). Bouton "Lancer" disabled tant que pénurie. Auto-re-simuler après production réussie pour afficher stocks mis à jour.

### SESSION 0 — 2026-06-07

## QA ENGINEER — 2026-07-14
**Phase :** Phase 6 — QA & Tests
**Itération :** 1
**Entrée consommée :** src/lib/ (costs.ts, pdf.ts, auth.ts, permissions.ts, utils/*, validators/*), src/app/api/v1/recipes/[id]/duplicate/route.ts, tests/setup.ts existant
**Output produit :**
- vitest.config.ts + tests/setup.ts configurés
- 7 fichiers tests unitaires (~97 cas) : costs, vat, format, slug, order-status, validators auth/ingredient
- 3 fichiers tests intégration (~39 cas) : tenant-isolation, api/auth, api/ingredients
- 2 specs E2E Playwright (~19 cas) : auth flow, order flow
- docs/QA-REPORT.md — rapport complet avec bugs, recommandations, selfdoubt

**Décisions clés :**
- Tests unitaires = fonctions pures sans mock Prisma (calculateRecipeCost, buildVatBreakdown, validators Zod)
- Tests intégration = mock Prisma de setup.ts pour tester isolation multi-tenant et cascade recalcul
- Tests E2E = Playwright (non exécutés sans app live) — specs comme documentation des parcours critiques
- Coverage exclu : prisma.ts, email.ts, stripe.ts (dépendances externes non mockables utilement)

**Selfdoubt appliqué :**
- ✅ BUG-001 (pdf.ts) et BUG-002 (duplicate/route.ts) corrigés — vérifiés par lecture source
- ⚠️ Coverage 70% probable mais non mesuré (npx vitest --coverage requis avec app compilable)
- ⚠️ BUG-004 (CONFIRMED status) identifié non corrigé — alignement frontend/backend requis avant go-live
- ❌ Tests E2E non exécutés — dépendent d'une DB seedée et du serveur Next.js

**Impact :** Base de tests solide pour régression. 2 bugs critiques éliminés. Rapport QA consultable par DevOps pour go/no-go déploiement.
**Alerte agent suivant (DevOps):** BUG-004 (statut CONFIRMED) à corriger avant go-live. Upload images = mock URL (S3/R2 requis). PDF = HTML Buffer (Puppeteer requis en prod). Playwright non installé — ajouter `@playwright/test` aux devDeps. Variables d'env : voir .env.example.

---

### SESSION BOM — 2026-07-16

### [2026-07-16 00:00] FEAT — bom/schema
**Fichiers :** `prisma/schema.prisma`
**Résumé :** Ajout de 4 nouvelles valeurs UnitOfMeasure (MG, CG, CL, DL) + 7 modèles BOM (BomContext, BomLevel, BomSheet, BomLine, BomProduction, BomProductionLine, BomStock) + 2 enums (BomInputType, BomSourceType). Relations Tenant et Ingredient étendues.

### [2026-07-16 00:00] FEAT — bom/lib
**Fichiers :** `src/lib/bom/units.ts`, `src/lib/bom/cost.ts`, `src/lib/bom/fifo.ts`
**Résumé :** Bibliothèque BOM complète. `units.ts` : convert/compatibleUnits/formatQty avec groupes masse/volume/pièce. `cost.ts` : calcul récursif DFS avec détection de cycles. `fifo.ts` : checkAvailability + consumeFIFO MVP (décrémente Ingredient.stock directement, sans lots).

### [2026-07-16 00:00] FEAT — bom/api
**Fichiers :** `src/app/api/v1/bom/**` (10 fichiers route.ts)
**Résumé :** Routes REST complètes : contexts (CRUD + N0 auto), levels (CRUD + guards N0/dernier), sheets (CRUD + guards production/usage), lines (GET/POST/DELETE + guard hiérarchie N), cost (GET simulation), produce (POST FIFO transactionnel). Permissions bom.read/write/produce ajoutées.

### [2026-07-16 00:00] FEAT — bom/frontend
**Fichiers :** `src/app/[locale]/(dashboard)/bom/page.tsx`, `src/app/[locale]/(dashboard)/bom/[contextId]/page.tsx`, `src/components/bom/BomContextSheet.tsx`, `src/components/bom/BomLevelSheet.tsx`, `src/components/bom/BomSheetEditor.tsx`, `src/components/bom/BomProductionModal.tsx`, `src/components/layout/AppSidebar.tsx`
**Résumé :** Hub BOM (liste contextes en cards), détail contexte (colonnes niveaux/fiches), éditeur fiche avec onglets lignes/coût, modal production avec availability check. Entrée "Nomenclature" + icône Factory ajoutée dans AppSidebar.

### [2026-07-16 00:00] TEST — bom/units+cost
**Fichiers :** `tests/unit/lib/bom/units.test.ts`, `tests/unit/lib/bom/cost.test.ts`
**Résumé :** 20 cas units.test.ts (conversions masse/volume/pièce, incompatibilité inter-groupe, formatQty). 5 cas cost.test.ts (zéro lignes, conversion kg/g, nBatches scaling, détection cycle, récursion sous-fiche).

### [2026-07-16 17:52] CONFIG — bom/verification
**Fichiers :** `src/lib/bom/`, `src/app/api/v1/bom/`, `src/components/bom/`, `src/app/[locale]/(dashboard)/bom/`
**Résumé :** Vérification finale module BOM. TypeScript : 0 erreur dans src/ (erreurs .next/types/ pré-existantes Next.js 15 async params — hors scope BOM). Tests unitaires : 28/28 ✅ (23 units + 5 cost). Périmètre complet : schéma Prisma (7 modèles + 2 enums) → lib (units/cost/fifo) → API (10 routes) → UI (4 composants + 2 pages) → sidebar.

---

## FRONTEND DEVELOPER — 2026-07-14
**Phase :** Phase 5 — Implémentation Frontend
**Itération :** 1
**Entrée consommée :** ARCHITECTURE.md (arborescence), UI-DESIGN.md (design system, wireframes), FONDATION.md (stack React/Tailwind/shadcn)
**Output produit :**
- Design system CSS complet (tokens, composants, animations, skeleton, form-input)
- components.json shadcn/ui + cn() utility
- Providers : QueryProvider (TanStack Query), AuthProvider (JWT + refresh silencieux)
- Client API (apiClient) : fetch wrapper avec 401 refresh automatique + redirect login
- Zustand cart (persisté localStorage) + hooks use-permissions, use-cart
- Layouts : root, locale (next-intl + Toaster), auth, dashboard (guard RBAC)
- 4 pages auth : login (avec show/hide password), register (force password), forgot-password, reset-password
- AppSidebar : RBAC filtre nav, badge commandes en attente, collapse desktop, drawer mobile
- Dashboard KPI : 4 StatCards, liste commandes récentes, alertes stock avec liens
- Ingredients : DataTable complète avec pagination, filtres, actions, lignes warning stock bas
- IngredientSheet : formulaire création/édition avec Zod, side panel 480px
- Orders : liste avec filtres statuts, page détail avec changement statut, génération facture
- Storefront : header sticky + cart badge, footer, catalogue grille responsive, panier quantités, checkout multi-étapes (infos + créneau + paiement Stripe), suivi commande avec progress tracker, page pending post-paiement

**Décisions clés :**
- `storefront/[tenantSlug]/` hors du groupe `[locale]` — vitrine publique sans auth
- AuthProvider côté client avec useEffect(fetchMe) — pas de Server Actions pour la SPA admin
- Zustand persist sur cart — survit au refresh page, vidé après commande réussie
- Refresh token silencieux dans apiClient — UX transparente pour l'artisan

**Selfdoubt appliqué :**
- ✅ Auth flow login → dashboard — guard + redirect
- ✅ Panier Zustand → checkout → Stripe redirect — flux complet
- ⚠️ CMS Builder (drag & drop dnd-kit) — non implémenté (scope Phase 5 partiel, priorité MVP)
- ⚠️ Recettes, Fournisseurs, Produits pages ERP — squelettes à compléter (pattern identique à ingredients)
- ⚠️ Dark mode : tokens définis, classes Tailwind présentes, toggle à ajouter

**Impact :** Interface fonctionnelle de bout en bout : inscription → connexion → gestion stock → commandes + vitrine publique achetable
**Alerte agent suivant (QA):** Tester isolation multi-tenant (tenant A ne voit pas données tenant B). Tester flux complet checkout → webhook → order. Vérifier RBAC (vendeur ne peut pas accéder settings admin).

---

## BACKEND DEVELOPER — 2026-07-13
**Phase :** Phase 4 — Implémentation Backend
**Itération :** 1
**Entrée consommée :** FONDATION.md, ARCHITECTURE.md (22 models Prisma, patterns), API-ENDPOINTS.md (80+ routes), UI-DESIGN.md (design tokens)
**Output produit :**
- Setup projet complet (package.json, tsconfig, next.config, tailwind, .env.example)
- Prisma schema 22 models + seed demo (tenant, admin, ingrédients, recettes, produits)
- Lib layer : prisma singleton + $extends multi-tenant, auth JWT custom, stripe, email Resend, permissions HOF, costs cascade, pdf HTML
- Constants (permissions, units, order-status, block-types) + utils (tenant, format, slug, vat) + validators Zod
- Types API + CMS + Middleware JWT/i18n
- 80+ API routes : auth (7), ingredients (4), recipes (5), suppliers (3), products (4), orders (4), dashboard (4), invoices (3), users (3), roles (3), tenants (1), cms (4), site-config (2), pickup-slots (3), stripe (3), upload (2), gdpr (1), notifications (1), storefront (8), webhooks (1)
- i18n FR/NL (next-intl routing + messages)

**Décisions clés :**
- Auth JWT custom (pas NextAuth) — API pure sans session serveur implicite
- Prisma $extends avec getPrismaWithTenant() — injection automatique du tenantId sur toutes les opérations
- Stripe Connect Express — chaque artisan a son compte séparé
- PDF : HTML → Buffer (swap Puppeteer en production selon besoin)
- withPermission HOF — extrait headers injectés par middleware pour éviter re-parsing JWT à chaque route

**Selfdoubt appliqué :**
- ✅ Multi-tenant isolation via $extends — pattern confirmé Prisma docs
- ✅ Stripe Checkout → Webhook → Order creation — flux complet et idempotent
- ⚠️ PDF production : Buffer HTML actuel suffit pour dev, Puppeteer requis en prod
- ⚠️ Upload image : mock URL — bucket S3/R2 à configurer en prod

**Impact :** Toutes les fonctionnalités métier accessibles via API REST typée et sécurisée
**Alerte agent suivant (Frontend):** Utiliser les types de src/types/api.ts pour toutes les réponses. Middleware injecte x-tenant-id dans les headers. Tokens dans localStorage + Authorization: Bearer. Stripe redirect vers /storefront/[slug]/order/pending?session_id=...

---

### SESSION 0 — 2026-06-07

### [2026-06-07 00:00] FEAT — init
**Fichiers :** `CLAUDE.md`, `docs/JOURNAL.md`, `src/`, `tests/`
**Resume :** Scaffolding initial via `/hub new`. Coquille vide creee — stack et dependances a definir apres brainstorm.

### SESSION 4 — 2026-07-16

### [2026-07-16 00:00] FIX — BUG-004 statut CONFIRMED
**Fichiers :** `prisma/schema.prisma`, `src/lib/constants/order-status.ts`, `tests/unit/lib/order-status.test.ts`
**Résumé :** Alignement frontend/backend sur le statut `CONFIRMED`. Ajout de `CONFIRMED` à l'enum Prisma `OrderStatus`, à `ORDER_STATUS_LABELS`, aux `VALID_TRANSITIONS` (`NEW → CONFIRMED → IN_PREPARATION`). Prisma client régénéré. 19 tests passent.
**Erreur corrigée :** Frontend `NEXT_STATUSES` incluait `NEW → CONFIRMED` mais backend et schema ne connaissaient pas cette valeur → rejet 400 à chaque clic "Confirmer". Fix : ajouter `CONFIRMED` côté backend (valeur métier valide). Règle : `db push` requis au prochain démarrage de la DB.

### [2026-07-16 00:00] DOCS — V1-FEATURE-AUDIT
**Fichiers :** `docs/V1-FEATURE-AUDIT.md`
**Résumé :** Pipeline 3 agents parallèles (Données & SQL · Logique Métier · Features & Workflows) pour scanner exhaustivement ArtisaStock v1 (C# WinForms + Laravel). Compilation en document de référence unique pour les agents v2.
**Contenu :** Schema 20 tables + vue + 22 migrations | Conversions d'unités + FIFO + calcul coût BOM récursif + TVA | 33+ fonctionnalités + 5 workflows step-by-step + mapping WinForms→React | 14 règles métier critiques | Backlog priorisé P0/P1/P2

### SESSION 3 — 2026-07-15

### [2026-07-15 23:59] SESSION — End
**Résumé :** Design system ArtisaStock complet. Fix critique postcss.config.js (Tailwind non compilé). JWT Edge-compat (Web Crypto). Layout ERP : TitleBar chocolat fixe + sidebar brun foncé inline styles + main flex. Login page fond chocolat profond. Dashboard HubScreen (KpiTile, table commandes, alertes). 7 placeholders pages manquantes. next-intl localePrefix aligné. api-client redirect locale-aware.
**Branche :** master
**Commits pushés :** 1 (93aa316)
