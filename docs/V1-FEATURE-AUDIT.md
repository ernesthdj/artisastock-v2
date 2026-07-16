# V1-FEATURE-AUDIT — ArtisaStock v1 → v2

> **Objet :** Document de référence exhaustif pour la migration ArtisaStock v1 (C# WinForms + Laravel MySQL) vers ArtisaStock v2 (Next.js 15 App Router, React, PostgreSQL/Prisma, SaaS multi-tenant).
> **Généré le :** 2026-07-16 — Pipeline 3 agents (Données & SQL · Logique Métier · Features & Workflows)
> **Usage :** Ce document est la SOURCE DE VÉRITÉ pour les agents de v2. Toute fonctionnalité, règle métier ou contrainte doit être référencée ici avant implémentation.

---

## SOMMAIRE

1. [Vue d'ensemble](#1-vue-densemble)
2. [Schéma de données](#2-schéma-de-données)
3. [Logique métier & règles](#3-logique-métier--règles)
4. [Modules & Fonctionnalités](#4-modules--fonctionnalités)
5. [Workflows clés](#5-workflows-clés)
6. [Rôles & Permissions](#6-rôles--permissions)
7. [Mapping v1 → v2](#7-mapping-v1--v2)

---

## 1. VUE D'ENSEMBLE

### Architecture v1
- **ERP C# WinForms** : application desktop Single-Form Architecture (SFA) — gestion ingrédients, achats, BOM (Bill of Materials — Nomenclature de fabrication), stock, production
- **Boutique Laravel** : site e-commerce B2C (catalogue, panier, checkout Stripe, suivi commande)
- **Base MySQL partagée** : 20 tables + 1 vue + 22 migrations (v04 → v22)

### Domaine métier
Pâtisserie artisanale belge. Concepts clés :
- **Ingrédient** : matière première achetée (chocolat, crème, beurre…)
- **Lot** : achat physique d'un ingrédient (traçabilité AFSCA, FIFO)
- **BOM (Bill of Materials)** : nomenclature de fabrication — recette hiérarchique
- **Activité** : branche métier (ex : "Chocolaterie", "Boulangerie")
- **Contexte** : domaine de production dans une activité (ex : "Pralines Noël")
- **Niveau** : étape de fabrication ordonnée (N0=ingrédients, N1=ganaches, N2=assemblage…)
- **Fiche** : recette à un niveau donné (inputs + quantité output)
- **Production** : exécution d'une fiche (consommation FIFO + création stock)
- **Stock** : quantité disponible (lots ingrédients + produits fabriqués)

### Chiffres clés v1
- 48 fichiers .cs WinForms
- 20 tables + 1 vue SQL
- 22 migrations DB
- 15 DAL (Data Access Layer)
- 80+ routes API Laravel implicites (controllers)
- ~33 fonctionnalités majeures + 30+ règles métier

---

## 2. SCHÉMA DE DONNÉES

### 2.1 Inventaire des tables

#### Référentiels

**`activites`** — Branches métier de la pâtisserie

| Colonne | Type | Nullable | Défaut | Note |
|---------|------|----------|--------|------|
| `id` | INT AUTO_INCREMENT | ✗ | | PK |
| `nom` | VARCHAR(100) | ✗ | | UNIQUE |
| `description` | TEXT | ✓ | NULL | |
| `actif` | TINYINT(1) | ✗ | 1 | Soft delete |
| `date_creation` | DATETIME | ✗ | CURRENT_TIMESTAMP | |

**`stocks`** — Emplacements physiques de rangement (ex : "Frigo 1", "Chambre froide")

| Colonne | Type | Nullable | Défaut | Note |
|---------|------|----------|--------|------|
| `id` | INT AUTO_INCREMENT | ✗ | | PK |
| `nom` | VARCHAR(200) | ✗ | | UNIQUE |
| `description` | TEXT | ✓ | NULL | |
| `actif` | TINYINT(1) | ✗ | 1 | |
| `date_creation` | DATETIME | ✗ | CURRENT_TIMESTAMP | |

**`activites_stocks`** — Jonction M:N activité ↔ stock physique

| Colonne | Type | FK |
|---------|------|----|
| `id_activite` | INT | → activites(id) CASCADE |
| `id_stock` | INT | → stocks(id) CASCADE |

PK composite (`id_activite`, `id_stock`)

---

#### Ingrédients & Lots

**`fournisseurs`** — Base de fournisseurs

| Colonne | Type | Nullable |
|---------|------|----------|
| `id` | INT AUTO_INCREMENT | ✗ |
| `nom` | VARCHAR(200) | ✗ UNIQUE |
| `contact` | VARCHAR(200) | ✓ |
| `email` | VARCHAR(255) | ✓ |
| `telephone` | VARCHAR(20) | ✓ |
| `adresse` | VARCHAR(255) | ✓ |
| `notes` | TEXT | ✓ |

**`fiches_ingredients`** — Catalogue master des ingrédients

| Colonne | Type | Nullable | Défaut | Note |
|---------|------|----------|--------|------|
| `id` | INT AUTO_INCREMENT | ✗ | | PK |
| `nom` | VARCHAR(200) | ✗ | | UNIQUE |
| `marque` | VARCHAR(200) | ✓ | NULL | |
| `description` | TEXT | ✓ | NULL | |
| `unite_mesure` | ENUM('mg','g','kg','ml','cl','dl','l','piece') | ✗ | | Unité de stockage |
| `type_physique` | ENUM('solide','liquide','poudre','piece') | ✗ | 'solide' | |
| `densite` | DECIMAL(8,4) | ✓ | NULL | g/ml, obligatoire si liquide/poudre |
| `conditionnement_label` | VARCHAR(100) | ✗ | '' | Ex: "Sac 2.5kg" |
| `qte_par_conditionnement` | DECIMAL(12,4) | ✗ | 1 | Quantité physique par emballage |
| `nb_par_lot` | INT | ✗ | 1 | Conditionnements par lot d'achat [v19] |
| `prix_achat_reference` | DECIMAL(10,4) | ✗ | 0 | Prix unitaire de référence HTVA |
| `dlc_jours_reference` | INT | ✓ | NULL | Durée de vie depuis achat |
| `qualite_label` | VARCHAR(100) | ✓ | NULL | "IGP", "AOP", "Bio"… |
| `id_fournisseur_defaut` | INT | ✓ | NULL | → fournisseurs SET NULL |
| `seuil_alerte_stock` | DECIMAL(10,4) | ✓ | NULL | Alerte si stock < seuil |
| `stock_cible` | DECIMAL(10,4) | ✓ | NULL | Quantité idéale (100% de jauge) |
| `id_stock_defaut` | INT | ✓ | NULL | → stocks SET NULL [v22] |
| `actif` | TINYINT(1) | ✗ | 1 | |
| `date_creation` | DATETIME | ✓ | CURRENT_TIMESTAMP | |

**`lots_ingredients`** — Achats physiques réels (source FIFO)

| Colonne | Type | Nullable | Défaut | Note |
|---------|------|----------|--------|------|
| `id` | INT AUTO_INCREMENT | ✗ | | PK |
| `id_fiche_ingredient` | INT | ✗ | | → fiches_ingredients CASCADE |
| `id_stock` | INT | ✗ | | → stocks RESTRICT |
| `numero_lot` | VARCHAR(100) | ✓ | NULL | Traçabilité AFSCA |
| `id_fournisseur` | INT | ✓ | NULL | → fournisseurs SET NULL |
| `nb_conditionnements` | DECIMAL(10,3) | ✗ | 1 | Nombre d'emballages achetés |
| `date_achat` | DATE | ✗ | | |
| `date_peremption` | DATE | ✓ | NULL | |
| `quantite_initiale` | DECIMAL(10,4) | ✗ | | nb_cond × qte_par_cond |
| `quantite_disponible` | DECIMAL(10,4) | ✗ | | Diminue avec consommation FIFO |
| `prix_unitaire` | DECIMAL(10,4) | ✗ | 0 | Prix/conditionnement HTVA |
| `prix_achat_reel` | DECIMAL(10,4) | ✗ | 0 | Total HTVA |
| `reference_facture` | VARCHAR(100) | ✓ | NULL | |
| `tva_pct` | DECIMAL(5,2) | ✗ | 0 | [v06] |
| `notes` | TEXT | ✓ | NULL | |
| `date_creation` | DATETIME | ✓ | CURRENT_TIMESTAMP | |

CHECK : `quantite_disponible >= 0`
INDEX : `(id_fiche_ingredient, date_achat)` [v20 — FIFO]

---

#### Utilisateurs

**`utilisateurs`** — Comptes admin WinForms

| Colonne | Type | Note |
|---------|------|------|
| `id` | INT AUTO_INCREMENT | |
| `nom`, `prenom` | VARCHAR(100) | |
| `email` | VARCHAR(255) UNIQUE | |
| `mot_de_passe` | VARCHAR(255) | BCrypt |
| `role` | ENUM('client','admin') | |
| `telephone`, `adresse`, `code_postal`, `ville` | VARCHAR | ✓ |
| `actif` | TINYINT(1) | Soft delete |

---

#### BOM — Nomenclature de fabrication

**`bom_contextes`** — Domaines de production (ex : "Pralines", "Ganaches")

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `nom` | VARCHAR(200) | ✗ | UNIQUE par activité |
| `description` | TEXT | ✓ | |
| `id_activite` | INT | ✗ | → activites RESTRICT |
| `actif` | TINYINT(1) | ✗ | |
| `date_creation` | DATETIME | ✓ | |

UNIQUE : `(nom, id_activite)`

**`bom_niveaux`** — Étapes de production ordonnées (N0, N1, N2…)

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_contexte` | INT | ✗ | → bom_contextes CASCADE |
| `ordre` | TINYINT UNSIGNED | ✗ | 0=stock ingrédients, 1+= niveaux fabrication |
| `nom` | VARCHAR(200) | ✗ | |
| `description` | TEXT | ✓ | |
| `date_creation` | DATETIME | ✓ | |

UNIQUE : `(id_contexte, ordre)` — 1 position par contexte

**`bom_fiches`** — Recettes détaillées (définit inputs, output, rendement)

| Colonne | Type | Nullable | Défaut | Note |
|---------|------|----------|--------|------|
| `id` | INT AUTO_INCREMENT | ✗ | | |
| `id_niveau` | INT | ✗ | | → bom_niveaux RESTRICT |
| `nom` | VARCHAR(200) | ✗ | | UNIQUE par niveau |
| `description` | TEXT | ✓ | | |
| `unite_output` | ENUM('mg','g','kg','ml','cl','dl','l','piece') | ✗ | 'piece' | |
| `quantite_output` | DECIMAL(10,4) | ✗ | 1 | Qté produite par batch (> 0) |
| `temps_preparation` | INT | ✓ | NULL | Minutes |
| `stock_cible` | DECIMAL(10,4) | ✓ | NULL | [v14] |
| `actif` | TINYINT(1) | ✗ | 1 | |
| `date_creation` | DATETIME | ✓ | | |

CHECK : `quantite_output > 0`
UNIQUE : `(nom, id_niveau)`

**`bom_fiches_lignes`** — Composition d'une recette (ingrédient XOR sous-fiche)

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_fiche` | INT | ✗ | → bom_fiches CASCADE |
| `type_input` | ENUM('ingredient','fiche') | ✗ | Discriminant |
| `id_input_ingredient` | INT | ✓ | → fiches_ingredients CASCADE (si type=ingredient) |
| `id_input_fiche` | INT | ✓ | → bom_fiches CASCADE (si type=fiche) |
| `quantite` | DECIMAL(12,4) | ✗ | |
| `unite_mesure` | ENUM('mg','g','kg','ml','cl','dl','l','piece') | ✗ | |

CHECK : exclusivité mutuelle `(type='ingredient' AND id_input_ingredient IS NOT NULL AND id_input_fiche IS NULL) OR (type='fiche' AND id_input_fiche IS NOT NULL AND id_input_ingredient IS NULL)`

---

#### Production & Stock BOM

**`bom_productions`** — Actes de fabrication (historique)

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_niveau` | INT | ✗ | → bom_niveaux RESTRICT |
| `id_fiche` | INT | ✗ | → bom_fiches RESTRICT |
| `quantite_produite` | DECIMAL(10,4) | ✗ | > 0 |
| `cout_ingredients` | DECIMAL(10,2) | ✗ | 0 initial, mis à jour après FIFO |
| `cout_unitaire` | DECIMAL(10,4) | ✗ | cout_ingredients / quantite_produite |
| `date_production` | DATETIME | ✓ | CURRENT_TIMESTAMP |
| `notes` | TEXT | ✓ | |

**`bom_stocks`** — Stock physique de produits fabriqués

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_niveau` | INT | ✗ | → bom_niveaux RESTRICT |
| `id_contexte` | INT | ✗ | Dénormalisé pour filtres rapides |
| `id_activite` | INT | ✗ | Dénormalisé pour filtres rapides |
| `id_fiche` | INT | ✗ | → bom_fiches RESTRICT |
| `id_production` | INT | ✗ | → bom_productions RESTRICT (traçabilité) |
| `quantite_disponible` | DECIMAL(12,4) | ✗ | >= 0, décroît par FIFO |
| `cout_unitaire` | DECIMAL(10,4) | ✗ | Gelé au moment de la production |
| `date_production` | DATE | ✗ | |
| `date_dlc` | DATE | ✓ | NULL si produit stable |
| `date_creation` | DATETIME | ✓ | |

INDEX : `(id_fiche, quantite_disponible, date_production)` [v20]

**`bom_productions_lignes`** — Traçabilité FIFO : détail de chaque consommation

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_production` | INT | ✗ | → bom_productions CASCADE |
| `type_source` | ENUM('lot_ingredient','bom_stock') | ✗ | Discriminant |
| `id_lot_ingredient` | INT | ✓ | → lots_ingredients RESTRICT |
| `id_bom_stock` | INT | ✓ | → bom_stocks RESTRICT |
| `quantite_consommee` | DECIMAL(12,4) | ✗ | |
| `cout_unitaire_moment` | DECIMAL(10,4) | ✗ | Prix gelé au moment de la conso |

CHECK : exclusivité mutuelle source (même pattern que bom_fiches_lignes)

**`bom_reservations`** — Réservations prévisionnelles de lots

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_lot` | INT | ✗ | → lots_ingredients CASCADE |
| `id_contexte` | INT | ✗ | → bom_contextes CASCADE |
| `quantite_reservee` | DECIMAL(12,4) | ✗ | > 0 |
| `date_reservation` | DATETIME | ✓ | |
| `notes` | TEXT | ✓ | |
| `actif` | TINYINT(1) | ✗ | 1 = réservation active |

INDEX : `(id_lot, actif)`, `(id_contexte, actif)` [v20]

---

#### Boutique Web (e-commerce)

**`categories_web`** — Catégories produits boutique

| Colonne | Type | Note |
|---------|------|------|
| `id` | INT AUTO_INCREMENT | |
| `nom` | VARCHAR(150) UNIQUE | |
| `description` | TEXT ✓ | |
| `ordre_affichage` | INT | Tri menu |
| `actif` | TINYINT(1) | |

**`clients`** — Comptes clients web (séparé des utilisateurs WinForms)

| Colonne | Type | Note |
|---------|------|------|
| `id` | INT AUTO_INCREMENT | |
| `nom`, `prenom` | VARCHAR(100) | |
| `email` | VARCHAR(255) UNIQUE | |
| `mot_de_passe` | VARCHAR(255) | BCrypt (interop C#) |
| `telephone` | VARCHAR(20) ✓ | |
| `adresse_rue`, `adresse_cp`, `adresse_ville` | VARCHAR ✓ | |
| `adresse_pays` | VARCHAR(100) | 'Belgique' |
| `actif` | TINYINT(1) | |

**`produits_web`** — Produits commercialisés (1:1 bom_fiches)

| Colonne | Type | Note |
|---------|------|------|
| `id` | INT AUTO_INCREMENT | |
| `id_bom_fiche` | INT UNIQUE | → bom_fiches RESTRICT (1:1) |
| `id_categorie` | INT ✓ | → categories_web SET NULL |
| `nom_commercial` | VARCHAR(200) | Nom marketing |
| `description` | TEXT ✓ | Description boutique |
| `prix_vente` | DECIMAL(10,2) | Prix TTC |
| `image_path` | VARCHAR(500) ✓ | Chemin Cloudinary |
| `en_vente` | TINYINT(1) | Toggle catalogue |
| `ordre_affichage` | INT | |

INDEX : `(en_vente, ordre_affichage)`, `(id_categorie)` [v15]

**`commandes_web`** — Commandes clients (panier → payée)

| Colonne | Type | Note |
|---------|------|------|
| `id` | INT AUTO_INCREMENT | |
| `id_client` | INT | → clients RESTRICT |
| `statut` | ENUM('panier','payee','annulee') | |
| `total_ttc` | DECIMAL(10,2) | |
| `adresse_livraison` | TEXT ✓ | Snapshot à la commande |
| `date_commande` | DATETIME ✓ | NULL tant que panier |

INDEX : `(id_client, statut)`, `(statut)` [v15]

**`commandes_web_lignes`** — Articles d'une commande (snapshot prix)

| Colonne | Type | Note |
|---------|------|------|
| `id` | INT AUTO_INCREMENT | |
| `id_commande` | INT | → commandes_web CASCADE |
| `id_produit_web` | INT | → produits_web RESTRICT |
| `quantite` | INT | >= 1 |
| `prix_unitaire` | DECIMAL(10,2) | Snapshot prix au moment du panier |
| `sous_total` | DECIMAL(10,2) | GENERATED AS (quantite × prix_unitaire) STORED |

---

### 2.2 Vue unifiée : `vue_stock_global`

UNION ALL de tous les stocks (lots ingrédients + produits fabriqués).

**Colonnes de sortie :**

| Colonne | Source | Note |
|---------|--------|------|
| `type_stock` | Discriminant | 'lot_ingredient' ou 'produit_fabrique' |
| `id_entree` | ID lots / bom_stocks | |
| `nom` | Fiche ingrédient / BOM | |
| `unite` | ENUM | |
| `quantite_totale` | quantite_disponible | |
| `quantite_reservee` | SUM(bom_reservations) | Lots seulement |
| `quantite_dispo_reelle` | totale - réservée | Stock consommable réel |
| `cout_unitaire` | Calculé | €/unité |
| `prix_conditionnement` | lots_ingredients | Lots seulement |
| `qte_par_conditionnement` | fiches_ingredients | Lots seulement |
| `conditionnement_label` | fiches_ingredients | "Sac 2.5kg"… |
| `date_dlc` | date_peremption / date_dlc | |
| `id_stock` / `stock_nom` | stocks | Lots seulement |
| `id_activite`, `id_contexte`, `id_niveau` | bom_stocks | Produits seulement |
| `id_fiche_bom` / `id_fiche_ingredient` | Selon type | |

**Quantité disponible réelle = `quantite_disponible - SUM(bom_reservations.quantite_reservee WHERE actif=1)`**

---

### 2.3 Diagramme de relations

```
activites ────────┬──→ bom_contextes (N) [RESTRICT]
                  └──→ bom_stocks (N) [dénorm]

stocks ────────┬──→ lots_ingredients (N) [RESTRICT]
               └──→ activites_stocks (N) [CASCADE]

fournisseurs ──┬──→ fiches_ingredients.id_fournisseur_defaut [SET NULL]
               └──→ lots_ingredients.id_fournisseur [SET NULL]

fiches_ingredients ──┬──→ lots_ingredients (N) [CASCADE]
                     └──→ bom_fiches_lignes.id_input_ingredient [CASCADE]

lots_ingredients ──┬──→ bom_productions_lignes (N) [RESTRICT]
                   └──→ bom_reservations (N) [CASCADE]

bom_contextes ────→ bom_niveaux (N) [CASCADE]

bom_niveaux ──┬──→ bom_fiches (N) [RESTRICT]
              ├──→ bom_productions (N) [RESTRICT]
              └──→ bom_stocks (N) [RESTRICT]

bom_fiches ──┬──→ bom_fiches_lignes (N) [CASCADE]
             ├──→ bom_productions (N) [RESTRICT]
             ├──→ bom_stocks (N) [RESTRICT]
             └──→ bom_fiches_lignes.id_input_fiche [CASCADE] (auto-référence)

bom_productions ──┬──→ bom_stocks (N) [RESTRICT]
                  └──→ bom_productions_lignes (N) [CASCADE]

bom_fiches ────→ produits_web (1:1) [RESTRICT UNIQUE]

categories_web ────→ produits_web (N) [SET NULL]

clients ────→ commandes_web (N) [RESTRICT]
commandes_web ────→ commandes_web_lignes (N) [CASCADE]
produits_web ────→ commandes_web_lignes (N) [RESTRICT]
```

---

### 2.4 Timeline des migrations

| Version | Feature | Modification clé |
|---------|---------|-----------------|
| v04 | BOM multi-niveaux | CREATE : bom_contextes, niveaux, fiches, lignes, productions, stocks, productions_lignes, reservations |
| v05 | Fiches ↔ niveaux | ADD id_niveau + UNIQUE(nom, id_niveau) sur bom_fiches |
| v06 | TVA lots | ADD tva_pct sur lots_ingredients |
| v07 | Activités dynamiques | CREATE activites, remplacement ENUM par FK |
| v08 | Conditionnement | ADD conditionnement_label, qte_par_conditionnement, nb_par_lot, qualite_label |
| v09 | CASCADE correctif | Révision FK RESTRICT/CASCADE |
| v10 | Stocks découplés | CREATE stocks, activites_stocks |
| v11 | Vue stock global | CREATE vue_stock_global (UNION ALL) |
| v13 | Contrainte stock positif | CHECK quantite_disponible >= 0 |
| v14 | Stock cible | ADD stock_cible sur fiches_ingredients + bom_fiches |
| v15 | Boutique web | CREATE 5 tables e-commerce |
| v17-18 | Vue + stock lot | Corrections jointures vue + optimisations |
| v19 | nb_par_lot | Normalisation |
| v20 | Index performance | idx_lot_fiche_achat, idx_bomres_*, idx_bomstock_* |
| v21 | Contraintes | CHECK + UNIQUE renforcés |
| v22 | Stock défaut ingrédient | ADD id_stock_defaut sur fiches_ingredients |

---

## 3. LOGIQUE MÉTIER & RÈGLES

### 3.1 Conversions d'unités

#### Système d'unités

| Groupe | Unités | Unité de base | Facteurs (vers base) |
|--------|--------|---------------|---------------------|
| **Masse** | mg, cg, g, kg | g | 0.001, 0.01, 1, 1000 |
| **Volume** | ml, cl, dl, l | ml | 1, 10, 100, 1000 |
| **Pièce** | piece | piece | 1 (non convertible entre groupes) |

#### Formule de conversion (atomique)

```
valeur_convertie = (valeur_source × facteur_source) / facteur_cible
```

Exemple : 500 g → kg = (500 × 1) / 1000 = 0.5 kg

#### Règles strictes
- Conversion uniquement **dans le même groupe** (masse ↔ masse, volume ↔ volume)
- Tentative inter-groupes → exception levée
- `piece` ne se convertit qu'en `piece`
- Après sélection d'un input dans une ligne BOM, seules les unités compatibles sont proposées

#### TypeScript ready

```typescript
const unitFactors: Record<string, number> = {
  'mg': 0.001, 'cg': 0.01, 'g': 1, 'kg': 1000,   // vers g
  'ml': 1, 'cl': 10, 'dl': 100, 'l': 1000,         // vers ml
  'piece': 1
};

const unitGroups: Record<string, string[]> = {
  'mass': ['mg', 'cg', 'g', 'kg'],
  'volume': ['ml', 'cl', 'dl', 'l'],
  'piece': ['piece']
};

function findGroup(unit: string): string | null {
  return Object.entries(unitGroups).find(([, units]) => units.includes(unit))?.[0] ?? null;
}

function convert(value: number, from: string, to: string): number {
  if (findGroup(from) !== findGroup(to)) throw new Error(`Unités incompatibles : ${from} → ${to}`);
  return (value * unitFactors[from]) / unitFactors[to];
}

function compatibleUnits(unit: string): string[] {
  const group = findGroup(unit);
  return group ? unitGroups[group] : [];
}

function formatQty(value: number, unit: string): string {
  if (unit === 'g' && value >= 1000) return `${(value/1000).toFixed(3)} kg`;
  if (unit === 'ml' && value >= 1000) return `${(value/1000).toFixed(3)} l`;
  return `${value} ${unit}`;
}
```

---

### 3.2 Calcul de coût BOM (récursif)

#### Principe — Règle de 3 inter-niveaux

Si une fiche de niveau N produit Q_out unités et coûte C total :
```
coût par unité     = C / Q_out
coût pour X unités = X × (C / Q_out)
```

Pour un input de type "fiche" consommé en quantité X :
```
n_batches_source = X / Q_out_source     ← règle de 3
coût_input       = n_batches_source × C_source  ← appel récursif
```

#### Prix moyen pondéré d'un ingrédient

```sql
COALESCE(
  /* 1. Moyenne pondérée lots disponibles */
  SUM(lot.quantite_disponible × lot.prix_unitaire / fi.qte_par_conditionnement)
  / NULLIF(SUM(lot.quantite_disponible), 0),

  /* 2. Fallback : prix référence catalogue */
  fi.prix_achat_reference / NULLIF(fi.qte_par_conditionnement, 0),

  /* 3. Fallback final */
  0
)
WHERE lot.quantite_disponible > 0
```

#### Algorithme complet (TypeScript ready)

```typescript
interface BomFiche {
  id: number;
  quantiteOutput: number;
  uniteOutput: string;
  lignes: BomFicheLigne[];
}

interface BomFicheLigne {
  typeInput: 'ingredient' | 'fiche';
  idInputIngredient?: number;
  idInputFiche?: number;
  quantite: number;
  uniteMesure: string;
  uniteNative: string; // unité de stockage de l'ingrédient/fiche source
}

function calculateBomCost(
  ficheId: number,
  nBatches: number,
  visited = new Set<number>()
): { coutTotal: number; coutUnitaire: number } {
  if (visited.has(ficheId)) throw new Error(`Cycle BOM détecté : fiche #${ficheId}`);
  visited.add(ficheId);

  const fiche = getFiche(ficheId); // charge depuis DB
  let totalCost = 0;

  for (const ligne of fiche.lignes) {
    const qteNecessaire = ligne.quantite * nBatches;
    const qteBase = convert(qteNecessaire, ligne.uniteMesure, ligne.uniteNative);

    if (ligne.typeInput === 'ingredient') {
      const prixMoyen = getAvgIngredientPrice(ligne.idInputIngredient!);
      totalCost += qteBase * prixMoyen;
    } else {
      const ficheSrc = getFiche(ligne.idInputFiche!);
      const nBatchesSrc = qteBase / ficheSrc.quantiteOutput;
      const { coutTotal } = calculateBomCost(ligne.idInputFiche!, nBatchesSrc, new Set(visited));
      totalCost += coutTotal;
    }
  }

  const quantiteProduite = nBatches * fiche.quantiteOutput;
  return {
    coutTotal: totalCost,
    coutUnitaire: quantiteProduite > 0 ? totalCost / quantiteProduite : 0,
  };
}
```

**Règle critique :** Détection de cycles par `Set<ficheId>` en cours de traitement. Si cycle détecté → exception, jamais de boucle infinie.

---

### 3.3 Gestion du stock FIFO

#### Principe FIFO
- **Ingrédients :** tri `ORDER BY lots_ingredients.date_achat ASC` — les plus anciens consommés en premier
- **Produits intermédiaires :** tri `ORDER BY bom_stocks.date_production ASC`
- Jamais de suppression de lots : seulement décrémentation de `quantite_disponible`
- Tolérance d'arrondi : `TOLERANCE = 0.0001` — évite les faux négatifs flottants

#### Disponibilité nette
```
dispo_nette = lot.quantite_disponible
              - COALESCE(SUM(reservations.quantite_reservee WHERE actif=1), 0)
```

#### Algorithme ConsumeStock (TypeScript ready)

```typescript
const TOLERANCE = 0.0001;

async function consumeFIFO(params: {
  ficheIngredientId: number;
  qteToConsume: number;
  uniteConsommation: string;
  uniteStockage: string;
  idProduction: number;
  tx: Transaction; // transaction Prisma
}): Promise<number> {
  const { ficheIngredientId, qteToConsume, uniteConsommation, uniteStockage, idProduction, tx } = params;

  // Convertir vers unité de stockage
  const qteBase = convert(qteToConsume, uniteConsommation, uniteStockage);

  // Charger lots FIFO (avec verrou en transaction)
  const lots = await tx.lot.findMany({
    where: { ficheIngredientId, quantiteDisponible: { gt: 0 } },
    orderBy: { dateAchat: 'asc' }, // FIFO
  });

  let remaining = qteBase;
  let totalCost = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;

    const reservations = await tx.bomReservation.aggregate({
      where: { idLot: lot.id, actif: true },
      _sum: { quantiteReservee: true },
    });
    const reserved = reservations._sum.quantiteReservee ?? 0;
    const dispoNette = lot.quantiteDisponible - reserved;

    if (dispoNette <= 0) continue;

    const taken = Math.min(remaining, dispoNette);
    const prixUnitBase = lot.prixUnitaire / lot.qteParConditionnement;

    // Décrémenter lot
    await tx.lot.update({
      where: { id: lot.id },
      data: { quantiteDisponible: { decrement: taken } },
    });

    // Traçabilité
    await tx.bomProductionLigne.create({
      data: {
        idProduction,
        typeSource: 'lot_ingredient',
        idLotIngredient: lot.id,
        quantiteConsommee: taken,
        coutUnitaireMoment: prixUnitBase,
      },
    });

    totalCost += taken * prixUnitBase;
    remaining -= taken;
  }

  if (remaining > TOLERANCE) throw new Error('Stock insuffisant — ROLLBACK');

  return totalCost;
}
```

#### Double vérification anti-TOCTOU
1. **Simulation (hors transaction)** — affichage jauges avant production, sans verrous
2. **Exécution (en transaction)** — re-vérification avec `FOR UPDATE` + consommation atomique
3. Si la 2e vérification échoue → `ROLLBACK` complet, message d'erreur à l'utilisateur

---

### 3.4 Structure BOM hiérarchique

#### BomFiche (Recette)
```
BomFiche {
  id, idNiveau, nom
  uniteOutput            // piece, kg, g, l, ml, cl
  quantiteOutput         // qté produite par batch (> 0 obligatoire)
  tempsPreparation?      // minutes
  stockCible?            // seuil jauge 100%
  actif, dateCreation
  lignes: BomFicheLigne[]

  // Calculés
  coutBatch = calculé via BomCoutDAL
  coutUnitaire = coutBatch / quantiteOutput
}
```

#### BomNiveau (Étape)
```
BomNiveau {
  id, idContexte
  ordre    // 0 = ingrédients (jamais supprimable), 1, 2, 3...
  nom, description
}
```

Règle critique : **Niveau N peut SEULEMENT consommer des niveaux M < N.**
Jamais égal, jamais supérieur.

#### BomContexte (Domaine)
```
BomContexte {
  id, idActivite
  nom           // unique par activité
  description
  actif
}
```

À la création d'un contexte → **N0 créé automatiquement en transaction atomique** (nommé "Stock ingrédients", non supprimable).

#### BomFicheLigne (Composition)
```
BomFicheLigne {
  idFiche
  typeInput: 'ingredient' | 'fiche'
  idInputIngredient?    // mutuellement exclusif
  idInputFiche?         // mutuellement exclusif
  quantite
  uniteMesure
}
```

---

### 3.5 Prix HTVA / TVAC (achats)

```
facteur = 1 + tva_pct / 100

Mode HTVA saisi :
  prixTVAC = prixHTVA × facteur
  stockerDB: prix_unitaire = prixHTVA

Mode TVAC saisi :
  prixHTVA = prixTVAC / facteur
  stockerDB: prix_unitaire = prixHTVA
```

**La DB stocke TOUJOURS le prix HTVA.** Affichage TVAC = calculé à la volée.

---

### 3.6 Calcul stock en pièces / conditionnements

```
stock_pieces = FLOOR(stock_actuel_base / qte_par_conditionnement)
stock_kg/ml  = stock_actuel_base / facteur_unite_base

prix_par_unite_base = prix_achat_reference / qte_par_conditionnement
```

---

### 3.7 Multi-activité — Isolation

| Donnée | Partagée | Isolée par activité |
|--------|----------|---------------------|
| `fiches_ingredients` | ✅ Catalogue global | — |
| `lots_ingredients` | Via stock physique | ✅ Selon `activites_stocks` |
| `stocks` | ✅ Référentiel | Affectés à activités |
| `bom_contextes` | — | ✅ Par `id_activite` |
| `bom_niveaux` | — | ✅ Via contexte |
| `bom_fiches` | — | ✅ Via niveau |
| `bom_productions` | — | ✅ Via contexte → activité |
| `bom_stocks` | — | ✅ Champ `id_activite` dénormalisé |

**Filtre DAL ingrédients par activité :**
```sql
SELECT fi.* FROM fiches_ingredients fi
INNER JOIN lots_ingredients l ON l.id_fiche_ingredient = fi.id
INNER JOIN activites_stocks acs ON acs.id_stock = l.id_stock
WHERE acs.id_activite = @idActivite
```

---

### 3.8 Helpers & Utilitaires

#### Constantes métier (à reproduire en TypeScript)

```typescript
// Types d'input BOM
const BOM_TYPE_INGREDIENT = 'ingredient' as const;
const BOM_TYPE_FICHE = 'fiche' as const;

// Statuts commandes
const ORDER_STATUS = {
  PANIER: 'panier',
  PAYEE: 'payee',
  ANNULEE: 'annulee',
} as const;

// Types stock
const STOCK_TYPE = {
  LOT_INGREDIENT: 'lot_ingredient',
  PRODUIT_FABRIQUE: 'produit_fabrique',
} as const;
```

#### Palette de couleurs (design tokens confirmés)

```typescript
const AppColors = {
  chocoFonce: '#3D2817',     // Chocolat foncé (TitleBar)
  chocoMed:   '#6F4E37',     // Chocolat moyen (Sidebar active)
  or:         '#D4AF37',     // Or (bouton primaire)
  creme:      '#F5E6D3',     // Crème (fond clair)
  framboise:  '#C0392B',     // Framboise (alertes)

  // États stock
  vertDispo:    '#C8FFC8',   // Stock OK
  orangeReserv: '#FFC864',   // Réservé / warning
  rougePenur:   '#FF6464',   // Pénurie
} as const;
```

#### Format affichage

```typescript
function formatPrix(prix: number): string {
  return prix < 0.01 ? `${prix.toFixed(4)} €` : `${prix.toFixed(2)} €`;
}

function formatQteDisplay(valeur: number, unite: string): string {
  if (unite === 'g' && valeur >= 1000) return `${(valeur/1000).toFixed(3)} kg`;
  if (unite === 'ml' && valeur >= 1000) return `${(valeur/1000).toFixed(3)} l`;
  return `${valeur.toFixed(3)} ${unite}`;
}

function nullIfEmpty(s: string | undefined): string | null {
  return s?.trim() ? s.trim() : null;
}
```

---

### 3.9 Transaction atomique — Exécution production complète

```
BEGIN TRANSACTION

1. Charger niveau + fiche (dans la transaction)
2. Re-vérifier disponibilité de CHAQUE ligne (anti-TOCTOU)
   → Si pénurie : ROLLBACK + exception

3. INSERT bom_productions (cout_ingredients=0 provisoire)
   → récupérer idProduction

4. Pour chaque ligne de la fiche :
   a. Calculer qteAConommer = ligne.quantite × nBatches
   b. Convertir vers unité native de l'input
   c. Si type='ingredient' → ConsumeStock(lots FIFO)
   d. Si type='fiche' → ConsumeStock(bom_stocks FIFO)
   e. Cumuler coûts

5. UPDATE bom_productions SET cout_ingredients, cout_unitaire

6. INSERT bom_stocks (lot produit — stock du niveau N)
   - quantite_disponible = nBatches × fiche.quantiteOutput
   - cout_unitaire = cout_total / quantite_produite
   - date_dlc = if (fiche.dlcJoursRef) CURDATE() + dlcJoursRef

7. Libérer réservations actives concernées

COMMIT
→ Succès : message inline 3 sec + rafraîchissement UI

EN CAS D'EXCEPTION → ROLLBACK complet
```

---

## 4. MODULES & FONCTIONNALITÉS

### Module AUTH

| # | Fonctionnalité | Description | Règles clés |
|---|---------------|-------------|-------------|
| F-01 | Login BCrypt | Email + password, hash BCrypt interop PHP↔C# | `role='admin'` + `actif=1` requis. Message d'erreur non-révélateur |
| F-02 | Logout | Fermeture session + retour login | |
| F-03 | Soft delete compte | `actif=0` → accès refusé silencieusement | |

---

### Module NAVIGATION (Shell SFA)

| # | Fonctionnalité | Description |
|---|---------------|-------------|
| F-04 | Shell SFA | TitleBar + Sidebar 224px + ContentArea dynamique — aucune fenêtre secondaire sauf login |
| F-05 | Sidebar 3 sections | RESSOURCES (5 fixes) + ACTIVITÉS (dynamique) + CONTEXTES/NIVEAUX (conditionnels) |
| F-06 | Sélecteur activité | ComboBox filtre tous les écrans par activité active |
| F-07 | ScreenRouter | Mappage NavItemId → UserControl → ContentArea |
| F-08 | AppState observable | Zustand/events : ActiviteChanged, ContexteChanged, DataRefreshRequested |
| F-09 | Badges compteurs | Sidebar affiche nb d'entités par section |

---

### Module ACTIVITÉS

| # | Fonctionnalité | Écran | Règles |
|---|---------------|-------|--------|
| F-10 | CRUD Activités | FrmActivites + FrmActiviteEdit | Nom unique, validation inline |
| F-11 | Soft delete | FrmActivites | Confirmation + guard dépendances (contextes, productions) |
| F-12 | Liaison Activité ↔ Stock | FrmActiviteStocks | CheckedListBox, min 1 stock |
| F-13 | Filtrage contextuel | Tous les screens | `_state.ActiveActivite` propagé à tous les DAL |

---

### Module INGRÉDIENTS

**Écran liste :** `FrmIngredients`

Colonnes affichées : Nom, Conditionnement, Type physique, Densité, Fournisseur, Description
Indicateur alerte : fond MistyRose si `stock_actuel ≤ seuil_alerte_stock`
Filtre : chips par stock physique

**Écran édition :** `FrmIngredientEdit`

Champs obligatoires : Nom, Unité de base, Type physique, Qté par conditionnement (>0), Stock
Champs conditionnels : Densité (obligatoire si type = liquide ou poudre)
Comportement dynamique : unité cond. mise à jour selon unité choisie

**Règles :**
- Nom unique (vérifié en DB)
- Suppression bloquée si : lots avec stock > 0 OU utilisé dans lignes BOM
- Stock actuel = `SUM(lots_ingredients.quantite_disponible)` pour cet ingrédient
- `EstEnAlerte = stock_actuel <= seuil_alerte_stock`

---

### Module STOCKS (Emplacements)

**Écran :** `FrmStocks` — CRUD emplacements physiques
Suppression bloquée si : ingrédients présents dans le stock OU stock lié à une activité

---

### Module FOURNISSEURS

**Écran :** `FrmFournisseurs` — CRUD fournisseurs
Champs : Nom*, Contact, Téléphone, Email (validé regex), Adresse, Notes
Suppression bloquée si : fournisseur lié à des ingrédients

---

### Module ACHATS & LOTS

**Écran liste :** `FrmAchats` — liste FIFO par stock/activité

**Écran édition :** `FrmAchatEdit`

Champs obligatoires : Ingrédient, Fournisseur, Date achat, DLC (>= date achat), Nb conditionnements (>0), Prix HTVA, TVA%

Comportements dynamiques :
- Sélection ingrédient → affiche "X unités par conditionnement"
- Saisie Prix HTVA + TVA → Prix TVAC mis à jour en temps réel
- Saisie Nb cond. → Stock estimé affiché (nb × qte_par_cond)

Sauvegarde :
```
quantite_initiale = nb_conditionnements × qte_par_conditionnement
quantite_disponible = quantite_initiale
prix_achat_reel = nb_conditionnements × prix_unitaire_htva
```

Suppression bloquée si lot déjà consommé en production

---

### Module VUE STOCK GLOBALE

**Écran :** `FrmVueStock` — Source : `vue_stock_global`

**3 sections :**
1. Lots ingrédients — triés par DLC ASC (urgents d'abord)
2. Produits intermédiaires (bom_stocks niveaux non-finaux)
3. Produits finaux (bom_stocks niveau MAX)

**Indicateurs DLC :**
| Condition | Couleur |
|-----------|---------|
| Périmé (DLC < aujourd'hui) | Rouge |
| < 7 jours | Orange |
| > 7 jours | Vert |
| Sans DLC | Gris |

**Jauge stock cible (4 couleurs) :**
```
ratio = stock_actuel / stock_cible
> 75%  → Vert
50-75% → Jaune
25-50% → Orange
< 25%  → Rouge
```

---

### Module BOM — CONTEXTES

**Règle critique à reproduire en v2 :**
> À la création d'un contexte, le **niveau N0 ("Stock ingrédients") est automatiquement créé en transaction atomique**. Ce niveau N0 est non-supprimable.

Suppression d'un contexte : bloquée si productions enregistrées.

---

### Module BOM — NIVEAUX

**Règles hiérarchiques :**
1. Niveau N consomme uniquement niveaux M < N (jamais N ou supérieur)
2. Suppression uniquement du dernier niveau (MAX ordre)
3. N0 intouchable (UI + DB)
4. Ordre calculé automatiquement : `MAX(ordre) + 1`

---

### Module BOM — FICHES RECETTES

**Écran édition :** `FrmBomFicheEdit`

**Partie 1 — En-tête :** Nom*, Unité output*, Quantité output* (>0), Temps préparation?, Stock cible?, Description?

**Partie 2 — Lignes de composition :**
- Inputs disponibles : ingrédients de l'activité (`[Ingr.]`) + fiches de niveaux inférieurs (`[N1]`, `[N2]`…)
- Après sélection input → unités compatibles chargées automatiquement
- Ajout de ligne → liste immuable (unité verrouillée après ajout)

**Validation :**
- Nom unique par niveau
- Au moins une ligne
- Quantité output > 0

**Sauvegarde : transaction atomique** (INSERT fiche + INSERT toutes les lignes)

**Garde FK suppression :**
- Utilisée dans des productions → bloquée
- Utilisée comme input d'autres fiches → bloquée

---

### Module BOM — PRODUCTION & SIMULATION

**Simulation (dry-run, hors transaction) :**
- Sélecteurs cascade : Contexte → Niveau → Fiche → Nb batches
- Affichage disponible/nécessaire par ligne + statut ✅/❌
- Coût estimé affiché (`BomCoutDAL.CalculerCout`)
- Bouton "Lancer" : activé uniquement si 0 pénurie

**Exécution (transaction atomique) :**
- Re-vérification anti-TOCTOU dans la transaction
- FIFO ingrédients + FIFO produits intermédiaires
- INSERT bom_productions + lignes + bom_stocks (output)
- Libération des réservations actives

**Historique :**
- Coûts gelés au moment de la production (jamais recalculés rétroactivement)
- Traçabilité complète lot → ligne production → production

---

### Module CATALOGUE WEB (Laravel)

**Écran ERP :** `FrmProduits` + `FrmProduitWebEdit`

Champs : Nom commercial*, Catégorie*, Prix TTC*, Toggle en_vente, Fiche BOM liée (1:1), Image Cloudinary, Description

**Feature : Configurateur de saveurs**
- Si `produit.configurable = true` → CheckedListBox de parfums
- Règle : total sélectionné = EXACTEMENT `capacite_max` du produit
- Validation côté client (JS) ET serveur (PHP)
- Bouton "Ajouter au panier" désactivé tant que compteur ≠ capacité

**Images :** Upload Cloudinary (async, WaitCursor pendant upload)

---

### Module COMMANDES WEB (Laravel)

**Cycle de vie commande :**
```
panier → payee → annulee
```
(v1 simplifié — v2 ajoute : confirmée → en_préparation → prête → livrée)

**Paiement Stripe Checkout :**
- Modes : carte bancaire, Bancontact
- Webhook `payment_intent.succeeded` → UPDATE statut + email confirmation

**Frais livraison :**
- Retrait magasin : gratuit
- Belgique : +6,95€
- France : +9,95€

---

## 5. WORKFLOWS CLÉS

### WF-01 : Achat d'ingrédient

```
1. Sidebar → "Achats · Lots" → FrmAchats
2. "+ Ajouter" → FrmAchatEdit (vide)
3. Sélectionner ingrédient + fournisseur
4. Saisir N° lot AFSCA, date achat, DLC, nb cond., prix HTVA, TVA%
   → Preview TVAC et stock estimé en temps réel
5. "Enregistrer"
   → Validation (DLC >= date achat, prix >= 0, nb > 0)
   → INSERT lots_ingredients
   → quantite_disponible = nb_cond × qte_par_cond
6. Lot visible dans FrmAchats + VueStock + disponible pour simulations
```

---

### WF-02 : Création d'une recette BOM

```
1. Sidebar → clic Activité → clic Contexte → clic Niveau N1
2. "+ Ajouter fiche" → FrmBomFicheEdit (vide)
3. En-tête : Nom, unite_output="pièce", quantite_output=20, temps=45min
4. Ajouter lignes :
   - "[Ingr.] Chocolat noir 70%" | 150 g
   - "[Ingr.] Crème fraîche" | 100 ml
5. "Enregistrer"
   → Transaction : INSERT bom_fiches + INSERT bom_fiches_lignes
6. Fiche disponible comme input pour niveaux N2+
```

---

### WF-03 : Simulation + lancement production

```
1. Clic "Simuler" sur une fiche → FrmBomProductionSimulation
2. Sélecteurs pré-remplis : Contexte, Niveau, Fiche, Nb batches = 1
3. "Simuler" → BomProductionDAL.VerifierDisponibilite() (sans transaction)
   → DGV résultat : chaque ligne avec disponible / nécessaire / ✅❌
   → Coût estimé affiché
4. Si toutes ✅ → bouton "Lancer production" activé
5. "Lancer production" → BomProductionDAL.Executer() (transaction)
   → Anti-TOCTOU : re-vérification
   → FIFO consommation des lots
   → INSERT bom_productions + lignes
   → INSERT bom_stocks (output)
   → COMMIT
6. Message success inline + rafraîchissement UI
```

---

### WF-04 : Commande client boutique

```
CLIENT :
1. Catalogue → filtre catégorie → voir produit
2. Configurateur saveurs (si configurable) → N sélectionnées = capacite_max
3. "Ajouter au panier" → si non-connecté : redirect login/register
4. Panier → recap → mode livraison → total TTC
5. "Payer" → Stripe Checkout → Bancontact/carte
6. Webhook → statut 'payee' → email confirmation

ARTISAN (ERP) :
7. Voir commande dans CommandesScreen
8. Changer statut → prête → retrait effectué
```

---

### WF-05 : Création d'un contexte de production

```
1. Clic "+ Contexte" dans sidebar (activité sélectionnée)
2. FrmBomContexteEdit → saisir Nom
3. "Enregistrer"
   → Transaction atomique :
      - INSERT bom_contextes
      - INSERT bom_niveaux (N0 = "Stock ingrédients", ordre=0)
4. Sidebar CONTEXTES + NIVEAUX rafraîchis
5. N0 non-supprimable, non-éditable
```

---

## 6. RÔLES & PERMISSIONS

### v1 : Rôle unique ADMIN

Tout l'ERP WinForms est réservé aux comptes `role='admin'`. Pas de granularité RBAC (Role-Based Access Control) en v1.

| Module | Actions admin |
|--------|---------------|
| Auth | Login / Logout |
| Activités | CRUD + soft delete + liaison stocks |
| Ingrédients | CRUD + filtre par stock/activité |
| Fournisseurs | CRUD |
| Achats/Lots | CRUD + FIFO |
| BOM Contextes | CRUD (auto-N0) |
| BOM Niveaux | CRUD (hiérarchie) |
| BOM Fiches | CRUD + lignes composites |
| Production | Simulation + Exécution (TX) |
| Catalogue Web | CRUD produits + images |
| Commandes Web | Consultation + changement statut |
| Vue Stock Global | Lecture seule |

### Pour v2 (SaaS multi-tenant) — à concevoir

Rôles à implémenter en v2 (déjà prévu dans Prisma schema) :
- **OWNER** : accès total (actuel admin)
- **MANAGER** : ERP sans gestion comptes
- **PRODUCTION** : simulation + production uniquement
- **VENDEUR** : commandes web + catalogue
- **VIEWER** : lecture seule

---

## 7. MAPPING v1 → v2

### 7.1 Écrans WinForms → Pages React

| WinForms Form | Page / Composant React v2 | Type |
|---|---|---|
| `FrmLogin` | `/auth/login` → `LoginPage` | Full page |
| `FrmPrincipal` | `MainLayout` (sidebar + outlet) | Layout |
| `FrmIngredients` | `/ingredients` → `IngredientsPage` | List + DataTable |
| `FrmIngredientEdit` | `IngredientSheet` (side panel) | Sheet |
| `FrmStocks` | `/stocks` → `StocksPage` | List |
| `FrmStockEdit` | `StockSheet` | Sheet |
| `FrmFournisseurs` | `/fournisseurs` → `FournisseursPage` | List |
| `FrmFournisseurEdit` | `FournisseurSheet` | Sheet |
| `FrmAchats` | `/achats` → `AchatsPage` | List + Filters |
| `FrmAchatEdit` | `AchatSheet` | Sheet |
| `FrmVueStock` | `/stock` → `VueStockPage` | List + Jauges |
| `FrmBomContextes` | `/bom/contextes` → `ContextesPage` | List |
| `FrmBomContexteEdit` | `ContexteSheet` | Sheet |
| `FrmBomNiveaux` | `/bom/niveaux` → `NiveauxPage` | Hierarchical list |
| `FrmBomNiveauEdit` | `NiveauSheet` | Sheet |
| `FrmBomFiches` | `/bom/fiches` → `FichesPage` | List |
| `FrmBomFicheEdit` | `FicheSheet` | Complex sheet (ligne editor) |
| `FrmBomProductionSimulation` | `/production/simulation` → `SimulationPage` | Full page |
| *Historique productions* | `/production/historique` | DataTable |
| `FrmProduits` | `/catalogue/produits` → `ProduitsPage` | List + Images |
| `FrmProduitWebEdit` | `ProduitSheet` | Sheet + Cloudinary |
| *Commandes ERP* | `/commandes` → `CommandesPage` | List + statuts |
| *HubScreen* | `/dashboard` → `DashboardPage` | KPIs + alertes |

---

### 7.2 Architecture C# DAL → API Routes Next.js v2

| DAL C# | Routes API v2 (déjà créées) | Notes |
|--------|----------------------------|-------|
| `IngredientDAL` | `GET/POST /api/v1/ingredients` `GET/PUT/DELETE /api/v1/ingredients/[id]` | ✅ Existe |
| `LotDAL` | `GET/POST /api/v1/achats` `PATCH/DELETE /api/v1/achats/[id]` | À créer |
| `FournisseurDAL` | `GET/POST /api/v1/fournisseurs` | À créer |
| `BomContexteDAL` | `GET/POST /api/v1/bom/contextes` | À créer |
| `BomNiveauDAL` | `GET/POST /api/v1/bom/niveaux` | À créer |
| `BomFicheDAL` | `GET/POST /api/v1/bom/fiches` | À créer |
| `BomCoutDAL` | `GET /api/v1/bom/fiches/[id]/cout` | À créer |
| `BomProductionDAL` | `POST /api/v1/production/simuler` `POST /api/v1/production/executer` | À créer |
| `BomStockDAL` | `GET /api/v1/bom/stocks` | À créer |
| `VueStockGlobalDAL` | `GET /api/v1/stock/global` | À créer |
| `ActiviteDAL` | Inclus dans multi-tenant (tenantId = activité) | Adapté |
| `StockDAL` | `GET/POST /api/v1/stocks` | À créer |

---

### 7.3 MySQL → Prisma (points d'attention)

| Concept MySQL v1 | Prisma v2 | Note |
|---|---|---|
| ENUM colonnes | `enum` Prisma + TS types | Mapper exactement les valeurs |
| CHECK constraints | Zod validators + Prisma `@@check` | Double validation ORM + API |
| UNIQUE composite | `@@unique([a, b])` dans Prisma | |
| ON DELETE CASCADE | `onDelete: Cascade` | |
| ON DELETE RESTRICT | `onDelete: Restrict` | |
| ON DELETE SET NULL | `onDelete: SetNull` | |
| GENERATED ALWAYS AS | Calculé en application ou `@default` | Prisma ne supporte pas les colonnes générées MySQL → calculer en code |
| `vue_stock_global` (VIEW) | Raw query Prisma ou agrégation mémoire | `$queryRaw` pour union complexe |
| `FOR UPDATE` (verrou FIFO) | `$transaction` Prisma + isolationLevel | Prisma gère via transactions |
| Dénormalisation `bom_stocks` | Conserver `id_activite`, `id_contexte` | Nécessaire pour performances filtres |

---

### 7.4 Règles métier à ne PAS oublier en v2

> Ces règles n'ont pas d'impact visible dans l'UI mais sont critiques pour la cohérence des données.

1. **N0 auto-créé** lors de la création d'un contexte (transaction atomique)
2. **N0 non-supprimable** (guard en API + DB)
3. **Niveau N consomme uniquement M < N** (validation à l'ajout d'une ligne BOM)
4. **BomFicheLigne : exclusivité mutuelle** (ingredient XOR fiche) — CHECK constraint + Zod
5. **BomProductionLigne : exclusivité mutuelle** (lot_ingredient XOR bom_stock) — même pattern
6. **Cycle BOM détecté** (hashset visited pendant calcul récursif)
7. **FIFO strict** (ORDER BY date_achat/date_production ASC, jamais en désordre)
8. **Double vérification TOCTOU** (simulation hors TX puis re-vérif dans TX)
9. **Coûts gelés** à la production (jamais de recalcul rétroactif)
10. **Snapshot prix** dans `commandes_web_lignes.prix_unitaire` (protection contre modification prix)
11. **Stock jamais négatif** (`quantite_disponible >= 0`) — vérifier avant chaque consommation
12. **Dénormalisation intentionnelle** `bom_stocks.(id_activite, id_contexte)` — synchroniser à la production
13. **1 produit web par fiche BOM** (UNIQUE `id_bom_fiche`) — bloquer la création si déjà mappé
14. **Seuil alerte stock** calculé dynamiquement (jamais stocké, toujours = `SUM(lots.quantite_disponible) < seuil`)

---

### 7.5 Features v1 non encore implémentées en v2 (backlog)

| Feature v1 | Statut v2 | Priorité |
|---|---|---|
| CRUD Ingrédients complet | Squelette existant (`IngredientSheet`) | 🔴 P0 |
| CRUD Fournisseurs | Non créé | 🔴 P0 |
| CRUD Achats/Lots | Non créé | 🔴 P0 |
| CRUD Stocks (emplacements) | Non créé | 🟡 P1 |
| CRUD Activités (multi-tenant) | Remplacé par tenant | 🟡 P1 |
| BOM Contextes CRUD | Non créé | 🔴 P0 |
| BOM Niveaux CRUD | Non créé | 🔴 P0 |
| BOM Fiches CRUD + lignes | Non créé | 🔴 P0 |
| Simulation production | Non créé | 🔴 P0 |
| Exécution production (FIFO TX) | Non créé | 🔴 P0 |
| Vue stock globale | Non créé | 🟡 P1 |
| Jauges stock cible | Non créé | 🟡 P1 |
| Réservations BOM | Non créé | 🟠 P2 |
| Configurateur saveurs | Non créé | 🟠 P2 |
| Upload images Cloudinary/S3 | Mock URL | 🟡 P1 |
| PDF factures (Puppeteer) | HTML buffer | 🟠 P2 |
| Historique productions | Non créé | 🟡 P1 |
| Gestion commandes ERP | Placeholder | 🟡 P1 |
| Dark mode toggle | Tokens définis, toggle manquant | 🟠 P2 |
| Pages ERP squelettes (Recettes, Fournisseurs, Produits) | Squelettes | 🔴 P0 |
| BUG-004 : statut CONFIRMED non corrigé | À corriger | 🔴 P0 |

---

*Document généré par pipeline 3 agents — ArtisaStock v1 → v2 — 2026-07-16*
*Maintenu par : Archiviste `/hub` — Mettre à jour après chaque phase d'implémentation v2*
