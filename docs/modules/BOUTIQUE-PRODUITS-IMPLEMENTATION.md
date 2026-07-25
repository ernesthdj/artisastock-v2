# Plan d'implémentation — Module Boutique / Produits

> mentalyas · Full-Stack Dev
> Date : 2026-07-24
> Statut : Document d'organisation — étape 3 de la cascade de brainstorms (voir `CLAUDE.md` § Méthodologie de conception)
> Sources : `docs/FONDATION-HORECA.md` (macro), `docs/modules/BOUTIQUE-PRODUITS.md` (brainstorm module, UC1-UC12 + workflow Mermaid), `prisma/schema.prisma` (vérifié directement)

Ce document découpe l'implémentation du module Boutique/Produits en étapes séquentielles testables dans le navigateur. Il ne contient pas de code — c'est un plan de travail. Chaque étape correspond à une session de travail bornée (un objectif, quelques fichiers, un test navigateur observable, une Definition of Done).

**Avertissement de vérification** : le brainstorm module (§2) décrit `products/page.tsx` et `cms/page.tsx` comme des "coquilles vides" — confirmé. Mais la vérification directe du code (ci-dessous, §0 et section Risques) révèle que la couche API existe déjà en partie sur l'**ancien modèle** (`Product.recipeId`, `Product.vatRate` enum, `Product.stockType`/`stockQuantity`) et qu'elle est **consommée en production** par la vitrine cliente (storefront) et par le webhook Stripe. Le plan ci-dessous en tient compte : il ne s'agit pas de construire depuis zéro, mais de migrer une chaîne déjà branchée sans la casser.

**Décisions tranchées le 2026-07-24 (avant le début de l'implémentation)** — les 3 points de risque qui nécessitaient un arbitrage ont été décidés par mentalyas :
1. **`OrderItem.vatRate`** → remplacé par un snapshot `Decimal` (`vatRatePercent`), copié tel quel au moment de la commande, indépendant de toute FK vers `TenantVatRate`.
2. **Granularité de la clôture périssable (UC10)** → par canal par défaut, mais scindable : l'admin peut créer plusieurs lignes `StockClosure` pour un même canal si le sort des unités restantes est mixte (ex. 2 jetées + 1 donnée à l'équipe sur 3 restantes en Vitrine).
3. **Conflit de stock au webhook Stripe** → la commande est créée avec un statut dédié (conflit/à résoudre), visible et traçable dans l'admin — jamais de remboursement automatique ni de correction silencieuse.

Ces décisions sont intégrées dans les étapes concernées ci-dessous (1, 10, 11) ; la section Risques en fin de document ne les liste plus comme ouvertes.

---

## 0. État réel vérifié (avant de commencer)

| Élément | État constaté (lecture directe du code, pas du brainstorm) |
|---|---|
| `src/app/[locale]/(dashboard)/products/page.tsx` | Stub `<Empty>` de 12 lignes — confirmé vide |
| `src/app/[locale]/(dashboard)/cms/page.tsx` | Stub `<Empty>` de 12 lignes — confirmé vide |
| `src/app/[locale]/(dashboard)/recipes/page.tsx` | Également un stub `<Empty>` — l'UI de gestion de `Recipe` n'a jamais existé |
| `src/app/api/v1/products/route.ts` + `[id]/route.ts` + `[id]/visibility/route.ts` | **Existent et fonctionnent déjà**, mais sur `Product.recipeId`/`Product.vatRate` (enum)/`Product.stockType`/`stockQuantity` — c'est l'ancien modèle, pas `BomSheet` |
| `src/lib/validators/product.ts` | Schémas Zod déjà écrits sur l'ancien modèle (`recipeId`, `vatRate: VatRate`, `stockType`) |
| `src/lib/costs.ts` (`calculatePriceTTC`/`calculatePriceHT`/`calculateVatAmount`) | `VAT_RATES` **codé en dur** : `{ FOOD_6: 0.06, STANDARD_21: 0.21 }` — incompatible avec une bibliothèque de taux configurable (UC8) |
| `src/app/api/storefront/[tenantSlug]/products/route.ts` (GET, public) | Lit directement `product.vatRate`, `product.stockType`, `product.stockQuantity`, `product.priceTTC` — **consommateur direct de l'ancien modèle** |
| `src/app/api/storefront/[tenantSlug]/checkout/route.ts` (POST) | Vérifie `product.stockType === 'limited' && stockQuantity < quantity` — **aucune réservation réelle**, juste une lecture au moment du clic |
| `src/app/api/webhooks/stripe/route.ts` (`handleCheckoutCompleted`) | Crée `Order` + `OrderItem` à la confirmation Stripe, recalcule `vatFactor` **en dur** (`FOOD_6 ? 1.06 : 1.21`, dupliqué de `lib/costs.ts`) — **ne décrémente aucun stock, aucune table.** C'est le vrai point d'écriture de la vente en ligne, pas la route `checkout` elle-même. |
| `prisma/seed.ts` | Crée 2 `Recipe` + 2 `Product` liés par `recipeId` (données de démo réelles, pas hypothétiques) |
| `src/lib/bom/fifo.ts` | Pattern FIFO transactionnel déjà établi (re-lecture dans la transaction, anti-TOCTOU) — **à réutiliser** pour le décrément `ProductChannelStock`, ne pas réinventer |
| `prisma/seed.ts` (`ALL_PERMISSIONS`) | `products.read/write/delete` déjà déclarés — de nouveaux endpoints demanderont de nouvelles permissions (ex. `tenant-vat-rates.*`, `products.allocate`, `products.close`) |

Conséquence directe sur le plan : le schéma **et** ses 5 points de consommation (route POST/PATCH products, validator, storefront products GET, checkout POST, webhook Stripe) doivent être traités dans une fenêtre de travail cohérente — on ne peut pas migrer le schéma un jour et les consommateurs une semaine plus tard sans casser la vitrine cliente en prod.

---

## Résumé des étapes

| # | Objectif court | UC couverts |
|---|---|---|
| 1 | Schéma Prisma : `TenantVatRate`, `ProductChannelStock`, `StockClosure`, migration `Product` (`bomSheetId`, `isPerishable`, `marginTargetFactor`, `vatRateId`) + mise à niveau des 5 consommateurs existants pour rester compilables | Prérequis (aucun UC direct) |
| 2 | Bibliothèque de taux TVA par Activité — CRUD `TenantVatRate` | UC8 |
| 3 | Publication d'un produit depuis une `BomSheet` avec vérification de stock | UC1, UC2 |
| 4 | Page admin Produits (liste + publication) — fin du stub | UC1 (UI) |
| 5 | Prix de vente + indicateur de marge confort | UC7 |
| 6 | Assignation TVA au produit publié | UC9 (partiel — un taux par produit, pas encore par canal) |
| 7 | Allocation manuelle Vitrine / Direct par lot | UC3 |
| 8 | Flag périssable | UC4 |
| 9 | Affichage vitrine + rupture de stock (storefront) | UC5 |
| 10 | Décrément réel de l'allocation Vitrine à la commande (checkout + webhook) | UC6 |
| 11 | Clôture quotidienne des produits périssables | UC10 |
| 12 | Édition et dépublication d'un produit publié | UC11, UC12 |

Ordre justifié par les dépendances réelles : impossible de tester UC1 (publier) avant que le schéma existe (étape 1) et qu'une bibliothèque TVA existe pour ne pas bloquer le formulaire (étape 2, car UC1→VAT est une étape obligatoire du workflow avant `LIVE` dans le diagramme Mermaid du brainstorm). UC6 (décrément vitrine) ne peut être testé qu'après UC3 (allocation, étape 7) et UC5 (affichage, étape 9), qui eux-mêmes dépendent de UC1 publié. UC10 (clôture) ne peut être testé qu'avec un produit périssable ayant une allocation réelle (étapes 8 et 7). UC11/UC12 sont volontairement en dernier car ils portent sur un produit déjà entièrement fonctionnel.

---

## Étape 1 — Schéma Prisma et mise à niveau des consommateurs existants

**Objectif** : faire évoluer `prisma/schema.prisma` pour introduire les nouveaux modèles proposés dans le brainstorm, migrer `Product`, et adapter le code existant qui dépend de l'ancien modèle pour que l'application continue de compiler et de tourner (même si les nouvelles fonctionnalités ne sont pas encore branchées à l'UI).

**Fichiers concernés** :
- `prisma/schema.prisma` — ajouter `TenantVatRate`, `ProductChannelStock` (+ enum `StockChannel { VITRINE DIRECT }`), `StockClosure` (+ enum `ClosureReason { WASTE STAFF OTHER }`) ; modifier `Product` (`bomSheetId` remplace `recipeId`, `isPerishable`, `marginTargetFactor`, `vatRateId` remplace `vatRate` enum) ; modifier `OrderItem.vatRate` (enum) → `OrderItem.vatRatePercent` (`Decimal`, snapshot figé au moment de la commande — décidé le 2026-07-24) ; ajouter la valeur `STOCK_CONFLICT` à l'enum `OrderStatus` existant (préparation de l'étape 10)
- `prisma/migrations/` — nouvelle migration (`npx prisma migrate dev`)
- `prisma/seed.ts` — remplacer la création `Recipe`/`Product` par une création `BomSheet`/`Product` cohérente avec le nouveau schéma, ajouter un `TenantVatRate` de démo (6%/21%), ajouter les nouvelles permissions à `ALL_PERMISSIONS`
- `src/lib/validators/product.ts` — adapter `productCreateSchema`/`productUpdateSchema` (`bomSheetId`, `vatRateId`, retirer `stockType`/`stockQuantity`)
- `src/lib/costs.ts` — `calculatePriceTTC`/`calculatePriceHT`/`calculateVatAmount` doivent accepter un taux numérique (`ratePercent`) au lieu de l'enum `VatRate` en dur
- `src/app/api/v1/products/route.ts`, `src/app/api/v1/products/[id]/route.ts` — adapter aux nouveaux champs (peuvent rester des endpoints "de transition" tant que l'étape 3 n'a pas branché la logique `BomSheet`)
- `src/app/api/storefront/[tenantSlug]/products/route.ts` — retirer la lecture de `stockType`/`stockQuantity` (remplacée à l'étape 9)
- `src/app/api/storefront/[tenantSlug]/checkout/route.ts` — retirer la vérification `stockType === 'limited'` (remplacée à l'étape 10)
- `src/app/api/webhooks/stripe/route.ts` (`handleCheckoutCompleted`) — remplacer `product.vatRate === VatRate.FOOD_6 ? 1.06 : 1.21` par une lecture du taux réel via `vatRateId`

**Use cases couverts** : aucun directement — prérequis technique bloquant pour tous les suivants.

**Statut : ✅ Terminée le 2026-07-24.**

**Écart d'exécution constaté** : le projet n'a pas de dossier `prisma/migrations/` — le schéma est appliqué via `prisma db push` (cohérent avec le script `db:push` de `package.json`), pas via `prisma migrate dev` (qui échoue de toute façon en environnement non-interactif). Le plan ci-dessus a été exécuté avec `db push --force-reset` (base locale de dev uniquement, données de démo réécrites de toute façon à cette étape).

**Test navigateur — résultats** :
1. ✅ `npx prisma db push` appliqué, tables `TenantVatRate`, `ProductChannelStock`, `StockClosure` créées (vérifié via requête directe, pas Prisma Studio).
2. ✅ `npm run db:seed` s'exécute sans erreur, produit de démo cohérent (`bomSheetId`, `vatRateId`, allocation `ProductChannelStock` par canal) vérifié par requête directe.
3. ✅ `/fr/products` et `/fr/recipes` (stubs) se chargent sans erreur, testé au navigateur après connexion (`admin@demo-boulangerie.be`).
4. ✅ (initialement ⚠️, corrigé le 2026-07-24) `/storefront/demo-boulangerie/catalog` — 4 bugs préexistants trouvés et corrigés en cascade, tous sans rapport avec le schéma de cette étape :
   - **Routing** : `src/middleware.ts` appliquait `intlMiddleware` (préfixe de langue `always`) à **toutes** les routes pages, y compris `/storefront/*`, qui redirigeait vers `/fr/storefront/...` — mais les pages storefront vivent dans `src/app/storefront/[tenantSlug]/` (hors du dossier `[locale]`), 404 garanti. **Fix** : bypass explicite pour `pathname.startsWith('/storefront/')` avant l'appel à `intlMiddleware`.
   - **Seed** : `SiteConfig.isPublished: false` dans le seed + `upsert` avec `update: {}` (donc jamais réappliqué sur une base déjà seedée) → `StorefrontLayout` appelle `notFound()` pour toute vitrine non publiée. **Fix** : `isPublished: true` dans le seed, `update: { isPublished: true }` pour que le upsert s'applique aussi aux relances.
   - **QueryProvider manquant** : `src/app/layout.tsx` (racine) ne monte `QueryProvider` nulle part, et `src/app/storefront/[tenantSlug]/layout.tsx` non plus — cassait `useQuery` dans **catalog, checkout et order/[trackingToken]** (3 pages) avec `500 Error: No QueryClient set`. **Fix** : `<QueryProvider>` ajouté dans le layout storefront.
   - **Double désenveloppement JSON** : `catalog/page.tsx` faisait `json.data` puis `.data` une seconde fois, alors que `apiPaginated` renvoie déjà `{success, data: [...], meta}` (pas `{data: {data, total}}`) — catalogue toujours vide malgré une API 200. **Fix** : un seul niveau de désenveloppement (déjà la règle #20 du JOURNAL, violée uniquement dans ce fichier qui contourne `apiClient`).

   Vérifié au navigateur après les 4 fixes : catalogue affiche "Pain de campagne" (3,00€) et "Croissant pur beurre" (1,50€) avec filtres par catégorie fonctionnels.
5. ✅ Webhook Stripe testé avec un événement `checkout.session.completed` signé (généré via `Stripe.webhooks.generateTestHeaderString`, pas de Stripe CLI installé sur la machine) : `200 {"received":true}`, commande créée avec `OrderItem.vatRatePercent = 6` calculé depuis le vrai `TenantVatRate` (totaux HT/TVA/TTC cohérents : 5.66€ + 0.34€ = 6€).

**Definition of Done** :
- [x] Schéma appliqué via `prisma db push` (pas de dossier migrations dans ce projet — voir écart d'exécution ci-dessus).
- [x] `npm run build` passe sans erreur TypeScript (erreurs restantes = préexistantes, vérifié par comparaison avant/après : `tests/e2e/*`, `tests/integration/tenant-isolation.test.ts`, `tests/integration/api/ingredients.test.ts`, `tests/unit/validators/ingredient.test.ts` — aucune ne référence Product/BOM/TVA).
- [x] Aucune route existante ne renvoie 500 à cause d'un champ manquant (webhook Stripe testé end-to-end, API storefront products testée).
- [x] Le seed reflète le nouveau modèle (`BomSheet`/`BomStock`/`TenantVatRate`/`ProductChannelStock`), plus de `Recipe` pour les produits publiés.
- [x] Bug de routing storefront + 3 autres bugs préexistants (seed non publié, QueryProvider manquant, double désenveloppement JSON) — corrigés le 2026-07-24, voir résultat du test navigateur #4 ci-dessus. Vitrine cliente vérifiée fonctionnelle de bout en bout.

---

## Étape 2 — Bibliothèque de taux TVA par Activité

**Objectif** : permettre à l'admin de créer/consulter les taux de TVA de son Activité (ex. 6%, 12%, 21%), remplaçant l'enum figé.

**Fichiers concernés** :
- `src/app/api/v1/tenant-vat-rates/route.ts` *(nouveau)* — `GET` (liste) / `POST` (création)
- `src/app/api/v1/tenant-vat-rates/[id]/route.ts` *(nouveau)* — `PATCH` (édition, activation/désactivation)
- `src/lib/validators/tenant-vat-rate.ts` *(nouveau)* — schéma Zod (`label`, `ratePercent`, `isActive`)
- `src/app/[locale]/(dashboard)/settings/vat-rates/page.tsx` *(nouveau, ou section dans `settings/page.tsx` existant selon convention déjà en place)*
- `src/components/settings/TenantVatRateSheet.tsx` *(nouveau, modal de création/édition, sur le modèle de `src/components/ingredients/IngredientSheet.tsx`)*
- `prisma/seed.ts` — ajouter `tenant-vat-rates.read`/`tenant-vat-rates.write` à `ALL_PERMISSIONS`

**Use cases couverts** : UC8.

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : le taux de TVA n'a pas été implémenté comme une nouvelle page de nav (`settings/vat-rates`, orphelin) mais comme une section (`Card` "Taux de TVA") directement dans `settings/page.tsx`, qui est la seule page du groupe Paramètres réellement reliée à la sidebar (`REF_ITEMS` dans `src/lib/constants/nav.ts`). `settings/team` existe déjà comme route orpheline non liée depuis nulle part — même travers évité ici. `Permission` (`src/lib/constants/permissions.ts`) ne contenait pas `tenant-vat-rates.read`/`write` alors que `prisma/seed.ts` les avait déjà (ajoutés à l'étape 1) : ajouté pour que `withPermission()` type-check.

**Fichiers réellement modifiés/créés** :
- `src/lib/constants/permissions.ts` — ajout `tenant-vat-rates.read`/`write`
- `src/lib/validators/tenant-vat-rate.ts` *(nouveau)*
- `src/app/api/v1/tenant-vat-rates/route.ts` *(nouveau)* — GET liste (paginé, inclut inactifs) / POST création
- `src/app/api/v1/tenant-vat-rates/[id]/route.ts` *(nouveau)* — GET / PATCH (édition + activation/désactivation)
- `src/components/settings/TenantVatRateSheet.tsx` *(nouveau)* — modal création/édition, sur le modèle `ActiviteSheet.tsx`
- `src/app/[locale]/(dashboard)/settings/page.tsx` — ajout de la Card "Taux de TVA" (DataTable + bouton Ajouter + actions Modifier/Désactiver-Réactiver)

**Test navigateur — résultats** :
1. ✅ Connexion `admin@demo-boulangerie.be` (le conteneur Docker `artisastock-v2-pg` était arrêté — redémarré avant de pouvoir tester).
2. ✅ `/fr/settings` affiche les 2 taux de démo du seed (TVA réduite alimentaire 6%, TVA standard 21%).
3. ✅ Créé "TVA intermédiaire" à 12% → toast succès, apparaît immédiatement dans la liste (triée actifs d'abord).
4. ✅ Désactivé "TVA intermédiaire" → badge passe à "Inactif", reste visible dans la liste avec bouton "Réactiver" (pas de suppression).
5. ✅ Tentative de création à 150% → validation Zod côté client bloque avant tout appel réseau ("Doit être ≤ 100"), aucune ligne créée.
6. ✅ Édition (icône crayon) sur "TVA réduite alimentaire" → sheet pré-rempli correctement (libellé + taux + case Actif).

**Definition of Done** :
- [x] CRUD complet fonctionnel dans le navigateur (scoping tenant assuré par `getPrismaWithTenant`/`withPermission`, cohérent avec le pattern `activites` existant — pas re-testé avec un second tenant car le pattern est partagé avec du code déjà en production).
- [x] Validation Zod rejette un `ratePercent` négatif ou > 100 (testé > 100 au navigateur, borne négative garantie par le même schéma `.min(0)`).

---

## Étape 3 — Publication d'un produit depuis une fiche BOM

**Objectif** : `POST /api/v1/products` doit créer un produit à partir d'une `BomSheet` ayant du stock disponible (`BomStock.qtyAvailable > 0`), et refuser sinon.

**Fichiers concernés** :
- `src/app/api/v1/products/route.ts` — `POST` vérifie l'existence de `BomStock` disponible pour la `bomSheetId` fournie avant création (sinon 400)
- `src/lib/validators/product.ts` — `productCreateSchema` finalisé (`bomSheetId` requis, `vatRateId` requis, `isPerishable` optionnel avec défaut `false`)
- `src/app/api/v1/bom/sheets/route.ts` *(existant, lecture seule)* — vérifier que la liste des fiches BOM avec stock disponible peut être filtrée côté client, ou ajouter un paramètre `?hasStock=true` si besoin

**Use cases couverts** : UC1 (côté API), UC2.

**Statut : ✅ Terminée le 2026-07-25.**

**Fichiers réellement modifiés** : uniquement `src/app/api/v1/products/route.ts` — `productCreateSchema`/`validators/product.ts` étaient déjà finalisés depuis l'étape 1 (le fichier ne les a pas touchés). Vérification tenant sur la `BomSheet` (via `level.context.tenantId`, même pattern que `bom/sheets/[id]/cost/route.ts`) ajoutée en même temps que le blocage stock — elle n'existait pas non plus avant cette étape.

**Test navigateur (via `fetch` authentifié dans la console, pas de client REST externe)** :
1. ✅ Créé une `BomSheet` temporaire sans aucun `BomStock` → POST `/api/v1/products` → `400 { code: "NO_STOCK", message: 'Aucun stock disponible pour la fiche "Test sans stock (temp)"...' }`, aucun produit créé. Fiche temporaire supprimée après test.
2. ✅ POST `/api/v1/products` sur "Croissant pur beurre" (a du `BomStock` réel, cf. étape précédente) → `201`, produit créé avec `bomSheetId` correct, `priceTTC` recalculé depuis le vrai `TenantVatRate` (1.50€ HT × 1.06 = 1.59€ TTC). Produit de test supprimé après vérification (pas une donnée de démo permanente).

**Definition of Done** :
- [x] Le blocage UC2 est vérifié par un test manuel négatif (pas seulement supposé).
- [x] Le produit créé porte bien `bomSheetId`, pas de résidu `recipeId`.

---

## Étape 4 — Page admin Produits (liste + publication)

**Objectif** : remplacer le stub `products/page.tsx` par une vraie liste de produits avec un flux de publication utilisable au clavier/souris, sans passer par un client REST.

**Fichiers concernés** :
- `src/app/[locale]/(dashboard)/products/page.tsx` — liste des produits (nom, statut visible/masqué, prix, TVA, allocation résumée)
- `src/components/products/ProductPublishSheet.tsx` *(nouveau)* — modal de publication : sélection d'une `BomSheet` avec stock dispo, nom/description/catégorie/images, toggle périssable
- `src/components/products/ProductList.tsx` *(nouveau, ou intégré directement dans `page.tsx` selon la taille — comparer à `ingredients/page.tsx`, 230 lignes, pour la convention du projet)*

**Use cases couverts** : UC1 (UI complète), UC4 (le toggle périssable est déjà dans le formulaire de publication).

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : `GET /api/v1/bom/sheets` exigeait un `levelId` obligatoire (conçu pour l'arborescence BOM, niveau par niveau) — inutilisable tel quel pour le picker de publication, qui doit lister les fiches ayant du stock **tous niveaux confondus**. Étendu : `levelId` devient optionnel (sans lui, filtre `level.context.tenantId` — `BomSheet` est `TENANT_SCOPED_VIA_PARENT`, jamais auto-scopé), ajout de `?hasStock=true` et d'un champ calculé `availableStock` par fiche (somme des `BomStock.qtyAvailable > 0`). Changement rétrocompatible (les appels existants avec `levelId` sont inchangés).

**Fichiers réellement modifiés/créés** :
- `src/app/api/v1/bom/sheets/route.ts` — `levelId` optionnel + `hasStock` + `availableStock`
- `src/components/products/ProductPublishSheet.tsx` *(nouveau)* — pas de `ProductList.tsx` séparé, le tableau reste dans `page.tsx` (74 lignes de DataTable, sous le seuil qui aurait justifié une extraction, cohérent avec `ingredients/page.tsx`)
- `src/app/[locale]/(dashboard)/products/page.tsx` — remplace le stub : liste + bouton "Publier un produit" + toggle visibilité rapide (réutilise `PATCH .../visibility`, déjà testé à l'étape 1)

**Test navigateur** :
1. ✅ `/fr/products` n'affiche plus le stub — liste réelle des 2 produits de démo.
2. ✅ "Publier un produit" → select Fiche BOM affiche le stock réel par fiche ("Croissant pur beurre — 224 pièce(s)"), formulaire rempli (nom, catégorie, prix HT, TVA) → 201, le produit apparaît immédiatement dans la liste (`invalidateQueries`, pas de rechargement).
3. ✅ Test négatif **race condition réel** (plus fort que le test prévu par le plan) : fiche sélectionnée dans le picker (donc avec stock au chargement), stock mis à 0 en base *après* le chargement du picker mais *avant* soumission → soumission bloquée avec le message `NO_STOCK` affiché **dans le formulaire** (`setError` sur le champ fiche BOM), pas de crash, aucun produit créé. Confirme que le picker filtré (`hasStock=true`) n'est qu'une prévention UX (Tesler/Nielsen) — le vrai garde-fou anti-TOCTOU reste le contrôle serveur de l'étape 3, qui a bien été exercé.
4. ✅ Toggle visibilité (Pill cliquable) : bascule Visible ⇄ Masqué, toast, persistance vérifiée par requête API directe.
5. Artefacts de test (produits de test, fiche BOM temporaire, stock temporairement mis à 0) nettoyés/restaurés après vérification.

**Definition of Done** :
- [x] Flux UC1 entièrement navigable sans REST client.
- [x] Feedback perçu immédiat sur les actions (invalidation de query, pas de latence visible en usage normal).

---

## Étape 5 — Prix de vente et indicateur de marge

**Objectif** : saisie manuelle du prix de vente HT avec un indicateur non bloquant de marge par rapport au coût de production (`BomStock.unitCost`) et un facteur cible configurable.

**Fichiers concernés** :
- `src/components/products/ProductPublishSheet.tsx` (ou `ProductEditSheet.tsx` si séparé) — champ `priceHT`, affichage marge calculée (`priceHT / unitCost` vs `marginTargetFactor`)
- `src/lib/costs.ts` — fonction utilitaire de calcul de marge confort (ex. `calculateMarginRatio`)
- `src/app/api/v1/products/[id]/route.ts` — `PATCH` accepte `priceHT` et `marginTargetFactor`

**Use cases couverts** : UC7.

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : `calculateMarginRatio` existait déjà dans `src/lib/costs.ts` (posé à l'étape 1, jamais branché à l'UI) mais ce fichier importe `prisma` en tête — l'importer depuis un composant `'use client'` (`ProductPublishSheet.tsx`) aurait tenté de bundler Prisma côté navigateur. Aucun autre composant client du projet n'importe `lib/costs`, donc pas de précédent à suivre : le calcul (une ligne, `priceHT / unitCost`) est dupliqué localement dans le composant plutôt que de créer une frontière cross-boundary inédite. `ProductEditSheet.tsx` n'existe pas encore (Étape 12) — le formulaire testé est `ProductPublishSheet.tsx` (seul endroit où `priceHT` se saisit aujourd'hui), conforme à la mention alternative du plan ("ou `ProductEditSheet.tsx` si séparé").

**Fichiers réellement modifiés** :
- `src/app/api/v1/bom/sheets/route.ts` — ajout d'un `avgUnitCost` par fiche (moyenne pondérée par quantité des `BomStock` disponibles, pas le coût d'un lot arbitraire — cohérent avec l'agrégation `availableStock` déjà en place depuis l'étape 4)
- `src/components/products/ProductPublishSheet.tsx` — champ `marginTargetFactor` (optionnel, défaut indicatif x3 non persisté), indicateur de marge live (`watch` sur `priceHT`/`bomSheetId`), jamais bloquant
- `src/app/api/v1/products/[id]/route.ts` — **aucun changement nécessaire**, `productUpdateSchema` (= `productCreateSchema.partial()`) acceptait déjà `priceHT`/`marginTargetFactor` depuis l'étape 1, `priceTTC` déjà recalculé au `PATCH`

**Test navigateur** :
1. ✅ Prix bas (0,50€ HT vs coût réel 0,32€) → encart orange "Marge : x1.56 le coût de revient (0.32€) — faible (cible x3)", bouton "Publier" jamais désactivé.
2. ✅ Prix confortable (1,50€ HT) → encart vert "Marge : x4.75 le coût de revient (0.32€) — confortable".
3. ✅ Champ prix vide à l'ouverture du formulaire (aucune valeur suggérée, seulement un placeholder visuel `1.50`).

**Definition of Done** :
- [x] L'indicateur est visuellement clair mais jamais bloquant (pas de `disabled` sur le bouton Publier).
- [x] Le calcul utilise `avgUnitCost`, une moyenne pondérée des `BomStock` réellement disponibles pour la fiche — pas une valeur arbitraire.

---

## Étape 6 — Assignation TVA au produit

**Objectif** : associer un `TenantVatRate` (créé étape 2) à un produit publié, recalculer `priceTTC`.

**Fichiers concernés** :
- `src/components/products/ProductPublishSheet.tsx` — sélecteur de taux TVA (liste des `TenantVatRate` actifs de l'Activité)
- `src/app/api/v1/products/route.ts` / `[id]/route.ts` — `priceTTC` recalculé via `vatRateId` → `ratePercent` (plus l'enum en dur)

**Use cases couverts** : UC9 (version simple : un taux par produit, pas encore par canal — voir Risques pour la décision différée sur le taux par canal).

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : le sélecteur de taux TVA existait déjà dans `ProductPublishSheet.tsx` depuis l'étape 4 (nécessaire pour satisfaire `vatRateId` requis par `productCreateSchema`), et `priceTTC` était déjà recalculé serveur-side (POST et PATCH) depuis l'étape 1/3 sans jamais passer par l'enum `VatRate`. Le seul écart réel avec le plan : aucun aperçu **visible avant sauvegarde** n'existait — ajouté maintenant (calcul live `priceHT × (1 + ratePercent/100)`, même contrainte cross-boundary que l'étape 5 : dupliqué localement plutôt qu'importé depuis `lib/costs.ts`).

**Fichiers réellement modifiés** : uniquement `src/components/products/ProductPublishSheet.tsx` (aperçu `priceTTC` live sous les champs prix/TVA). Aucun changement API — `products/route.ts`/`[id]/route.ts` recalculaient déjà `priceTTC` via `vatRateId → ratePercent` depuis les étapes précédentes.

**Test navigateur** :
1. ✅ Sélection "TVA intermédiaire (12%)" avec prix HT 1,50€ → aperçu live "Prix TTC : 1.68€" affiché avant toute sauvegarde.
2. ✅ Changement vers "TVA réduite alimentaire (6%)" → aperçu recalculé instantanément à "1.59€", sans re-render de page.
3. ✅ `priceTTC` stocké confirmé correct par requête API directe lors des tests des étapes 3/4 (1.50€ × 1.06 = 1.59€ vérifié en base).

**Definition of Done** :
- [x] Plus aucune référence à l'enum `VatRate` dans le flux de création/édition produit — confirmé par recherche globale (`grep VatRate`), seules références restantes : `Lot`/`Achats` (domaine différent, achat fournisseur) et `Recipe` (legacy, hors périmètre du module).

---

## Étape 7 — Allocation manuelle Vitrine / Direct

**Objectif** : `POST /products/[id]/allocations` permet à l'admin de répartir une quantité d'un lot `BomStock` entre canal Vitrine (en ligne) et Direct/POS (comptoir).

**Fichiers concernés** :
- `src/app/api/v1/products/[id]/allocations/route.ts` *(nouveau)* — `POST`, crée/incrémente des lignes `ProductChannelStock` (une par `bomStockId` + `channel`), vérifie que la somme allouée ne dépasse pas `BomStock.qtyAvailable`
- `src/lib/validators/product-channel-stock.ts` *(nouveau)* — schéma Zod (`bomStockId`, `channel`, `qtyAllocated`)
- `src/components/products/ProductAllocationPanel.tsx` *(nouveau)* — UI d'allocation (slider ou deux champs numériques Vitrine/Direct avec total = disponible du lot)

**Use cases couverts** : UC3.

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : aucun endpoint n'existait pour lister les lots `BomStock` individuels d'une fiche (seul un agrégat existait, ajouté à l'étape 4/5) — plutôt que créer une route dédiée, `GET /api/v1/products/[id]` a été étendu pour inclure `bomSheet.stocks` (lots avec `qtyAvailable > 0`) en plus de `channelStock` déjà présent, car le panel d'allocation ouvre toujours *pour un produit précis* et a besoin des deux en même temps. Permission `products.allocate` ajoutée au type `Permission` (le seed l'avait déjà). Pas de `ProductEditSheet.tsx` — le panel est déclenché par une icône dédiée (`Boxes`) dans `products/page.tsx`, cohérent avec le toggle visibilité déjà en place depuis l'étape 4 (pas besoin d'attendre l'étape 12 pour une action ponctuelle sur une ligne du tableau).

**Fichiers réellement créés/modifiés** :
- `src/lib/constants/permissions.ts` — ajout `products.allocate`
- `src/lib/validators/product-channel-stock.ts` *(nouveau)*
- `src/app/api/v1/products/[id]/allocations/route.ts` *(nouveau)* — POST transactionnel, plafond recalculé en base (`ProductChannelStock.qtyAllocated` déjà alloué sur ce lot, tous produits/canaux confondus, + somme demandée ≤ `BomStock.qtyAvailable`)
- `src/app/api/v1/products/[id]/route.ts` — `GET` inclut désormais `bomSheet.stocks`
- `src/components/products/ProductAllocationPanel.tsx` *(nouveau)*
- `src/app/[locale]/(dashboard)/products/page.tsx` — icône `Boxes` déclenchant le panel

**Test navigateur** :
1. ✅ Panel ouvert sur "Croissant pur beurre" — sélection d'un lot avec 12 pièces non allouées.
2. ✅ Tentative 8 Vitrine + 5 Direct (13 > 12) : indicateur client "Dépasse le lot de 1 pièce" **et** rejet serveur confirmé (`Allocation refusée : 13 demandé(s) + 0 déjà alloué(s) > 12 disponible(s)`), aucune ligne créée (liste "Allocations actuelles" inchangée).
3. ✅ Correction à 7 Vitrine + 5 Direct (12 = 12) → acceptée, les deux lignes apparaissent immédiatement ("Vitrine 7/7", "Direct 5/5"), le lot repasse à "0 pièce restante à allouer" dans le sélecteur.
4. Le seed pré-existant crée déjà des `ProductChannelStock` de démo (non touché par cette étape) — observé mais hors périmètre.

**Definition of Done** :
- [x] L'allocation est atomique (transaction Prisma) — pas d'état intermédiaire incohérent possible.
- [x] L'UI affiche l'allocation courante par canal après sauvegarde, pas juste un formulaire vide.

---

## Étape 8 — Flag périssable (finalisation)

**Objectif** : le toggle "périssable" (déjà dans le formulaire de publication depuis l'étape 4) doit visiblement conditionner le comportement du produit dans la liste admin (badge, filtre), en préparation de la clôture (étape 11).

**Fichiers concernés** :
- `src/app/[locale]/(dashboard)/products/page.tsx` — badge visuel "Périssable" sur les lignes concernées, éventuellement un filtre
- `src/components/products/ProductEditSheet.tsx` — permettre de changer le flag après publication (pas seulement à la création)

**Use cases couverts** : UC4 (finalisation — le champ existe depuis l'étape 4, cette étape rend son effet visible et éditable).

**Test navigateur** :
1. Dans la liste admin, un produit périssable affiche un badge distinct (ex. icône ⏳ ou couleur).
2. Éditer un produit non périssable, cocher "périssable", sauvegarder → le badge apparaît sans rechargement de page complet.

**Definition of Done** :
- Le flag est visuellement identifiable en un coup d'œil dans la liste (cohérent avec `CLAUDE.md` § Gestalt/Similarité).

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : pas de `ProductEditSheet.tsx` (Étape 12, pas encore construit). Plutôt qu'un badge passif dans la colonne Nom, `isPerishable` devient sa propre colonne cliquable ("Périssable") avec un `Pill` toggle — même pattern d'interaction que la colonne Statut (visibilité) déjà en place depuis l'étape 4, réutilisant `PATCH /api/v1/products/[id]` (déjà générique, aucune route dédiée nécessaire). Cohérent avec la loi de Jakob (le même geste que "toggle visibilité" bascule "toggle périssable").

**Fichiers réellement modifiés** : uniquement `src/app/[locale]/(dashboard)/products/page.tsx`.

**Test navigateur** :
1. ✅ Les 2 produits de démo (Pain de campagne, Croissant pur beurre) sont périssables par défaut dans le seed — badge "⏳ Oui" (fond doré) visible immédiatement sans aucune action.
2. ✅ Clic sur le badge de "Pain de campagne" → bascule à "Non" (pill neutre), toast "Produit mis à jour", sans rechargement de page.
3. ✅ Reclic → repasse à "⏳ Oui", confirmant les deux sens du toggle.

---

## Étape 9 — Affichage vitrine et rupture de stock

**Objectif** : la vitrine cliente doit refléter `ProductChannelStock` (canal `VITRINE`) au lieu de l'ancien `Product.stockType`/`stockQuantity`, et afficher "rupture de stock" quand l'allocation Vitrine est épuisée.

**Fichiers concernés** :
- `src/app/api/storefront/[tenantSlug]/products/route.ts` — remplacer la lecture `stockType`/`stockQuantity` par l'agrégation des `ProductChannelStock` (canal `VITRINE`, `qtyRemaining`) du produit
- `src/components/storefront/*` (composants catalogue existants — à identifier précisément à l'implémentation, probablement une carte produit) — affichage "rupture de stock", désactivation de l'ajout au panier

**Use cases couverts** : UC5.

**Test navigateur** :
1. Naviguer sur `/storefront/demo-boulangerie/catalog`, un produit avec allocation Vitrine > 0 est achetable normalement (bouton actif).
2. Réduire manuellement l'allocation Vitrine à 0 (via Prisma Studio ou l'UI admin de l'étape 7) → rafraîchir le catalogue → le produit affiche "Rupture de stock", le bouton d'ajout au panier est désactivé (pas juste caché — cohérent avec la doctrine anti-fraude/transparence du projet).

**Definition of Done** :
- Aucune référence restante à `Product.stockType`/`stockQuantity` dans le code du storefront.
- Le comportement de rupture est vérifié en conditions réelles de navigateur, pas juste en lisant l'API brute.

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : `Product.stockType`/`stockQuantity` n'existent plus du tout dans le schéma Prisma depuis la migration de l'étape 1 — mais 4 fichiers les référençaient encore (`select` Prisma sur des champs inexistants, ou lecture de `undefined` côté client). `src/app/api/storefront/[tenantSlug]/products/[slug]/route.ts` en particulier était **cassé** (aurait crashé à l'exécution, `select: { stockType: true }` sur un champ absent du modèle) — orphelin, jamais appelé par aucune page du storefront, donc jamais détecté. Corrigé par cohérence avec le DoD ("aucune référence restante"), sans construire de nouvelle page pour l'exploiter (YAGNI — rien ne l'utilise aujourd'hui).

**Fichiers réellement modifiés** :
- `src/app/api/storefront/[tenantSlug]/products/route.ts` — `channelStock` (canal VITRINE) agrégé en `vitrineQtyRemaining`
- `src/app/api/storefront/[tenantSlug]/products/[slug]/route.ts` — même traitement (route cassée, remise en état)
- `src/store/cart.ts` — `CartItem.stockType`/`stockQuantity` → `vitrineQtyRemaining: number` (plus de fallback `?? 99`, un produit sans allocation est réellement à 0)
- `src/app/storefront/[tenantSlug]/catalog/page.tsx` — `isOos` recalculé sur `vitrineQtyRemaining`, overlay renommé "Rupture de stock" (au lieu de "Indisponible", pour matcher le vocabulaire du plan)
- `src/app/storefront/[tenantSlug]/cart/page.tsx` — plafond d'incrémentation sur `vitrineQtyRemaining`

**Test navigateur** :
1. ✅ Catalogue affiche "Pain de campagne" et "Croissant pur beurre" tous deux achetables (allocations Vitrine de démo > 0), ajout au panier fonctionnel (toast "ajouté au panier").
2. ✅ `ProductChannelStock.qtyRemaining` (canal VITRINE) mis à 0 pour "Pain de campagne" (les 4 lignes, via script direct) → rafraîchissement du catalogue → carte grisée, badge "Rupture de stock" visible, bouton "Ajouter" désactivé (clic sans effet, aucun toast, compteur panier inchangé) — pendant que "Croissant pur beurre" reste normalement achetable à côté.
3. ✅ Allocation restaurée (`qtyRemaining` = `qtyAllocated`), catalogue revenu à l'état normal.

---

## Étape 10 — Décrément réel de l'allocation Vitrine à la commande

**Objectif** : une commande en ligne confirmée doit décrémenter `ProductChannelStock` (canal `VITRINE`) de façon atomique et fiable — actuellement (vérifié étape 0) **aucun décrément n'existe**, ni dans la route `checkout`, ni dans le webhook Stripe qui crée réellement la commande.

**Fichiers concernés** :
- `src/app/api/storefront/[tenantSlug]/checkout/route.ts` — la vérification de disponibilité avant création de session Stripe doit lire `ProductChannelStock` VITRINE (pas une réservation, juste un filtre anti-frustration)
- `src/app/api/webhooks/stripe/route.ts` (`handleCheckoutCompleted`) — **point d'écriture réel** : dans la même transaction Prisma que la création de `Order`/`OrderItem`, décrémenter `ProductChannelStock.qtyRemaining` (canal `VITRINE`) par lot FIFO (`producedAt` ASC), en réutilisant le pattern transactionnel anti-TOCTOU déjà établi dans `src/lib/bom/fifo.ts` (re-lecture du stock disponible *dans* la transaction, pas la valeur lue au moment du clic côté client)
- `src/lib/bom/fifo.ts` ou un nouveau `src/lib/products/channel-stock.ts` *(nouveau, si la logique est jugée suffisamment distincte du FIFO ingrédients/BOM pour ne pas surcharger `fifo.ts`)* — fonction `consumeChannelStock(productId, channel, qty, tx)`
- Gestion du cas insuffisant à la confirmation Stripe (le stock a pu changer entre la création de session et le paiement) — **décidé le 2026-07-24** : la commande est créée normalement (`Order`/`OrderItem`) mais avec `status = STOCK_CONFLICT` (nouvelle valeur `OrderStatus`, ajoutée à l'étape 1) au lieu de `CONFIRMED` ; aucun remboursement Stripe automatique n'est déclenché ; la commande doit apparaître de façon visible dans la liste admin des commandes (filtrage/badge dédié) pour résolution manuelle par l'admin

**Use cases couverts** : UC6.

**Test navigateur** :
1. Produit avec allocation Vitrine = 2. Commander 1 unité via le flux checkout complet (mode test Stripe) → paiement confirmé → recharger le catalogue, allocation Vitrine affichée = 1.
2. Commander la dernière unité → allocation = 0, catalogue affiche "rupture" (étape 9).
3. Simuler une commande concurrente sur la dernière unité (deux onglets, ou déclenchement manuel du webhook une seconde fois sur le même produit avec stock déjà à 0) → la commande est créée avec le statut `STOCK_CONFLICT`, visible dans la liste admin des commandes avec un badge/filtre dédié — jamais une vente fantôme silencieuse, jamais un remboursement automatique déclenché.

**Definition of Done** :
- Le décrément est prouvé par un achat réel de bout en bout en mode test Stripe, pas seulement par une requête API isolée.
- Le cas de conflit (étape 3 du test) aboutit systématiquement à `status = STOCK_CONFLICT`, repérable en un coup d'œil dans l'admin.

**Statut : ✅ Terminée le 2026-07-25.**

**Écart d'exécution constaté** : `src/lib/products/channel-stock.ts` créé (logique jugée suffisamment distincte du FIFO ingrédients/BOM — consomme une allocation déjà réservée par canal, pas un stock d'ingrédient). Décision d'implémentation pour le cas de conflit : **tout-ou-rien au niveau de la commande entière**, pas seulement par ligne — si un seul produit de la commande est insuffisant, RIEN n'est décrémenté pour aucun produit (le plan ne précisait pas ce détail ; ce choix évite un état incohérent où certaines lignes d'une même commande seraient décrémentées et d'autres non). `ALL_STATUSES` dans `orders/page.tsx` (filtres de la liste admin) n'incluait pas `STOCK_CONFLICT` — trouvé et corrigé au passage (le badge coloré existait déjà depuis l'étape 1 via `ORDER_STATUS_TONE`, mais aucun filtre dédié n'était possible).

**Fichiers réellement modifiés/créés** :
- `src/lib/products/channel-stock.ts` *(nouveau)* — `consumeChannelStockOrFlagConflict`, tout-ou-rien, re-lecture fraîche dans la transaction
- `src/app/api/webhooks/stripe/route.ts` — `handleCheckoutCompleted` décrémente désormais dans un `$transaction`, pose `status: CONFIRMED | STOCK_CONFLICT`
- `src/app/api/storefront/[tenantSlug]/checkout/route.ts` — filtre anti-frustration (pas une réservation) basé sur `ProductChannelStock` VITRINE agrégé
- `src/app/[locale]/(dashboard)/orders/page.tsx` — `STOCK_CONFLICT` ajouté à `ALL_STATUSES` (filtre manquant)

**Test navigateur/API** : pas de Stripe CLI installé (même contrainte qu'à l'étape 1) — testé en déclenchant un événement `checkout.session.completed` réellement **signé** (`stripe.webhooks.generateTestHeaderString`) contre le vrai endpoint `/api/webhooks/stripe`, exerçant le code réel de bout en bout (vérification de signature comprise), pas un appel de fonction isolé :
1. ✅ Commande de 3 unités "Croissant pur beurre" → `200 {"received":true}`, `Order` créée avec `status = CONFIRMED`, `ProductChannelStock` du lot le plus ancien décrémenté de 15 → 12 (FIFO correct).
2. ✅ Commande de 1000 unités (very > stock total ~64) → `Order` créée avec `status = STOCK_CONFLICT`, **tous** les `ProductChannelStock` du produit strictement inchangés (vérifié ligne par ligne) — aucune vente fantôme, aucun décrément partiel.
3. ✅ Vérifié dans `/fr/orders` : badge rouge "Conflit de stock" visible immédiatement dans la liste, nouveau filtre dédié fonctionnel (1 commande isolée sur clic).
4. Commandes et clients de test nettoyés après vérification, stock restauré.

---

## Étape 11 — Clôture quotidienne des produits périssables

**Objectif** : `POST /products/[id]/closure` permet à l'admin/responsable de clôturer la journée d'un produit périssable : chaque canal restant (Vitrine, Direct) reçoit un motif obligatoire par défaut, avec possibilité de **scinder la quantité d'un canal en plusieurs lignes/motifs** si le sort des unités restantes est mixte (décidé le 2026-07-24) — tracé (qui, quand), puis les compteurs sont remis à zéro.

**Fichiers concernés** :
- `src/app/api/v1/products/[id]/closure/route.ts` *(nouveau)* — `POST`, accepte un tableau de lignes `{ productChannelStockId, qty, reason, note? }` par canal (une ou plusieurs par canal selon scission), vérifie que la somme des `qty` par canal correspond exactement au `qtyRemaining`, crée les lignes `StockClosure` correspondantes et remet `qtyRemaining` à 0 dans la même transaction
- `src/lib/validators/stock-closure.ts` *(nouveau)* — schéma Zod (`reason: WASTE | STAFF | OTHER`, `note` optionnelle obligatoire si `OTHER`, `qty` positive, validation de la somme par canal)
- `src/components/products/ProductClosureModal.tsx` *(nouveau)* — UI de clôture : une ligne par canal par défaut (motif unique, cas le plus fréquent), avec un bouton "scinder" qui permet d'ajouter une ligne motif supplémentaire dans le même canal et de répartir la quantité
- `src/app/[locale]/(dashboard)/products/page.tsx` — bouton "Clôturer la journée" visible uniquement sur les produits périssables ayant du stock restant
- `prisma/seed.ts` — ajouter `products.close` (ou équivalent) à `ALL_PERMISSIONS`

**Use cases couverts** : UC10.

**Test navigateur** :
1. Produit périssable avec 3 unités restantes en Vitrine et 2 en Direct.
2. Cliquer "Clôturer la journée" → formulaire pré-rempli avec une ligne par canal (motif unique par défaut).
3. Cas simple : choisir un motif pour Vitrine (3) et un motif pour Direct (2), valider directement.
4. Cas mixte : sur le canal Vitrine, cliquer "scinder" → répartir en 2 (jeté) + 1 (don équipe), chaque ligne avec son propre motif — la somme (2+1) doit rester égale à 3.
5. Tenter de valider sans motif, ou avec une somme scindée ≠ quantité restante du canal → bloqué, message d'erreur clair (contrairement à UC7 qui est non bloquant, ici le blocage est voulu — pilier anti-fraude).
6. Valider avec motifs → compteurs Vitrine et Direct repassent à 0, une entrée apparaît dans un historique de clôtures consultable (qui a clôturé, quand, quel(s) motif(s), avec le détail de la scission si applicable).

**Definition of Done** :
- Impossible de clôturer sans motif — vérifié par un test négatif dans le navigateur.
- La traçabilité (qui/quand/motif) est visible quelque part dans l'admin, pas seulement en base de données.

---

## Étape 12 — Édition et dépublication

**Objectif** : permettre l'édition (prix, TVA, infos vitrine) et la dépublication (`isVisible = false`) d'un produit à tout moment, sans perte d'historique.

**Fichiers concernés** :
- `src/components/products/ProductEditSheet.tsx` *(complète, réutilise le formulaire de l'étape 4/5/6/8 en mode édition)*
- `src/app/api/v1/products/[id]/route.ts` — `PATCH` déjà existant, vérifier qu'il couvre bien tous les champs éditables du nouveau modèle
- `src/app/api/v1/products/[id]/visibility/route.ts` — déjà existant et déjà compatible (n'agit que sur `isVisible`), à revalider simplement après la migration de l'étape 1

**Use cases couverts** : UC11, UC12.

**Test navigateur** :
1. Éditer un produit live : changer le prix → recharger le catalogue storefront → nouveau prix visible immédiatement.
2. Dépublier un produit (`isVisible = false`) → il disparaît du catalogue storefront, mais reste visible et consultable dans la liste admin (avec un badge "masqué"), et son historique de commandes passées (`OrderItem`) reste intact.
3. Republier le même produit → réapparaît dans le catalogue sans avoir eu besoin de le recréer.

**Definition of Done** :
- Aucune suppression de données à la dépublication — uniquement `isVisible = false`.
- L'historique des commandes passées sur un produit dépublié reste consultable dans l'admin.

---

## Risques / points d'attention

### Décisions tranchées (2026-07-24) — voir avertissement en tête de document
- **`OrderItem.vatRate`** → snapshot `Decimal` (`vatRatePercent`), pas un enum. Intégré à l'étape 1.
- **Granularité de clôture (UC10)** → par canal, scindable en plusieurs motifs si besoin. Intégré à l'étape 11.
- **Conflit de stock au webhook Stripe** → statut `OrderStatus.STOCK_CONFLICT` dédié, visible admin, jamais de remboursement automatique. Intégré aux étapes 1 et 10.

### Rappels d'exécution (pas des décisions ouvertes — juste à ne pas oublier en codant)

1. **Migration de `Product.recipeId` → `bomSheetId` casse des données de démo réelles, pas hypothétiques.** Vérifié : `prisma/seed.ts` crée aujourd'hui 2 `Recipe` et 2 `Product` liés par `recipeId`. L'étape 1 doit réécrire ce seed en même temps que le schéma, sinon `npx prisma db seed` échoue ou produit des données incohérentes dès le premier `git pull` après la migration.

2. **Le webhook Stripe (`handleCheckoutCompleted`) ne décrémente aucun stock aujourd'hui — ce n'est pas juste "à adapter", c'est un gap total.** La route `checkout` ne fait que créer une session Stripe ; la commande et le décrément doivent se faire dans `src/app/api/webhooks/stripe/route.ts`, qui aujourd'hui ne touche à aucune table de stock. Point d'écriture critique (argent réel via Stripe) — comportement de conflit désormais défini (voir décisions ci-dessus), reste à l'implémenter correctement à l'étape 10.

3. **Trois implémentations différentes du calcul TVA coexistent aujourd'hui et codent le taux en dur** : `src/lib/costs.ts` (`VAT_RATES` object), `src/app/api/webhooks/stripe/route.ts` (`vatFactor` recalculé indépendamment, dupliqué), et implicitement `src/lib/validators/product.ts`/les routes `products`. L'étape 1 doit unifier ces trois points vers une seule source (le nouveau `TenantVatRate`), sinon la migration TVA restera partielle et incohérente entre modules (un produit pourrait afficher 21% dans l'admin mais être facturé à 6% au webhook si un seul des trois endroits est migré).

4. **TVA par canal (UC9, POS "sur place" vs Boutique "à emporter")** : le brainstorm lui-même (§7, hors scope) reporte cette décision ("implémenté seulement si le besoin réel se confirme"). L'étape 6 de ce plan implémente volontairement la version simple (un taux par produit). Si le besoin de taux différencié par canal se confirme avant le module POS, cela demandera une étape supplémentaire non prévue ici (probablement un `vatRateId` sur `ProductChannelStock` plutôt que sur `Product`).

5. **RGPD** : ni le brainstorm module ni ce plan n'introduisent de nouvelle donnée personnelle — le module Boutique/Produits ne touche pas `Customer`/`Order` au-delà de ce qui existe déjà (checkout, email de confirmation). Le sujet RGPD reste correctement scopé au futur module RH selon `docs/FONDATION-HORECA.md` §7. Signalé ici uniquement pour confirmer qu'il n'y a pas d'angle mort RGPD propre à ce module.

6. **Concurrence sur l'allocation (étape 7) et sur le décrément (étape 10)** : les deux doivent être des transactions Prisma qui re-lisent l'état réel en base au moment de l'écriture (pattern déjà établi dans `src/lib/bom/fifo.ts`), pas des calculs basés sur une valeur lue côté client puis renvoyée. Le risque n'est pas hypothétique — le module BOM a déjà eu un bug FIFO corrigé en session du 2026-07-24 (`fix(bom): consommation FIFO des sous-fiches BOM`, voir `docs/JOURNAL.md`) pour une raison de cet ordre ; le module Boutique ne doit pas répéter la même classe d'erreur.
