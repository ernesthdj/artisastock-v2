# 2. Schéma de données — ArtisaStock v1

> Repris de `docs/V1-FEATURE-AUDIT.md` §2 (généré 2026-07-16). Voir [00-INDEX.md](00-INDEX.md).

## 2.1 Inventaire des tables

### Référentiels

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

### Ingrédients & Lots

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

### Utilisateurs

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

### BOM — Nomenclature de fabrication

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

**`bom_niveaux`** — Étapes de production ordonnées (N1, N2, N3… — `ordre` commence à 1, pas 0 ; voir [02-etape1-infrastructure.md](02-etape1-infrastructure.md) pour le détail vérifié dans le code réel)

| Colonne | Type | Nullable | Note |
|---------|------|----------|------|
| `id` | INT AUTO_INCREMENT | ✗ | |
| `id_contexte` | INT | ✗ | → bom_contextes CASCADE |
| `ordre` | TINYINT UNSIGNED | ✗ | 1=premier niveau (nommé "Ingrédients" par défaut, éditable), 2+=niveaux fabrication supérieurs |
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

### Production & Stock BOM

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

### Boutique Web (e-commerce)

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

## 2.2 Vue unifiée : `vue_stock_global`

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

## 2.3 Diagramme de relations

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

## 2.4 Timeline des migrations

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
