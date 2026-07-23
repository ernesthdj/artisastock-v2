# 3. Logique métier & règles — ArtisaStock v1

> Repris de `docs/V1-FEATURE-AUDIT.md` §3 (généré 2026-07-16). Voir [00-INDEX.md](00-INDEX.md).

## 3.1 Conversions d'unités

### Système d'unités

| Groupe | Unités | Unité de base | Facteurs (vers base) |
|--------|--------|---------------|---------------------|
| **Masse** | mg, cg, g, kg | g | 0.001, 0.01, 1, 1000 |
| **Volume** | ml, cl, dl, l | ml | 1, 10, 100, 1000 |
| **Pièce** | piece | piece | 1 (non convertible entre groupes) |

### Formule de conversion (atomique)

```
valeur_convertie = (valeur_source × facteur_source) / facteur_cible
```

Exemple : 500 g → kg = (500 × 1) / 1000 = 0.5 kg

### Règles strictes
- Conversion uniquement **dans le même groupe** (masse ↔ masse, volume ↔ volume)
- Tentative inter-groupes → exception levée
- `piece` ne se convertit qu'en `piece`
- Après sélection d'un input dans une ligne BOM, seules les unités compatibles sont proposées

### TypeScript ready

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

## 3.2 Calcul de coût BOM (récursif)

### Principe — Règle de 3 inter-niveaux

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

### Prix moyen pondéré d'un ingrédient

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

### Algorithme complet (TypeScript ready)

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

## 3.3 Gestion du stock FIFO

### Principe FIFO
- **Ingrédients :** tri `ORDER BY lots_ingredients.date_achat ASC` — les plus anciens consommés en premier
- **Produits intermédiaires :** tri `ORDER BY bom_stocks.date_production ASC`
- Jamais de suppression de lots : seulement décrémentation de `quantite_disponible`
- Tolérance d'arrondi : `TOLERANCE = 0.0001` — évite les faux négatifs flottants

### Disponibilité nette
```
dispo_nette = lot.quantite_disponible
              - COALESCE(SUM(reservations.quantite_reservee WHERE actif=1), 0)
```

### Algorithme ConsumeStock (TypeScript ready)

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

### Double vérification anti-TOCTOU
1. **Simulation (hors transaction)** — affichage jauges avant production, sans verrous
2. **Exécution (en transaction)** — re-vérification avec `FOR UPDATE` + consommation atomique
3. Si la 2e vérification échoue → `ROLLBACK` complet, message d'erreur à l'utilisateur

---

## 3.4 Structure BOM hiérarchique

### BomFiche (Recette)
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

### BomNiveau (Étape)
```
BomNiveau {
  id, idContexte
  ordre    // 0 = ingrédients (jamais supprimable), 1, 2, 3...
  nom, description
}
```

Règle critique : **Niveau N peut SEULEMENT consommer des niveaux M < N.**
Jamais égal, jamais supérieur.

### BomContexte (Domaine)
```
BomContexte {
  id, idActivite
  nom           // unique par activité
  description
  actif
}
```

À la création d'un contexte → **tous les niveaux (le premier + les niveaux supérieurs éventuels) sont saisis par l'utilisateur dans le même formulaire, puis insérés ensemble en transaction atomique** (`BomContexteDAL.InsertAvecNiveaux`). Le premier niveau (`ordre=1`) est nommé "Ingrédients" par défaut mais reste éditable, et n'est protégé par aucune règle de suppression spécifique — voir [02-etape1-infrastructure.md](02-etape1-infrastructure.md) pour le détail vérifié (correction d'une inexactitude de la documentation précédente qui décrivait un niveau "N0 non-supprimable" inexistant dans le code réel).

### BomFicheLigne (Composition)
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

## 3.5 Prix HTVA / TVAC (achats)

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

## 3.6 Calcul stock en pièces / conditionnements

```
stock_pieces = FLOOR(stock_actuel_base / qte_par_conditionnement)
stock_kg/ml  = stock_actuel_base / facteur_unite_base

prix_par_unite_base = prix_achat_reference / qte_par_conditionnement
```

---

## 3.7 Multi-activité — Isolation

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

## 3.8 Helpers & Utilitaires

### Constantes métier (à reproduire en TypeScript)

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

### Palette de couleurs (design tokens confirmés)

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

### Format affichage

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

## 3.9 Transaction atomique — Exécution production complète

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
