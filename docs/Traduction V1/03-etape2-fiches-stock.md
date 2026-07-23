# Étape 2 — Fiches & Stock (écran unifié)

> Source : code réel vérifié — `Models/Ingredient.cs`, `Models/Lot.cs`, `DAL/IngredientDAL.cs`, `DAL/LotDAL.cs`, `Forms/FrmIngredients.cs`, `Forms/FrmIngredientEdit.cs`, `Forms/FrmAchatEdit.cs`, `sql/schema_complet.sql`. Voir [00-INDEX.md](00-INDEX.md) et [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md) pour le principe général classe/instance qui structure tout ce module.
>
> **Révision 2026-07-23** : approfondissement demandé explicitement (avec [04-etape3-recettes-bom.md](04-etape3-recettes-bom.md)) pour servir de base à l'implémentation V2. Contenu entièrement revérifié contre le code source — plusieurs détails de la version précédente (basée sur le script de démo) étaient simplifiés ou inexacts (ex : pas de champ "Adresse", mode d'achat Conditionnement/Lot non documenté, synchronisation tripartite des prix non détaillée).

## Vue d'ensemble : Fiche (classe) vs Lot (instance)

> **Fiche ingrédient** (`fiches_ingredients`) = la définition/référentiel : "une bouteille de Vodka de 700ml, densité 0.79, prix de référence 15€".
> **Lot** (`lots_ingredients`) = une instance physique concrète : "5 bouteilles de Vodka achetées le 14/06 chez tel fournisseur, quantité disponible 3500ml".
> Une fiche n'a pas de quantité propre — le "stock actuel" est **toujours calculé** par agrégation des lots (`COALESCE(SUM(lots.quantite_disponible))`), jamais stocké sur la fiche. Voir [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md) pour le parallèle avec BomFiche/BomStock.

---

## 2.1 Fiche ingrédient (référentiel)

### Schéma réel (`fiches_ingredients`)
Champs modèle (`Models/Ingredient.cs`) : `Nom`, `Marque`, `Description`, `UniteMesure` (unité de base : mg/g/kg/ml/cl/dl/l/piece), `TypePhysique` (solide/liquide/poudre/piece), `Densite` (obligatoire si liquide/poudre), `ConditionnementLabel`, `QteParConditionnement`, `NbParLot` (défaut 1), `PrixAchatReference`, `SeuilAlerteStock`, `StockCible`, `IdFournisseurDefaut`, `IdStockDefaut`, `DlcJoursReference`, `QualiteLabel`, `Actif`.

Propriétés calculées (jamais stockées, toujours dérivées) :
- `PrixParUniteBase = PrixAchatReference / QteParConditionnement`
- `EstEnAlerte = StockActuel <= SeuilAlerteStock`
- `StockPieces = Floor(StockActuel / QteParConditionnement)`
- `StockRatio = StockActuel / StockCible`

### Liste (`FrmIngredients` + `IngredientDAL.GetAll`) — **deux modes de requête distincts, pas juste un filtre**

`GetAll(idStock, stockReelSeulement)` a **deux branches SQL entièrement différentes** :

| | Mode Fiches (`stockReelSeulement=false`) | Mode Stock réel (`stockReelSeulement=true`) |
|---|---|---|
| JOIN | `LEFT JOIN fournisseurs` seulement | + `LEFT JOIN lots_ingredients`, `GROUP BY fi.id` |
| `stock_actuel` | toujours `0` (non pertinent) | `COALESCE(SUM(l.quantite_disponible), 0)` |
| Filtre chip stock | `fi.id_stock_defaut = @idStock` | sous-requête sur lots existants dans ce stock avec `quantite_disponible > 0` |
| `HAVING` | aucun | `HAVING stock_actuel > 0` **uniquement si `idStock == 0`** (sinon un ingrédient sans lot dans le stock filtré serait à tort exclu du calcul global) |

Deux variantes supplémentaires du même DAL, utilisées ailleurs dans l'app (pas dans `FrmIngredients` lui-même) :
- **`GetAllForAchat(idActivite)`** — pour peupler la combo ingrédient de `FrmAchatEdit` : inclut les fiches jamais achetées nulle part (nouvelles) OU déjà achetées dans un stock de cette activité ; exclut les fiches achetées uniquement pour d'autres activités
- **`GetAllByActivite(idActivite)`** — `INNER JOIN` strict sur lots + `activites_stocks` : ne montre que les ingrédients ayant réellement du stock dans les stocks de cette activité, somme limitée à ces stocks

### Création/Édition (`FrmIngredientEdit`) — synchronisation tripartite des prix

Champs : Nom*, Marque, Unité de base* (combo), Type physique* (combo), Densité (visible seulement si liquide/poudre), Label conditionnement, Qté/conditionnement*, Nb cond./lot, Prix (3 champs synchronisés), Seuil alerte, Stock cible (saisi en **pièces**, converti en unité de base à la sauvegarde), Fournisseur par défaut, Stock de rangement par défaut.

**Relation verrouillée entre 3 champs de prix**, recalculée en temps réel à chaque frappe (`ValueChanged`) :
```
prixBase × qtéCond = prixCond × nbLot = prixLot
```
- Modifier `prixBase` (€/unité) → recalcule `prixCond` et `prixLot`
- Modifier `prixCond` (€/conditionnement) → recalcule `prixBase` et `prixLot`
- Modifier `prixLot` (€/lot) → recalcule `prixCond` et `prixBase`
- Modifier `nbLot` → recalcule seulement `prixLot` (prixCond reste inchangé)
- Modifier `qtéCond` → recalcule `prixCond` et `prixLot` (prixBase reste inchangé)

Un flag `_syncing` empêche la récursion infinie entre les 3 handlers.

**Code réel (`SyncFromBase` — un des 3 sens, les 2 autres suivent le même principe) :**
```csharp
private void SyncFromBase()
{
    if (_syncing) return;
    _syncing = true;
    try
    {
        nudPrixCond.Value = nudPrixBase.Value * nudQteConditionnement.Value;
        nudPrixLot.Value  = nudPrixCond.Value * nudNbLot.Value;
        MajLabelPrixRelation();
    }
    finally { _syncing = false; }
}
```

**Validation (`Valider`) :**
- Nom obligatoire + unique global (`IngredientDAL.NomExiste`)
- Unité de base et Type physique obligatoires
- `QteParConditionnement > 0`
- **Densité obligatoire uniquement si `TypePhysique` ∈ {liquide, poudre}** — sinon `Densite = null` explicitement à la sauvegarde (pas juste "champ ignoré", le modèle repasse à `null` même si une valeur avait été saisie puis le type changé)

**Suppression (`IngredientDAL.Delete`)** — transaction avec 2 pré-vérifications : (1) lots avec `quantite_disponible > 0` → exception ; (2) utilisé dans une `bom_fiches_lignes` (comme input) → exception.

**Mapping v2 :** `GET/POST /api/v1/ingredients`, `PUT/DELETE /api/v1/ingredients/[id]` — squelette déjà existant côté v2 (`IngredientSheet`), à vérifier contre les 2 branches de requête ci-dessus (le mode "catalogue" vs "stock réel" doit rester un paramètre de la même route, pas deux endpoints séparés, pour rester fidèle à v1). La synchronisation tripartite des prix est un comportement 100% frontend (state React local + `onChange`), aucune règle serveur associée au-delà du stockage de `PrixAchatReference` (= prixCond, prix par conditionnement HTVA de référence).

---

## 2.2 Lot (instance physique, achat)

### Schéma réel (`lots_ingredients`)
Champs modèle (`Models/Lot.cs`) : `IdFicheIngredient`, `IdStock`, `NbConditionnements`, `NumeroLot`, `IdFournisseur`, `DateAchat`, `DatePeremption`, `QuantiteInitiale`, `QuantiteDisponible`, `PrixUnitaire` (HTVA par conditionnement), `PrixAchatReel` (total HTVA), `TvaPct`, `ReferenceFacture`, `Notes`.

Contrainte DB : `CHECK (quantite_disponible >= 0)`. FK `id_stock` en `RESTRICT` (empêche la suppression d'un stock utilisé), `id_fiche_ingredient` en `CASCADE` (supprimer la fiche entraîne la suppression de ses lots — cohérent avec la garde applicative de `IngredientDAL.Delete` qui bloque justement ce cas si un lot a du stock).

### Création (`FrmAchatEdit`, mode création — `lot == null`)

**Deux modes d'achat, choix radio explicite (`rbModeCond` / `rbModeLot`) :**
- **Mode "Conditionnement"** : la quantité saisie EST le nombre de conditionnements (ex: 3 bouteilles)
- **Mode "Lot"** : la quantité saisie est un nombre de *lots*, chaque lot valant `NbParLot` conditionnements (ex: 2 lots × 6 bouteilles/lot = 12 conditionnements). N'a de sens que si la fiche a `NbParLot > 1`.
- `GetNbConditionnements()` fait la conversion : `nbSaisi × (NbParLot si mode Lot et NbParLot > 1, sinon × 1)`
- Un label explicatif dynamique (`MajModeLabel`) affiche concrètement ce que ça représente : *"1 lot = 6 × Bouteille 1L"*

**Saisie du prix — HTVA ou TVAC au choix (radio) :**
```
facteur = 1 + tvaPct / 100

Saisie HTVA : prixTvac = prixSaisi × facteur         → stocké : prix_unitaire = prixSaisi
Saisie TVAC : prixHtva = prixSaisi / facteur          → stocké : prix_unitaire = prixHtva
```
**La DB stocke toujours le prix HTVA par conditionnement**, quel que soit le mode de saisie choisi par l'utilisateur — recalcul systématique à la sauvegarde (`Sauvegarder()`), pas seulement à l'affichage.

**Recalcul live (pas seulement au `LostFocus`)** : comme pour `FrmIngredientEdit`, chaque champ impliqué (`nudPrix`, `nudTvaPct`, `nudQuantite`) s'abonne à la fois à `ValueChanged` ET `TextChanged`, lu via un helper `ReadLive()` qui parse `nud.Text` directement — sinon le prix affiché ne réagirait qu'après avoir quitté le champ.

**Bouton raccourci "+ Nouvelle Fiche"** (visible en création uniquement) : ferme le formulaire avec `DialogResult.Retry` (convention interne) — signale à l'appelant d'ouvrir `FrmIngredientEdit` puis de revenir sur `FrmAchatEdit`, pour créer une fiche à la volée sans perdre le contexte d'achat en cours.

**Calculs à la sauvegarde :**
```
NbConditionnements  = GetNbConditionnements()                          // tient compte du mode Cond/Lot
QuantiteInitiale    = NbConditionnements × QteParConditionnement       // stock total reçu
QuantiteDisponible  = QuantiteInitiale                                 // à la création uniquement
PrixUnitaire        = prixHTVA (recalculé, arrondi à 4 décimales)
PrixAchatReel       = NbConditionnements × PrixUnitaire
```

**Validation :** ingrédient sélectionné obligatoire (création seulement — verrouillé en édition), quantité > 0, prix > 0, stock de destination obligatoire.

### Édition (`FrmAchatEdit`, mode édition — `lot != null`)

- L'ingrédient est affiché en lecture seule (`Label`, pas de `ComboBox`) — **on ne peut jamais changer l'ingrédient d'un lot existant**, seulement le modifier ou le supprimer
- Tous les autres champs restent modifiables (stock, fournisseur, dates, quantité, prix, notes)

**Règle métier critique sur l'Update (`LotDAL.Update`) — préservation de la consommation déjà effectuée :**
```sql
quantite_disponible = GREATEST(0, @qteInit - (quantite_initiale - quantite_disponible))
```
Si un lot de 3500ml a déjà été consommé à hauteur de 300ml (disponible = 3200ml) et que l'utilisateur corrige `QuantiteInitiale` à 4000ml (ex: erreur de saisie), le nouveau disponible devient `4000 - 300 = 3700ml` — **la quantité déjà consommée par la production est soustraite de la nouvelle quantité initiale, jamais simplement écrasée**. `GREATEST(0, ...)` protège contre un résultat négatif si la nouvelle initiale est inférieure à ce qui a déjà été consommé.

### Suppression (`LotDAL.Delete`)
Bloquée si le lot a été **partiellement consommé** : `quantite_initiale - quantite_disponible > 0` → exception explicite ("les données de traçabilité seraient perdues"). Un lot jamais touché (`disponible == initiale`) reste supprimable sans condition.

**Mapping v2 :**
- `GET/POST /api/v1/achats`, `PATCH/DELETE /api/v1/achats/[id]` — 🔴 P0, non créé
- Reproduire les 2 modes d'achat (Conditionnement/Lot) comme un seul champ `mode` côté formulaire, converti côté client avant envoi (ou envoyé tel quel et calculé côté API — à trancher, mais dans les deux cas le calcul `nbConditionnements = saisie × (nbParLot si mode=lot)` doit exister quelque part)
- Le calcul HTVA/TVAC ↔ stockage HTVA doit être fait côté serveur au moment du `POST/PATCH`, pas seulement côté client, pour ne pas dépendre de la fiabilité du payload envoyé
- **Reproduire la formule `GREATEST(0, nouvelle_initiale - consommé)` sur l'update** — c'est une règle métier non triviale, silencieusement perdue si l'update v2 fait un simple `UPDATE ... SET quantite_disponible = nouvelle_valeur`
- Reproduire la garde de suppression sur consommation partielle
