# Étape 3 — Recettes BOM (fiches de production)

> Source : code réel vérifié — `Models/BomFiche.cs`, `Models/BomFicheLigne.cs`, `Models/BomStock.cs`, `DAL/BomFicheDAL.cs`, `DAL/BomFicheLigneDAL.cs`, `DAL/BomStockDAL.cs`, `Forms/FrmBomFicheEdit.cs`, `sql/schema_complet.sql`. Voir [00-INDEX.md](00-INDEX.md) et [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md) pour le principe classe/instance appliqué ici (BomFiche = recette, BomStock = production instanciée).
>
> **Révision 2026-07-23** : approfondissement demandé explicitement en parallèle de [03-etape2-fiches-stock.md](03-etape2-fiches-stock.md). Ajouts par rapport à la version précédente : CRUD complet (pas seulement la création), règle exacte de disponibilité des inputs par niveau, comportement réel de l'Update (remplacement total des lignes), fonctionnalité `Duplicate` non documentée auparavant.

## 3.1 Schéma réel

```sql
CREATE TABLE bom_fiches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_niveau INT NOT NULL,               -- FK bom_niveaux, RESTRICT
    nom VARCHAR(200) NOT NULL,
    description TEXT,
    unite_output ENUM('mg','g','kg','ml','cl','dl','l','piece') NOT NULL DEFAULT 'piece',
    quantite_output DECIMAL(10,4) NOT NULL DEFAULT 1,   -- CHECK > 0
    temps_preparation INT,
    stock_cible DECIMAL(10,4),
    actif TINYINT(1) NOT NULL DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (nom, id_niveau)
);

CREATE TABLE bom_fiches_lignes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_fiche INT NOT NULL,                -- FK bom_fiches, CASCADE
    type_input ENUM('ingredient','fiche') NOT NULL,
    id_input_ingredient INT NULL,         -- FK fiches_ingredients, CASCADE — rempli si type='ingredient'
    id_input_fiche INT NULL,              -- FK bom_fiches, CASCADE — rempli si type='fiche'
    quantite DECIMAL(12,4) NOT NULL,
    unite_mesure ENUM('mg','g','kg','ml','cl','dl','l','piece') NOT NULL
    -- CHECK d'exclusivité mutuelle : (type='ingredient' AND id_input_ingredient IS NOT NULL AND id_input_fiche IS NULL)
    --                             OR (type='fiche'      AND id_input_fiche      IS NOT NULL AND id_input_ingredient IS NULL)
);
```

Modèle C# (`BomFiche`) expose des propriétés **calculées côté référence uniquement** (pas le coût réel de production) :
```csharp
public decimal CoutBatch    => Lignes.Sum(l => l.SousTotal);
public decimal CoutUnitaire => QuantiteOutput > 0 ? CoutBatch / QuantiteOutput : 0;
```
où `BomFicheLigne.SousTotal = Quantite * PrixUnitaireRef` — `PrixUnitaireRef` vient de `fiches_ingredients.prix_achat_reference / qte_par_conditionnement` pour un input ingrédient, et **0 pour un input de type fiche** (le coût réel d'un sous-produit n'est connu qu'au moment de sa production effective, via FIFO — voir [12-reference-logique-metier.md](12-reference-logique-metier.md) §3.2). **`CoutBatch` en mode édition est donc une estimation partielle si la recette a des inputs de type "fiche"**, pas un coût réel — à ne pas confondre avec le coût réel gelé sur `BomStock.CoutUnitaire` au moment d'une production (voir [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md)).

---

## 3.2 Règle réelle de disponibilité des inputs (par niveau)

> Cette règle est implémentée directement dans `FrmBomFicheEdit.ChargerInputsDisponibles()`, pas dans le DAL — donc c'est une règle **UI actuelle**, à faire remonter côté validation serveur en v2 (elle n'est pas gardée en base au-delà de la contrainte FK).

**Les ingrédients sont TOUJOURS disponibles comme input**, quel que soit le niveau de la fiche en cours d'édition (`IngredientDAL.GetAllByActivite(idActivite)`, indépendant du niveau).

**Les fiches (produits intermédiaires) ne sont disponibles que si :**
```csharp
foreach (var niv in BomNiveauDAL.GetByContexte(_niveau.IdContexte))
{
    if (niv.Ordre >= _niveau.Ordre || niv.Ordre < 2) continue;
    // ... propose les fiches de ce niveau comme input
}
```
- `niv.Ordre >= _niveau.Ordre` exclu → confirme la règle "niveau N consomme seulement M < N"
- `niv.Ordre < 2` exclu → **le niveau 1 n'a jamais de `BomFiche` propres** (c'est le niveau des ingrédients bruts, pas de recette dessus) ; donc pour une fiche de niveau 2, seuls les ingrédients sont proposés (aucune fiche de niveau inférieur n'existe à consommer), et le label d'aide l'indique explicitement :

```csharp
lblTypeInput.Text = _niveau.Ordre <= 2
    ? "Inputs : ingrédients du stock (N1)"
    : "Inputs : ingrédients + fiches de tous les niveaux inférieurs";
```

**Mapping v2 :** cette règle doit être reproduite comme validation serveur (pas seulement filtrage de la liste déroulante côté UI) — sinon un appel API direct pourrait créer une ligne BOM avec un `id_input_fiche` de niveau égal ou supérieur, ce qu'aucune contrainte DB n'empêche actuellement (seule la FK garantit que la fiche référencée existe, pas qu'elle soit d'un niveau inférieur).

---

## 3.3 CRUD complet

### Liste (`BomFicheDAL.GetByNiveau` / `GetAll`)
- `GetByNiveau(idNiveau)` : usage principal, une fiche appartient à un niveau précis
- `GetAll(idActivite)` : utilisé par la simulation de production (toutes les fiches d'une activité, tous niveaux confondus)

### Création (`FrmBomFicheEdit`, `fiche == null`)
- En-tête : Nom*, Unité produite (combo), Quantité produite/exécution* (>0), Temps préparation (min), Stock cible (checkbox + valeur)
- Section lignes : sélection d'un input (ingrédient ou fiche selon règle §3.2) → unité proposée automatiquement compatible (`UnitConvertisseur.UnitesCompatibles`) → quantité → "+ Ajouter" pousse la ligne dans une liste en mémoire (`_lignes`), affichée dans un DGV local, **pas encore persistée**
- "Retirer" enlève une ligne de la liste en mémoire (par index de sélection DGV)
- Bouton Enregistrer **désactivé** si `cboInput.Items.Count == 0` (aucun input disponible pour ce niveau — évite de créer une fiche vide impossible à remplir)
- Validation : nom obligatoire + unique par niveau (`BomFicheDAL.NomExiste(nom, idNiveau, excludeId)`), **au moins une ligne obligatoire**
- Sauvegarde : `BomFicheDAL.Insert(fiche)` — transaction unique, INSERT fiche puis boucle `InsertLignes` pour chaque ligne

### Édition (`FrmBomFicheEdit`, `fiche != null`)
- Mêmes champs qu'en création, la liste `_lignes` est initialisée avec `fiche.Lignes` (chargées via `BomFicheDAL.GetById(id, avecLignes:true)`) et reste éditable (ajout/retrait) exactement comme en création

**Comportement réel de l'Update — remplacement total, pas de diff :**
```csharp
public static void Update(BomFiche f)
{
    using (var conn = DbHelper.GetConnection())
    using (var tx = conn.BeginTransaction())
    {
        try
        {
            // 1. UPDATE des colonnes d'en-tête (nom, description, unité, quantité, temps, stock cible)
            // 2. DELETE FROM bom_fiches_lignes WHERE id_fiche = @id   ← toutes les lignes existantes supprimées
            // 3. InsertLignes(...) ré-insère toutes les lignes de f.Lignes depuis zéro
            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }
}
```
**Il n'y a pas de diff ligne par ligne** (pas de comparaison "cette ligne a changé, celle-là est nouvelle, celle-ci a été supprimée") — chaque modification de la composition d'une fiche supprime et recrée l'intégralité des `bom_fiches_lignes`. Cela fonctionne car `bom_fiches_lignes` n'a aucune table qui la référence en FK (contrairement à `bom_fiches` elle-même, référencée par `bom_productions_lignes` et `bom_fiches_lignes.id_input_fiche`).

### Suppression (`BomFicheDAL.Delete`)
Transaction avec 2 pré-vérifications : (1) la fiche est référencée comme `id_input_fiche` dans une autre `bom_fiches_lignes` (utilisée par une fiche de niveau supérieur) → exception ; (2) des `bom_productions` existent pour cette fiche → exception. Cascade DB vers `bom_fiches_lignes` (`ON DELETE CASCADE` sur `id_fiche`) une fois les vérifications passées.

### Duplication (`BomFicheDAL.Duplicate`) — non documentée précédemment
```csharp
public static int Duplicate(int idFiche)
{
    var source = GetById(idFiche, avecLignes: true);
    string nomBase = $"Copie de {source.Nom}";
    string nom = nomBase;
    int suffixe = 2;
    while (NomExiste(nom, source.IdNiveau))
        nom = $"{nomBase} ({suffixe++})";
    // ... copie tous les champs + les lignes, Insert() réinsère chaque ligne
}
```
Génère un nom unique par suffixe numérique incrémental si "Copie de X" existe déjà. Copie l'intégralité des lignes (mêmes inputs, mêmes quantités) dans une nouvelle fiche du même niveau.

**Mapping v2 :**
- `GET/POST /api/v1/bom/fiches`, `PUT/DELETE /api/v1/bom/fiches/[id]` — 🔴 P0, non créé
- `POST /api/v1/bom/fiches/[id]/duplicate` — 🟠 P2 (fonctionnalité secondaire mais réelle en v1, absente du backlog précédent)
- L'update Prisma peut suivre le même pattern simple (delete-all + recreate lignes dans une transaction) plutôt qu'un diff complexe — c'est fidèle au comportement v1 et suffisant tant qu'aucune autre table ne référence `bom_fiches_lignes` par id de ligne individuelle (à vérifier si le schéma v2 ajoute une telle référence, auquel cas un diff deviendrait nécessaire)
- Valider côté serveur la règle de niveau (§3.2), pas seulement filtrer la liste déroulante frontend
- Le champ `CoutBatch`/`CoutUnitaire` affiché en édition doit être clairement présenté comme une **estimation de référence**, distincte du coût réel figé à la production (`BomStock.CoutUnitaire`) — voir [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md)
