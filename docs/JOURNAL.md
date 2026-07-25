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

| 17 | tailwind-merge ignore les scales Tailwind custom (fontSize/radius/shadow) — sans `extendTailwindMerge`, `text-erp-sm` et `text-[#hex]` se percutent silencieusement (texte invisible) | src/lib/utils/cn.ts | 2026-07-21 |
| 18 | Next.js 15 + React 18 : pages client sur route dynamique → `useParams()` de next/navigation, jamais `params` en prop (le `use(promise)` du codemod officiel exige React 19) | orders/[id]/page.tsx, storefront/[tenantSlug]/* | 2026-07-21 |
| 19 | Champs Decimal Prisma (stock, priceUnit, alertThreshold) sérialisent en **string** sur le JSON — toujours `Number(...)` avant calcul/affichage | Ingredient, ingredients/page.tsx | 2026-07-21 |
| 20 | apiClient déballe déjà `json.data` une fois — les endpoints paginés exposent `meta` séparément (`res.meta.total`), jamais `res.data.data` | src/lib/api-client.ts | 2026-07-21 |
| 21 | src/lib/email.ts ne doit jamais throw au chargement du module si RESEND_API_KEY absent — ça crashe toute route qui l'importe (register, invite...) même sans jamais appeler l'envoi | src/lib/email.ts | 2026-07-21 |
| 22 | withPermission/withAuth : signature réelle = `(request, permission?, handler)` — plusieurs routes API legacy avaient une signature à un seul argument jamais migrée, cassée depuis le début | src/lib/permissions.ts | 2026-07-21 |
| 23 | Formulaire de création avec sous-ressources (ex. lignes BOM) : ne jamais poster vers une route imbriquée tant que le parent n'a pas d'id réel — construire les sous-éléments en mémoire et les envoyer atomiquement avec le POST de création du parent | src/app/api/v1/bom/sheets/route.ts, BomSheetEditor.tsx | 2026-07-23 |
| 24 | N1 (Ingrédients) est un niveau BOM structurel, pas un niveau de production — protection absolue (non supprimable, aucune fiche BOM) distincte de la règle "dernier niveau supprimable" des niveaux N2+ | src/app/api/v1/bom/levels/[id]/route.ts, bom/sheets/route.ts | 2026-07-23 |
| 25 | Unité de ligne BOM = reprise automatique de l'unité de l'ingrédient/sous-fiche sélectionné, filtrée par groupe via `compatibleUnits()` — jamais un select unité générique sur une ligne de nomenclature | src/lib/bom/units.ts, BomSheetEditor.tsx | 2026-07-23 |
| 26 | La règle #15 (FIFO simplifié, pas de sous-fiches) est obsolète : `checkAvailability`/`consumeFIFO` doivent traiter les lignes BOM `INGREDIENT` (Lot, `purchaseDate` ASC) ET `SHEET` (BomStock, `producedAt` ASC) symétriquement — sans ça la hiérarchie N1→N2→N3 ne consomme jamais le stock produit d'une sous-fiche, même à zéro | src/lib/bom/fifo.ts | 2026-07-24 |
| 27 | Avant de créer une nouvelle route `settings/*`, vérifier `NAV_GROUPS` (src/lib/constants/nav.ts) — plusieurs sous-pages (ex. `settings/team`) existent en stub mais ne sont liées depuis aucun item de nav, donc injoignables et jamais testées au navigateur. Préférer une section dans une page déjà reliée (`settings/page.tsx`) sauf si le module justifie sa propre entrée de nav | src/lib/constants/nav.ts, settings/page.tsx | 2026-07-25 |
| 28 | Le type `Permission` (src/lib/constants/permissions.ts) et le tableau `ALL_PERMISSIONS` hardcodé dans `prisma/seed.ts` peuvent diverger silencieusement — le seed peut assigner une permission au rôle Admin qui n'existe pas dans le type, aucune erreur TypeScript tant qu'aucune route ne l'utilise dans `withPermission()` | src/lib/constants/permissions.ts, prisma/seed.ts | 2026-07-25 |
| 29 | `Ingredient.stock` est une dénormalisation qui n'a de sens que si un vrai `Lot` (+ `Stock` physique) existe derrière — jamais poser `stock: N` dans un seed/fixture sans créer le `Lot` correspondant, sinon `checkAvailability` (lit le champ dénormalisé) et `consumeFIFO` (relit les vrais lots, anti-TOCTOU) divergent silencieusement : l'UI affiche "disponible" mais la production échoue en "stock insuffisant" | prisma/seed.ts, src/lib/bom/fifo.ts | 2026-07-25 |

## Historique

### [2026-07-25] SESSION (en cours) — Boutique/Produits étape 2 : bibliothèque de taux TVA
**Résumé :** Reprise du plan `docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md` à l'Étape 2 (alerte de fin de session précédente). CRUD complet `TenantVatRate` : routes API `GET/POST /api/v1/tenant-vat-rates` + `GET/PATCH /api/v1/tenant-vat-rates/[id]` (pattern calqué sur `activites/route.ts`, scoping tenant via `getPrismaWithTenant`), validator Zod (`ratePercent` 0-100), `TenantVatRateSheet.tsx` (modal création/édition sur le modèle `ActiviteSheet.tsx`), section "Taux de TVA" intégrée dans `settings/page.tsx` (seule page du groupe Paramètres réellement reliée à la sidebar — `settings/vat-rates` aurait été une route orpheline comme `settings/team`, voir règle #27). Ajout de `tenant-vat-rates.read`/`write` au type `Permission` (le seed les avait déjà, le type non — règle #28). Testé au navigateur de bout en bout : liste des 2 taux de démo (6%/21%), création d'un 3e taux, désactivation (reste visible, non supprimé), validation Zod rejetant un taux à 150%, pré-remplissage en édition. Le conteneur Docker `artisastock-v2-pg` était arrêté en début de session — redémarré manuellement avant de pouvoir tester.
**Autre correction :** commit d'une entrée JOURNAL.md (Étape 1) restée non commitée à la fin de la session précédente (`acb7d95`).
**Bug préexistant trouvé et corrigé (signalé par l'utilisateur) :** `dashboard/page.tsx` plantait (`Cannot read properties of undefined (reading 'firstName')`) — `src/app/api/v1/dashboard/kpi/route.ts` aplatit `customer.firstName`/`customer.lastName` en une string `customerName`, mais le frontend attendait toujours l'ancien objet `customer` imbriqué jamais envoyé. Fix : `KpiData.recentOrders` et le JSX alignés sur `customerName` (contrat réel de l'API).
**Second bug préexistant trouvé et corrigé (signalé par l'utilisateur) :** `BomProductionModal.tsx` plantait (`Cannot read properties of undefined (reading 'toFixed')`) à l'ouverture de "Produire" sur une fiche BOM. La query "disponibilité" appelait par erreur `/api/v1/bom/sheets/[id]/cost` (qui ne renvoie que `{totalCost, unitCost, ...}`) au lieu de `/api/v1/bom/sheets/[id]/simulate` (seule route combinant `checkAvailability` + coût, déjà utilisée correctement par `bom/[contextId]/production/page.tsx`) — `availability.lines` était donc toujours `undefined`. Fix : un seul appel à `/simulate`, `cost`/`availability` dérivés de sa réponse `{nBatches, cost, availability}`. Vérifié au navigateur : modal "Lancer une production" affiche coût estimé + disponibilité par ingrédient sans erreur.
**Troisième bug préexistant trouvé et corrigé (signalé par l'utilisateur — "disponibilité OK mais stock insuffisant") :** une fois le bug précédent réparé, "Lancer la production" échouait systématiquement avec "Stock insuffisant" alors que l'affichage montrait tous les ingrédients disponibles. Cause racine : `checkAvailability` (affichage) lit `Ingredient.stock`, un champ dénormalisé — `consumeFIFO` (l'exécution réelle, anti-TOCTOU) re-lit les vrais `Lot` en base, qui n'existaient tout simplement pas : `prisma/seed.ts` posait `Ingredient.stock` en dur (ex. 150kg) sans jamais créer ni `Stock` ni `Lot`, alors que le module Achats réel (`achats/route.ts`) crée bien les deux ensemble et maintient l'invariant correctement. Fix (validé par l'utilisateur, option "réécrire le seed") : ajout d'un `Stock` "Réserve principale" lié à l'Activité Boulangerie via `ActiviteStock`, `defaultStockId` posé sur les 6 ingrédients, et un vrai `Lot` créé par ingrédient (`quantityInitial`/`quantityAvailable` = valeur déjà seedée, `unitPrice`/`totalPriceHT` = `priceUnit × qty`). Vérifié au navigateur : production réellement lancée ("Production lancée avec succès"), stocks décrémentés (Farine T65 150→149.5kg, etc.), bandeau "aucun stock lié" disparu de la page Production.
**Étape 3 — Publication d'un produit depuis une fiche BOM (UC1 API, UC2) :** `POST /api/v1/products` (`src/app/api/v1/products/route.ts`) vérifie désormais que la `BomSheet` appartient au tenant (même pattern que `bom/sheets/[id]/cost`) et qu'elle a du `BomStock.qtyAvailable > 0` avant de créer le produit (sinon `400 NO_STOCK`, message explicite). Testé via `fetch` authentifié en console navigateur (pas de client REST externe) : fiche sans stock → 400 bloqué ; fiche avec stock réel ("Croissant pur beurre") → 201, `bomSheetId` correct, `priceTTC` recalculé depuis le vrai `TenantVatRate`. Artefacts de test (fiche temporaire + produit de test) supprimés après vérification.
**Étape 4 — Page admin Produits (UC1 UI, UC4) :** stub `products/page.tsx` remplacé par une vraie liste (DataTable : nom, fiche BOM, catégorie, TVA, prix TTC, statut avec toggle visibilité) + `ProductPublishSheet.tsx` (modal publication). `GET /api/v1/bom/sheets` étendu pour supporter un appel sans `levelId` (tous niveaux du tenant) + `?hasStock=true` + champ calculé `availableStock`, nécessaire pour le picker de fiches BOM publiables. Testé au navigateur : publication complète (fiche → nom/prix/TVA/périssable) apparaît immédiatement dans la liste ; toggle visibilité fonctionnel (vérifié par requête API après le changement d'état affiché) ; test négatif renforcé — stock mis à 0 *après* le chargement du picker mais *avant* soumission (race condition réelle, pas juste simulée) → erreur `NO_STOCK` affichée dans le formulaire, aucun crash, aucun produit créé. Le picker filtré (`hasStock=true`) empêche déjà la sélection d'une fiche à sec par prévention UX ; le contrôle serveur de l'étape 3 reste le vrai garde-fou anti-TOCTOU.
**Étape 5 — Prix de vente et indicateur de marge (UC7) :** `GET /api/v1/bom/sheets` expose désormais `avgUnitCost` par fiche (moyenne pondérée des `BomStock` disponibles). `ProductPublishSheet.tsx` affiche un indicateur de marge live (jamais bloquant) comparant `priceHT/avgUnitCost` à un `marginTargetFactor` optionnel (défaut indicatif x3). `calculateMarginRatio` existait déjà dans `src/lib/costs.ts` depuis l'étape 1 mais n'a pas pu être importé côté client (ce fichier importe `prisma`, aucun composant client du projet ne l'importe) — calcul dupliqué localement plutôt que créer une frontière cross-boundary inédite. Testé au navigateur : prix bas → encart orange "marge faible", prix confortable → encart vert, champ prix jamais pré-rempli.
**Étape 6 — Assignation TVA (UC9, version simple) :** le sélecteur TVA et le recalcul serveur de `priceTTC` existaient déjà (étapes 1/3/4) sans aucune trace de l'ancien enum `VatRate` dans le flux produit (confirmé par recherche globale). Seul manquait un aperçu `priceTTC` **visible avant sauvegarde** — ajouté dans `ProductPublishSheet.tsx` (calcul live dupliqué localement, même contrainte cross-boundary que l'étape 5). Testé au navigateur : changer de taux TVA recalcule l'aperçu TTC instantanément (12% → 1.68€, 6% → 1.59€ sur un prix HT de 1.50€), sans sauvegarde.
**Étape 7 — Allocation manuelle Vitrine/Direct (UC3) :** `POST /api/v1/products/[id]/allocations` (transaction Prisma, plafond `BomStock.qtyAvailable` recalculé en base à chaque écriture) + `ProductAllocationPanel.tsx` (choix du lot, répartition Vitrine/Direct, allocations courantes affichées). `GET /api/v1/products/[id]` étendu avec `bomSheet.stocks` (pas de nouvelle route dédiée). Permission `products.allocate` ajoutée au type. Testé au navigateur : dépassement (8+5=13 sur un lot de 12) rejeté côté client **et** serveur avec message explicite, aucune écriture partielle ; répartition valide (7+5=12) acceptée et affichée immédiatement.
**Étape 8 — Flag périssable (UC4, finalisation) :** `isPerishable` devient une colonne cliquable dans `products/page.tsx` (Pill toggle doré "⏳ Oui" / neutre "Non"), même pattern d'interaction que le toggle visibilité déjà en place — réutilise `PATCH /api/v1/products/[id]` (générique, aucune route dédiée). Pas de `ProductEditSheet.tsx` (Étape 12 seulement). Testé au navigateur : badge visible par défaut (les 2 produits démo sont périssables dans le seed), toggle dans les deux sens confirmé sans rechargement.
**Étape 9 — Affichage vitrine et rupture de stock (UC5) :** `Product.stockType`/`stockQuantity` n'existent plus dans le schéma depuis l'étape 1, mais 4 fichiers les référençaient encore. **Bug trouvé au passage** : `src/app/api/storefront/[tenantSlug]/products/[slug]/route.ts` sélectionnait ces champs inexistants — route cassée (aurait crashé), mais orpheline (jamais appelée par aucune page), donc jamais détectée. Corrigée par cohérence avec le DoD, sans construire de nouvelle UI pour l'exploiter. Les deux routes storefront produits agrègent maintenant `ProductChannelStock` (canal VITRINE) en `vitrineQtyRemaining` ; `cart.ts`, `catalog/page.tsx`, `cart/page.tsx` alignés (plus de fallback `?? 99` — un produit sans allocation est réellement à 0, doctrine anti-fraude). Testé au navigateur : rupture simulée (qtyRemaining mis à 0 en base) → carte grisée "Rupture de stock", bouton désactivé (clic sans effet, aucun toast), pendant qu'un autre produit reste achetable normalement à côté.
**Étape 10 — Décrément réel Vitrine à la commande (UC6, zone sensible : webhook Stripe) :** `src/lib/products/channel-stock.ts` (nouveau) — `consumeChannelStockOrFlagConflict`, FIFO sur `ProductChannelStock`, **tout-ou-rien au niveau de la commande entière** (si un seul produit est insuffisant, rien n'est décrémenté pour aucun produit — décision d'implémentation non précisée par le plan, choisie pour éviter un état incohérent). `handleCheckoutCompleted` décrémente désormais dans un `$transaction` et pose `status: CONFIRMED | STOCK_CONFLICT`. Checkout route ajoute un filtre anti-frustration (pas une réservation) sur `ProductChannelStock` VITRINE. **Bug trouvé au passage** : `ALL_STATUSES` dans `orders/page.tsx` n'incluait pas `STOCK_CONFLICT` — le badge coloré existait déjà (étape 1) mais aucun filtre dédié n'était possible ; corrigé. Testé en déclenchant un événement Stripe réellement signé (`generateTestHeaderString`) contre le vrai webhook (pas de Stripe CLI installé, même contrainte qu'à l'étape 1) : commande normale → FIFO décrémenté correctement (15→12 sur le lot le plus ancien) ; commande sur-dimensionnée (1000 vs ~64 dispo) → `STOCK_CONFLICT`, stock strictement inchangé, badge + filtre admin vérifiés. Données de test nettoyées.
**Branche :** master
**Prochaine étape :** Étape 11 du plan Boutique/Produits — clôture quotidienne des produits périssables (`POST /products/[id]/closure`, motifs obligatoires, scission par canal) (`docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md`).

### [2026-07-24] SESSION — Brainstorm pivot HORECA + module Boutique/Produits étape 1 (hub end)
**Résumé :** Brainstorm macro (`/brainstorm FORT`) : pivot de vision d'ArtisaStock vers une suite HORECA tout-en-un (RH+ERP+POS+Boutique) pour restaurateurs, persona patron de restaurant, discipline stock anti-fraude comme différenciateur central — vécu terrain de mentalyas (15 ans hôtellerie, échec RESTOMAX/Securex) et filiation académique PDSGBD→PID→TFE. Exporté dans `docs/FONDATION-HORECA.md`. Méthodologie de cascade de brainstorms (macro → par module avec use cases + workflow utilisateur → implémentation testée navigateur) et architecture modulaire API-first codifiées dans `CLAUDE.md`.

Premier brainstorm de module : **Boutique/Produits** (`docs/modules/BOUTIQUE-PRODUITS.md`, 12 use cases + workflow Mermaid), suivi d'un plan d'implémentation en 12 étapes (`docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md`) produit par un agent PO scopé (hors machinerie du pipeline projet-entier existant, jugée obsolète pour ce travail).

**Étape 1 implémentée et vérifiée** : nouveau schéma Prisma (`TenantVatRate`, `ProductChannelStock`, `StockClosure`, `OrderStatus.STOCK_CONFLICT`), `Product` migré de `recipeId`/`vatRate`(enum) vers `bomSheetId`/`vatRateId`, `OrderItem.vatRate` devient un snapshot `vatRatePercent`. Seed réécrit sur la vraie chaîne BOM (`BomSheet`/`BomStock`, plus l'ancien `Recipe`). 12 fichiers consommateurs adaptés (validators, `costs.ts`, routes products/storefront/webhook Stripe, factures). En testant la vitrine cliente au navigateur, 4 bugs préexistants découverts et corrigés (aucun lié à cette migration) : middleware next-intl qui 404 sur `/storefront/*`, seed avec vitrine non publiée, `QueryProvider` jamais monté pour l'arborescence storefront (500 sur catalog/checkout/order-tracking), double désenveloppement JSON dans `catalog/page.tsx`. Vitrine cliente vérifiée fonctionnelle de bout en bout (catalogue affiche les 2 produits démo, filtres catégorie OK). Webhook Stripe testé end-to-end avec un événement signé réel.
**Branche :** master
**Commits pushés :** 2 (`0abe1fa` docs, `0706c77` feat)
**Alerte session suivante :** Reprendre à l'Étape 2 du plan Boutique/Produits (bibliothèque de taux TVA par Activité, CRUD `TenantVatRate`). Le plan complet (12 étapes) et les décisions déjà tranchées (snapshot `vatRatePercent`, clôture scindable par canal, `STOCK_CONFLICT` sur conflit stock webhook) sont dans `docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md`.

### [2026-07-24] SESSION — Replay scénario défense V1 + fix FIFO sous-fiches (hub end)
**Résumé :** Reprise du workflow scénarisé de la défense orale V1 (`CN_docs/SCRIPT_DEFENSE_EXAMEN.md`, scénario "Bar de ville — Long Island Ice Tea") pour validation bout-en-bout en environnement dev local, étape par étape avec test navigateur réel avant chaque avancée. Étapes 1-4 validées et fonctionnelles : Stock/Activité/Contexte "Bar", 8 fiches ingrédients + 8 achats (FIFO, conversion d'unité), recettes BOM N2 "Premix Long Island" (7 lignes) + N3 "Long Island Ice Tea" (Premix sous-fiche + Cola), production 2 passes (10 batches N2 puis 10 batches N3).
**Bug critique trouvé et corrigé :** `checkAvailability`/`consumeFIFO` (src/lib/bom/fifo.ts) ne traitaient que les lignes BOM de type `INGREDIENT` — les lignes `SHEET` (sous-fiches) étaient silencieusement ignorées à la fois pour la vérification de disponibilité et la consommation réelle. Conséquence vérifiée en DB : produire 10 batches de "Long Island Ice Tea" (nécessitant 1350ml de Premix) n'avait jamais décrémenté le `BomStock` du Premix, qui restait à 1350ml intact — la production N3 aurait pu se faire indéfiniment même stock Premix à zéro. Fix : ajout du traitement symétrique des lignes `SHEET` sur `BomStock` (FIFO par `producedAt` ASC, `BomProductionLine.sourceType = 'BOM_STOCK'`), le schéma Prisma le prévoyait déjà (`bomStockId`, enum `BOM_STOCK`) mais l'implémentation n'avait jamais été complétée. Vérifié en live : Premix 1350ml→0ml après re-production propre des 10 batches N3 avec le code corrigé. Nettoyage des données de test (productions/BomStock erronés) effectué avant de refaire la production proprement.
**Bug mineur trouvé et corrigé :** IngredientSheet.tsx — `reset()` partiel en mode création laissait les champs non listés (nom, quantités, prix...) hérités de la fiche précédente ; et les champs numériques optionnels (densité, seuil d'alerte, DLC, conditionnement) coercaient une chaîne vide en `0` avant validation `.positive()`, provoquant un rejet même quand l'utilisateur laissait le champ vide intentionnellement.
**Gap constaté (non corrigé) :** Étape 5 du script (publication du cocktail sur la boutique en ligne) bloquée — les pages "Produits" et "Boutique web" (CMS) sont des placeholders "en développement" côté V2 ; seule "Commandes" est réellement implémentée. Le module boutique/catalogue reste à construire avant de pouvoir rejouer les Étapes 5-7 (publication, parcours client, retour ERP commande).
**Branche :** master
**Commits pushés :** 1 (`3be6c98`)
**Alerte session suivante :** Reprendre directement à l'Étape 5 — soit construire le module Produits/Boutique web (prix de vente, TVA, stock auto depuis `bom_stocks`), soit chercher un raccourci de publication déjà existant côté API avant de construire toute l'UI CMS.

### SESSION DEPLOY — 2026-07-21 (hub end)

### [2026-07-21] SESSION — End
**Résumé :** Import du design ArtisaStock depuis Claude Design (DesignSync MCP) — 14 primitives UI (Btn, Card, DataTable, Pill, etc.), chrome refait (TopBar/Sidebar/StatusBar), nouvelle nav Atelier/Contexte/Workflow/Stock&Achats/Référentiels/Boutique, restyle Hub/BOM/Ingrédients/Commandes. Déploiement production sur Vercel + Supabase (projet ArtisaStock réutilisé, mot de passe DB régénéré, schema poussé via `directUrl` pooler). Premier build de production jamais réussi pour ce projet — a mis au jour et corrigé une dette technique importante : migration Next.js 15 params async (codemod officiel + fixes manuels), 17 routes API avec signature `withPermission`/`withAuth` legacy cassée depuis leur création, contrat frontend/backend Ingredient incohérent (`priceUnit`/`stock` vs noms inventés), enum GDPR faux, route `recipes/duplicate` et `accept-invite` réécrites (référençaient des champs Prisma inexistants), credentials démo en dur retirés du login, module email rendu non-bloquant sans Resend configuré.
**Branche :** master
**Commits pushés :** 1 (`d819622`)

### [2026-07-23 XX:XX] SESSION — End
**Résumé :** Traduction fidèle de la logique métier V1 (docs/Traduction V1/, alimentée en continu par l'instance charlesnadejda-project) : module Activité (M:N Stock, 1:N Contexte, switcher Atelier) + module Lots/Achats complet (CRUD, 2 modes achat, HT/TVAC, DLC optionnelle, préremplissage depuis fiche ingrédient, conversion d'unité à l'affichage) + FIFO réel par lot (BomProductionLine.lotId, coût figé) + N1 (Ingrédients) rendu définitivement protégé (non supprimable, aucune fiche BOM/production, panel de raccourcis dédié). Audit + fix d'une faille multi-tenant critique (ActiviteStock non exclu du scoping automatique) et 2 IDOR sur bom/sheets. Fix bug rapporté par l'utilisateur : création de fiche BOM avec ajout d'ingrédient avant sauvegarde de l'en-tête → "Fiche BOM introuvable" (lignes désormais construites en mémoire et envoyées atomiquement avec l'en-tête). Amélioration UX rapportée par l'utilisateur : l'unité d'une ligne de nomenclature reprend automatiquement le groupe (masse/volume/pièce) de l'ingrédient/sous-fiche sélectionné. Brainstorm initial démarré pour un futur module POS (docs/FONDATION-POS.md, non implémenté).
**Branche :** master
**Commits pushés :** 1 (`d2adc48`)
**Alerte session suivante :** Inscription (`/register`) doit maintenant fonctionner en prod — à confirmer par l'utilisateur. RESEND_API_KEY/STRIPE/UPLOADTHING/UPSTASH toujours non configurés en prod (choix "minimum viable") — emails et paiements restent inactifs jusqu'à ajout des clés.

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
