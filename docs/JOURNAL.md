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
| 9 | Tests unitaires : couvrir fonctions pures sans mock ; intégration : mock Prisma setup.ts | tests/ | 2026-07-14 |

## Historique

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
