# Scénario de test réel — Boulangerie (patron, étudiants, vendeuses, boutique en ligne)

> **Date :** 2026-08-09
> **Méthode :** test en direct sur `https://artisastock-v2.vercel.app` (pas de revue de code statique), tenant dédié `Boulangerie Test Claude` (slug `boulangerie-test-claude`), créé et rempli intégralement dans le navigateur.
> **Objectif :** valider le parcours complet décrit par l'utilisateur — patron super-admin qui crée ses fiches ingrédients/recettes, étudiants qui préparent chaque jour (pâtes la veille, pains le matin), vendeuses qui vendent au comptoir depuis le stock produit, boutique en ligne où les clients commandent la veille pour le lendemain depuis un stock réservé séparé.
> **Suite de :** `docs/SECURITY-AUDIT.md` (audit sécurité) puis audit de cohérence métier (45 règles JOURNAL.md) — cette session teste le produit fini du point de vue de l'usage réel, pas du code.

---

## Résumé exécutif

| Sous-scénario | Statut | Sévérité du problème principal |
|---|---|---|
| 1. Patron — fiches ingrédients/recettes (BOM) | ✅ Fonctionne globalement | Mineure (UX, précision d'affichage) |
| 2. Étudiants — fiches techniques quotidiennes | ⚠️ Gap fonctionnel | Moyenne (fonctionnalité absente, pas de contournement propre) |
| 3. Vendeuses — vente comptoir depuis stock produit | ❌ **Ne fonctionne pas pour ce cas d'usage** | **Critique — incompatibilité architecturale confirmée en direct** |
| 4. Boutique en ligne — commande J-1, stock réservé | ❌ **Totalement inaccessible** | **Critique — bug de déploiement confirmé, bloque un module marqué "terminé"** |

Les deux blocages critiques (§3 et §4) empêchent aujourd'hui les deux canaux de vente que l'utilisateur a explicitement décrits (comptoir et boutique en ligne) de fonctionner comme prévu — pour deux raisons entièrement différentes (design produit vs bug de config), détaillées ci-dessous.

---

## 1. Patron super-admin — création fiches ingrédients & recettes

**Parcours testé :** création de 4 ingrédients (Farine T55, Eau, Levure fraîche, Sel fin) → achats (création de `Lot` réels avec prix/conditionnement) → fiche N2 "Pâte à pain de campagne" (4 lignes ingrédient, sortie 1000g) → fiche N3 "Pain de campagne (750g)" (1 ligne sous-fiche, 800g de pâte/unité) → simulation de production à chaque niveau → confirmation → vérification du décrément FIFO.

### Ce qui fonctionne
- Chaîne de production complète N1→N2→N3 prouvée de bout en bout : achat crée un vrai `Lot`, la fiche N2 consomme les ingrédients via FIFO, la fiche N3 consomme la sous-fiche N2 via `BomStock` FIFO (`producedAt` ASC) — exactement le comportement documenté par la règle #26 du JOURNAL.
- Contrôle de disponibilité en temps réel avant production (`checkAvailability`), avec table "Requis / Disponible / Statut" claire.
- Historique de production horodaté et coût de revient calculé automatiquement à chaque lancement.
- Garde-fou "Cette activité n'a aucun stock lié — la production est indisponible" tant qu'aucun `Stock` physique n'est rattaché à l'Activité — bon réflexe anti-erreur, résolu simplement en créant un Stock "Fournil" et en le liant.

### Ce qui manque / ce qui devrait changer
- **Aucun champ instructions/méthode sur la fiche BOM** — seulement des quantités et un temps de préparation en minutes. Rien pour noter "pétrir 10 min, pousser 1h à température ambiante, façonner, four 220°C 35 min". Une fiche BOM aujourd'hui n'est pas une fiche technique complète, seulement une nomenclature.
- **Piège UX sur le champ Densité** (ingrédients Poudre/Liquide) : un placeholder gris (ex. "0.79") ressemble à une vraie valeur déjà saisie, mais n'est pas soumis au formulaire — la création échoue avec "Densité obligatoire" tant qu'on n'a pas retapé la valeur explicitement.
- **Pas de validation sur le prix/conditionnement dans Achats trop grossier** pour les ingrédients bon marché : `0,002€` est rejeté ("les deux valeurs valides les plus proches sont 0 et 0,01"), ce qui empêche de saisir un prix réaliste pour l'eau ou d'autres ingrédients à très faible coût unitaire.
- **Affichage du coût de revient arrondi à 0,00€** pour les petites unités (ex. 0,0006€/g de pâte) — génère des multiplicateurs de marge absurdes à l'affichage (ex. "x3263,71") lors de la publication d'un produit, alors que le calcul sous-jacent est correct.

---

## 2. Étudiants — accès aux fiches techniques quotidiennes (pâtes la veille, pains le matin)

**Parcours testé :** inspection du système de rôles (Équipe → Rôles), du rôle "Artisan" existant (11 permissions), et des pages "Recettes"/"Planning" du menu.

### Ce qui fonctionne
- Le système RBAC (Équipe → Rôles) permet de créer des rôles avec des permissions granulaires par domaine fonctionnel (BOM, ingrédients, achats, stocks, POS…) — l'infrastructure de permissions existe et est fine.

### Ce qui manque
- **"Recettes" et "Planning" sont des coquilles vides** ("Le module Recettes est en cours de construction" / "Le planning de production sera disponible dans une prochaine version") — aucune vue dédiée à la consultation quotidienne des fiches n'existe.
- **Le seul endroit où les quantités/lignes d'une fiche sont visibles est l'éditeur BOM lui-même** (`/bom/[contextId]`) — un formulaire d'édition complet (ajout/suppression de lignes, modification de l'en-tête), pas une fiche de lecture simple et imprimable pour un poste de préparation.
- **Aucun rôle "lecture seule" n'existe.** Le rôle le plus proche du besoin ("Artisan") combine dans un seul bloc : voir ET créer/modifier les ingrédients, voir ET créer/modifier les recettes/fiches BOM, voir ET créer/modifier/supprimer les achats, plus le droit de lancer une production. Impossible aujourd'hui de donner à un étudiant un accès en lecture aux fiches sans lui donner aussi le droit de modifier la nomenclature, les prix d'achat ou de déclencher une production.
- **Aucune notion de planning/échéance dans le modèle de données** : rien ne distingue "à préparer la veille" (pâtes à lever) de "à cuire le jour même" (pains) — cette distinction n'existe que dans la tête de l'utilisateur, pas dans l'outil.

### Ce qu'il faudrait changer
Un rôle "Lecture fiches" dédié (voir uniquement, aucune permission d'écriture), une vraie vue quotidienne filtrée par niveau BOM ou par échéance de préparation, dans un format lisible sur tablette/imprimable au poste de travail — ce qui correspond exactement à ce que "Planning" est censé devenir.

---

## 3. Vendeuses — vente comptoir depuis le stock de pain produit ❌

**Parcours testé :** création d'une vendeuse (Marie, PIN 1111) via Équipe → Vendeurs POS, authentification PIN, ouverture de caisse (fond 50€), publication d'un produit depuis une fiche BOM, tentative de vente réelle, vérification de l'historique de production.

### Constat — vérifié en direct, pas une supposition de code

Le module POS a été **volontairement redessiné le 2026-07-26** (`docs/modules/POS.md` §0, règle #35 du JOURNAL) autour d'un modèle **"vente à la demande"**, conçu à l'origine pour un persona **bar à cocktails** (chaque commande mixée à l'instant T, jamais de stock intermédiaire).

Reproduction en direct de la conséquence pour une boulangerie :

1. **Le picker "Publier un produit" (`GET /api/v1/bom/sheets?hasStock=true`) ne liste que les fiches productibles immédiatement depuis le stock d'ingrédients bruts** (`checkAvailability(sheetId, 1)`), jamais les fiches ayant déjà du stock produit. La fiche "Pain de campagne (750g)" — pourtant avec **6 pains réellement cuits et stockés** dans "Fournil" (production confirmée, historique horodaté, coût calculé) — **n'apparaît pas dans ce picker**, simplement parce qu'il ne reste plus assez de pâte en stock d'ingrédients pour en refabriquer un de plus à l'instant T.
2. En publiant puis vendant un produit ("Pâte à pain (test POS)") au comptoir via la session de Marie, la vente a **déclenché une vraie production automatique en temps réel** : une nouvelle entrée est apparue dans l'historique de production BOM ("Pâte à pain de campagne · 1 batch · 1kg"), consommant réellement farine/eau/levure/sel au moment exact de la vente — exactement le mécanisme documenté (`BomProduction` + `consumeFIFO`, règle #35 JOURNAL).
3. **Le stock déjà produit (les 6 pains cuits) n'a été touché à aucun moment par cette vente.**

**Conclusion : dans l'état actuel du logiciel, les 6 pains cuits le matin sont invendables au comptoir.** Il n'existe aucun chemin UI/API permettant de vendre du pain déjà fabriqué — seulement de redéclencher une fabrication à la volée à partir du stock d'ingrédients, ce qui n'a aucun sens opérationnel pour un produit qui nécessite une vraie cuisson (contrairement à un cocktail mixé en 30 secondes).

### Ce qu'il faudrait changer

C'est le constat le plus critique de cette session de test. Le modèle "vente à la demande" est pertinent pour un bar (préparation instantanée) mais **incompatible** avec une boulangerie/pâtisserie classique (production groupée le matin, vente au détail toute la journée depuis un stock physique fixe). Deux options :
- **(a)** Réintroduire un canal `DIRECT` pré-produit pour le POS — ce canal existait déjà dans le schéma avant la révision du 2026-07-26 (`ProductChannelStock`, canal `DIRECT`, jamais réellement supprimé de la base) ;
- **(b)** Rendre le mode configurable par produit ou par activité (à la demande pour un traiteur/bar, stock pré-produit pour une boulangerie/pâtisserie) — cohérent avec le principe déjà acté d'architecture modulaire activable/désactivable (`CLAUDE.md` du projet).

---

## 4. Boutique en ligne — commande J-1, stock réservé séparé ❌

**Parcours testé :** vérification du canal VITRINE (censé être resté sur l'ancien modèle pré-produit), navigation vers la page boutique publique (`/storefront/[tenantSlug]/catalog`), publication de la configuration CMS via l'API, nouvelle tentative.

### Ce qui fonctionne (d'après le code — non testable en pratique, voir bug ci-dessous)
- Le canal `VITRINE` (`ProductChannelStock`, décrémenté par le webhook Stripe) est resté sur l'ancien design lors de la révision POS du 2026-07-26 — architecturalement, c'est exactement le modèle "payé la veille, réservé, servi le lendemain" décrit par l'utilisateur.

### Bug bloquant confirmé
- La page boutique publique (`/storefront/[tenantSlug]/catalog`) renvoie **404 pour le tenant de test**, y compris **après avoir publié la configuration** (`isPublished: true` confirmé en base via l'API `/api/v1/cms/publish`).
- Cause isolée : `src/app/storefront/[tenantSlug]/layout.tsx` fait un `fetch` **côté serveur** vers `${NEXT_PUBLIC_APP_URL}/api/storefront/[tenantSlug]/config`, avec un **fallback `http://localhost:3000`** si la variable d'environnement est absente. Sur le déploiement Vercel de production, cette variable semble absente ou incorrecte : le fetch serveur échoue silencieusement (`try/catch` qui retourne `null`), et la page appelle systématiquement `notFound()` — **indépendamment du statut de publication réel**.
- Vérifié : l'API elle-même fonctionne parfaitement quand on l'appelle directement depuis le navigateur (`GET /api/storefront/boulangerie-test-claude/config` retourne les bonnes données, `isPublished: true` inclus) — le problème est uniquement dans l'appel serveur-à-serveur du composant Next.js.
- **Le module admin "Boutique web" (CMS Builder) est lui-même une coquille vide** ("en cours de construction") — même un patron qui connaîtrait ce bug n'a aucune UI pour vérifier ou publier l'état de sa boutique.

### Conséquence
**Aucun client ne peut aujourd'hui accéder à la boutique en ligne d'aucun tenant**, quel que soit l'état de sa configuration — ce qui rend inutilisable un module pourtant marqué "terminé, 12/12 étapes" dans `docs/modules/POS.md` §2 (panier, checkout, créneaux de retrait, webhook Stripe). Le flux réel commande J-1 → créneau de retrait J+1 → paiement → réservation de stock côté vendeuse n'a **pas pu être testé en pratique** à cause de ce blocage — seule la mécanique de code a pu être inspectée.

### Ce qu'il faudrait changer
1. **Priorité absolue** : corriger `NEXT_PUBLIC_APP_URL` dans les variables d'environnement du projet Vercel de production (correctif de configuration, pas de code).
2. Une fois débloqué, retester réellement en direct : panier → checkout → sélection créneau J+1 → paiement Stripe (mode test) → confirmation → vérification que le stock réservé apparaît bien séparé du stock comptoir POS pour la vendeuse.
3. Terminer le module "CMS Builder" (au moins un bouton "Publier ma boutique" minimal) pour que ce genre de blocage soit visible et actionnable par le patron sans devoir inspecter le code.

---

## Règles apprises (ajoutées au JOURNAL.md)

Voir JOURNAL.md, règles #46 à #49.

## Prochaine étape suggérée

1. Corriger `NEXT_PUBLIC_APP_URL` sur Vercel (bloquant, config uniquement) puis retester le parcours boutique en ligne complet.
2. Décision de cadrage à prendre avec l'utilisateur sur le modèle POS (canal `DIRECT` pré-produit vs vente à la demande) avant de coder quoi que ce soit — impacte le schéma et plusieurs routes déjà réécrites le 2026-07-26.
3. Brainstorm dédié pour le module "Planning"/fiches techniques quotidiennes (étape 2 de la cascade de brainstorms du projet) avant implémentation, pas de code direct depuis ce constat.
