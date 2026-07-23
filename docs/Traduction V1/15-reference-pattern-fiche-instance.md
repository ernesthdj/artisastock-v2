# Pattern transversal — Fiche (classe) vs Instance (Lot / BomStock)

> Demandé explicitement (2026-07-23) : documenter comment les fiches ingrédients et fiches de recettes diffèrent en V1, et comment fonctionne leur "instanciation". Source : lecture directe de `Models/`, `DAL/` (Ingredient, Lot, BomFiche, BomFicheLigne, BomStock). Voir [03-etape2-fiches-stock.md](03-etape2-fiches-stock.md) et [04-etape3-recettes-bom.md](04-etape3-recettes-bom.md) pour le détail CRUD de chaque entité.

## Le principe commun

Tout le référentiel v1 repose sur une séparation stricte entre **définition** (une fiche, immuable dans le temps, sans état de quantité) et **instance** (une occurrence concrète, avec quantité, date, coût, traçabilité). C'est la même logique objet que classe/instance en programmation, appliquée deux fois dans des contextes différents :

| | Fiche (classe/définition) | Instance | Table instance |
|---|---|---|---|
| Ingrédient | `fiches_ingredients` (Ingredient) | Lot d'achat | `lots_ingredients` (Lot) |
| Recette BOM | `bom_fiches` (BomFiche) | Production réalisée | `bom_stocks` (BomStock) |

Les deux paires partagent 3 propriétés structurelles identiques — mais **une différence fondamentale dans la façon dont l'instance est créée**, détaillée plus bas.

---

## Ce que les deux paires ont en commun

**1. La fiche ne stocke jamais de quantité.** `Ingredient.StockActuel` et le total disponible d'une `BomFiche` sont toujours calculés par agrégation SQL (`COALESCE(SUM(...))`) sur la table d'instances correspondante, jamais persistés sur la fiche elle-même.

**2. L'instance porte le prix/coût réel, la fiche ne porte qu'une référence.**
- `Ingredient.PrixAchatReference` = prix de référence catalogue, utilisé comme valeur par défaut à la création d'un nouveau lot, mais **chaque `Lot` a son propre `PrixUnitaire`** réellement payé, qui peut différer du prix de référence
- `BomFiche` n'a pas de coût propre stocké — `CoutBatch`/`CoutUnitaire` sont calculés à la volée depuis les prix de référence des lignes (estimation) — mais **chaque `BomStock` a son propre `CoutUnitaire`**, calculé et gelé au moment précis de la production (coût réel FIFO, jamais recalculé après coup)

**3. FIFO s'applique aux deux tables d'instances**, sur des colonnes de date différentes : `lots_ingredients.date_achat ASC`, `bom_stocks.date_production ASC`. Voir [12-reference-logique-metier.md](12-reference-logique-metier.md) §3.3.

---

## La différence fondamentale : comment naît une instance

### Lot — créé manuellement, par un formulaire dédié
Un `Lot` naît d'une action utilisateur explicite et directe : **`FrmAchatEdit`**, un formulaire d'achat où l'utilisateur choisit librement la quantité, le prix (HTVA ou TVAC), le fournisseur, la date, la péremption. Rien n'oblige un lot à correspondre à une "vraie" transaction commerciale complète — c'est une saisie libre qui déclare "voici ce que j'ai physiquement en stock". Il existe une méthode DAL directe : `LotDAL.Insert(lot)`.

### BomStock — jamais créé manuellement, uniquement en sous-produit d'une Production
**Il n'existe aucun formulaire "créer une entrée de stock BOM" dans le code v1.** Aucune méthode `BomStockDAL.Insert()` n'existe même — `BomStockDAL` ne contient que des méthodes de lecture (`GetByNiveau`, `GetDisponible`, `GetLotsDispoFIFO`, `GetBomStocksFIFO`). L'écriture dans `bom_stocks` se fait exclusivement à l'intérieur de `BomProductionDAL.Executer()` (voir [05-etape4-production.md](05-etape4-production.md)), comme conséquence automatique et calculée d'une production réussie :
- La quantité produite n'est pas saisie librement — elle est `nBatches × fiche.QuantiteOutput`, un calcul dérivé
- Le coût unitaire n'est pas saisi librement — il est la somme des coûts FIFO réellement consommés sur les inputs, divisée par la quantité produite
- La date de production est celle de l'exécution, pas une date arbitraire
- La DLC est dérivée de `fiche.DlcJoursReference` (si définie) + date du jour, pas saisie

**Autrement dit : un Lot est une déclaration libre de l'utilisateur ("j'ai ceci en stock"), un BomStock est un résultat de calcul du système ("voici ce que la production vient de produire, à ce coût précis").** Cette asymétrie est structurelle et volontaire — elle garantit qu'aucun stock de produit fabriqué ne peut exister sans une production traçable (avec ses lignes de consommation FIFO associées dans `bom_productions_lignes`), alors qu'un lot d'ingrédient est justement le point d'entrée externe du système (l'achat, qui n'a pas de "production" en amont à tracer).

---

## Conséquence pour la conception V2

| Aspect | Ingrédient/Lot | BomFiche/BomStock |
|---|---|---|
| Route de création de l'instance | `POST /api/v1/achats` — formulaire libre, écrit directement la table d'instances | **Aucune route directe.** L'instance n'existe qu'en sortie de `POST /api/v1/production/executer` |
| Modifiable après création ? | Oui (`PATCH /api/v1/achats/[id]`), avec préservation de la consommation déjà faite (voir [03-etape2-fiches-stock.md](03-etape2-fiches-stock.md) §2.2) | Non — aucune édition manuelle d'une entrée `bom_stocks` en v1, cohérent avec le fait qu'elle représente un fait de production déjà survenu et tracé |
| Suppression manuelle ? | Oui, si non consommé | Pas de suppression manuelle en v1 — le stock ne "disparaît" qu'en étant consommé par une production de niveau supérieur (FIFO), jamais par un DELETE direct |

**Recommandation pour l'implémentation V2** : ne pas exposer de route `POST /api/v1/bom/stocks` générique côté API — si l'instance V2 en crée une par erreur ou par symétrie avec `/achats`, elle romprait l'invariant "tout stock de produit fabriqué descend d'une production tracée avec ses lignes de consommation". Le seul point d'écriture doit rester la route de production (`executer`), exactement comme en v1.
