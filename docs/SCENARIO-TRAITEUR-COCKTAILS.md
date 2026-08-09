# Scénario de test réel — Traiteur événementiel (service cocktails)

> **Date :** 2026-08-09
> **Méthode :** test en direct sur `https://artisastock-v2.vercel.app` (pas de revue de code statique seule — recherche code ciblée en amont via agent, puis vérification live de chaque constat), tenant dédié `Traiteur Cocktails Test Claude`, créé et rempli dans le navigateur.
> **Objectif :** valider si l'app peut couvrir le cas d'usage d'un traiteur événementiel spécialisé cocktails — devis personnalisé par événement (date, nombre d'invités, prestation horaire, cocktails à servir, location de verres) et facturation précise incluant la rémunération du personnel (formule 2 barmans minimum + 1 par 200 personnes), sur base des recettes/ingrédients/packs de cocktails.
> **Suite de :** `docs/SCENARIO-BOULANGERIE.md` (premier scénario réel, persona boulangerie) — même méthodologie, persona différent.

---

## Résumé exécutif

| Volet testé | Statut | Nature du problème |
|---|---|---|
| Fiches BOM appliquées aux cocktails (recettes, ingrédients, coûts) | ✅ Fonctionne sans adaptation | — |
| Devis personnalisé par événement | ❌ Inexistant | Fonctionnalité jamais construite (stub pur) |
| Facturation avec lignes libres (personnel, location) | ❌ Inexistant | Module entier non construit (stub), et le peu qui existe en code est verrouillé sur le modèle boutique en ligne |
| Dotation en personnel calculée (formule par nombre d'invités) | ❌ Inexistant | Aucun modèle de données (pas de champ taux horaire, pas d'entité événement) |
| Location de matériel (verres) | ❌ Inexistant | Le modèle de stock suppose une consommation définitive, incompatible avec un cycle prêt/retour |

Contrairement au scénario boulangerie (où le problème dominant était un **décalage de modèle** — le POS existant ne correspondait pas au bon usage — et un **bug de configuration** bloquant la boutique), ici le constat est un **vide fonctionnel** : les deux capacités demandées par l'utilisateur (devis événementiel, facture détaillée avec personnel et location) n'existent tout simplement pas encore dans le produit, sur aucun des deux fronts.

---

## Ce qui fonctionne : le moteur de recettes (BOM) s'applique aux cocktails sans adaptation

**Testé en direct :** création de 7 ingrédients spiritueux/mixers (Gin, Vermouth Rouge, Campari, Tonic, Vodka, Ginger Beer, Jus de citron vert), achats réels (bouteilles 70cl/100cl, canettes 20cl → `Lot` créés avec prix au cl), fiche BOM "Negroni" (Gin 3cl + Vermouth Rouge 3cl + Campari 3cl, sortie 1 pièce) créée et confirmée avec ses 3 lignes.

- L'unité `cl` (centilitre) existe nativement dans `UnitOfMeasure`, la catégorie `Liquide` et le type physique `Liquide` conviennent aux spiritueux sans détour.
- Le modèle d'achat par conditionnement (bouteille 70cl = 1 conditionnement, prix calculé automatiquement au cl) correspond exactement à la réalité d'un bar/traiteur — aucune différence avec un ingrédient de boulangerie acheté au sac.
- La reprise automatique d'unité sur les lignes de nomenclature (règle #25 du JOURNAL) fonctionne identiquement.
- C'est cohérent avec l'histoire du produit : le modèle POS "vente à la demande" a été conçu à l'origine pour un persona **bar à cocktails** (`docs/modules/POS.md` §0) — pour la partie recette et vente comptoir de ce scénario spécifique, l'architecture existante est un bien meilleur fit que pour la boulangerie testée précédemment (règle #47 du JOURNAL).

**Conclusion :** aucun changement de modèle de données n'est nécessaire pour modéliser des recettes de cocktails — le blocage n'est pas ici.

---

## Ce qui manque — vide fonctionnel complet sur devis et facturation

### 1. Devis personnalisé par événement : inexistant

- "Devis pâtisserie" (le seul module de devis présent dans le nav) est un stub pur : *"La création de devis pâtisserie sera disponible dans une prochaine version."* — confirmé en direct, aucune logique, aucune route API dédiée (`grep` sur `devis|quote|estimate` dans `src/app/api` : zéro résultat).
- Même son nom trahit une portée pensée bien plus étroite que ce qu'il faudrait pour ce persona : `docs/SCENARIO-WORKFLOW-COMPLET.md` décrit l'intention comme "configurer un gâteau (forme, taille, couches)" — un configurateur produit unique, pas un devis généraliste multi-lignes avec date d'événement, nombre d'invités, horaires de prestation, liste de cocktails et articles de location.
- Aucune notion **d'événement** (date, nombre d'invités, horaire de début/fin) n'existe nulle part dans le schéma de données.

### 2. Facturation : le module entier est un stub, pas seulement "sans lignes libres"

- La page "Factures" elle-même affiche *"Émettez et suivez vos factures clients en toute simplicité. Le module Facturation est en cours de construction."* — confirmé en direct. Ce n'est pas juste une limitation de la génération existante : il n'y a **aucune** UI de facturation accessible aujourd'hui.
- Ce qui existe côté code (non atteignable depuis cette UI) est strictement lié au flux boutique en ligne : `Invoice.orderId` est `@unique` (une facture = une commande), et la seule route de création (`POST` implicite via `invoices/generate/[orderId]`) construit ses lignes en mappant `order.items` → un produit du catalogue à la fois. Il n'existe pas de route pour créer une facture manuelle/autonome avec des lignes arbitraires — même si `Invoice.lines` est stocké en `Json` (structurellement, il pourrait contenir n'importe quoi, mais aucun code n'écrit autre chose que des lignes produit issues d'une commande).
- Conséquence directe : impossible de facturer "prestation cocktail 450 personnes, 19h-1h" comme ligne de service, ni "location de verres — 450 unités", ni la main d'œuvre — même manuellement.

### 3. Dotation en personnel (formule 2 barmans + 1/200 invités) : aucun modèle

- `Vendeur` (l'entité qui authentifie le personnel comptoir via PIN) n'a **aucun champ de taux horaire ou de coût** — seulement identité, PIN et statut actif/inactif.
- `PointageHoraire` enregistre uniquement `clockIn`/`clockOut` (horodatage brut) — aucune multiplication par un taux horaire nulle part dans le code.
- Aucune entité "événement" avec un nombre d'invités n'existe pour servir de base à une formule de dotation (2 minimum + 1 par tranche de 200) — cette règle métier n'a littéralement aucun endroit où vivre dans le modèle actuel.

### 4. Location de matériel (verres) : incompatible avec le modèle de stock actuel

- Le modèle `Ingredient`/`Lot`/FIFO suppose systématiquement une **consommation définitive** (un ingrédient acheté est consommé en production, jamais "rendu"). Aucun concept de prêt/retour, de caution, ou de suivi de casse n'existe.
- Modéliser "450 verres loués au client" comme un ingrédient consommé donnerait un signal faux (le stock semblerait épuisé alors que le matériel doit revenir après l'événement) — ce n'est pas un simple contournement à trouver, c'est un type de mouvement de stock qui n'existe pas dans l'architecture.

---

## Verdict

Le moteur de coût par recette (BOM/fiches, achats, unités) est solide et se transpose tel quel du pain aux cocktails — c'est une bonne nouvelle et ça valide la généralité de l'architecture choisie. Mais les deux capacités au cœur de la demande de l'utilisateur — **devis personnalisé par événement** et **facture précise incluant personnel et location** — n'existent pas aujourd'hui, à aucun niveau (ni UI, ni API, ni modèle de données). Ce n'est pas un bug à corriger : c'est un module à concevoir et construire entièrement, en suivant la méthodologie de cascade de brainstorms déjà actée pour ce projet (macro → brainstorm dédié au module Devis/Facturation événementielle → implémentation testée au navigateur), avant d'écrire le moindre code.

---

## Règles apprises (ajoutées au JOURNAL.md)

Voir JOURNAL.md, règles #50 à #53.

## Prochaine étape suggérée

1. Brainstorm dédié (étape 2 de la cascade) pour un module "Devis & Facturation événementielle" — use cases et workflow utilisateur complet, avant tout code : ce module doit couvrir devis multi-lignes (recettes/packs + services + location), conversion devis → facture, et une formule de dotation personnel paramétrable par activité (pas seulement 2+1/200, ce chiffre doit être configurable).
2. Décision de cadrage à prendre avec l'utilisateur : le modèle `Ingredient` doit-il gagner un type "location" (avec retour de stock), ou est-ce un domaine séparé (ex. `RentalItem`) ? Impacte le schéma.
3. Réutiliser tel quel le moteur BOM existant pour les recettes/packs de cocktails — aucun changement nécessaire de ce côté, confirmé par ce test.
