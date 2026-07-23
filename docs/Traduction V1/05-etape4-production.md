# Étape 4 — Production (2 passes)

> Source : `CN_docs/SCRIPT_DEFENSE_EXAMEN.md` §ETAPE 4. Voir [00-INDEX.md](00-INDEX.md).

## 4.1 Produire un niveau intermédiaire (N2)

**Action utilisateur :**
1. Sidebar → "Production" → `FrmProduction`
2. Sélectionner Activité, Contexte, Niveau (N2)
3. Sélectionner la fiche à produire, saisir le nombre de batches → quantité totale auto-calculée
4. "Vérifier le stock" → affichage ligne par ligne : disponible / nécessaire / ✅❌ par ingrédient
5. Si tout ✅ → "Lancer la production" devient actif
6. Confirmation inline + rafraîchissement UI
7. Vérification dans Fiches & Stock → Stock réel : les quantités des ingrédients consommés ont diminué (FIFO visible)

**Use case :** Transformer des ingrédients bruts en stock en un produit intermédiaire, en consommant les lots les plus anciens en premier et en traçant le coût de revient réel.

**Fonctionnalité(s) impliquée(s) :** `Forms/FrmBomProductionSimulation.cs`, `DAL/BomProductionDAL.cs` (`Executer`, `ConsumeStock`)

**Règles métier :**
- Production en **deux passes obligatoires** : produire N2 avant N3, car N3 en dépend. Si le stock de N2 est insuffisant, N3 est refusé
- **Double vérification anti-TOCTOU** : simulation hors transaction (affichage jauges) PUIS re-vérification dans la transaction au moment de l'exécution — la première vérification n'est qu'indicative, jamais une garantie
- FIFO strict : `ORDER BY date_achat ASC`, on ne prend jamais dans le désordre
- Le bouton "Lancer la production" reste désactivé tant que la vérification n'est pas passée (prévention d'erreur plutôt que gestion d'erreur après coup)
- Le coût de revient est cumulé ligne par ligne (`pris × prixUnitaire`) et gelé définitivement dans `bom_stocks` — jamais recalculé rétroactivement même si les prix d'achat changent ensuite

**Code réel v1 (boucle FIFO — cœur de `ConsumeStock`) :**
```csharp
foreach (var (idLot, dispo, prixUnit) in lots)
{
    if (restant <= 0) break;
    decimal pris = Math.Min(restant, dispo);
    // UPDATE lots_ingredients SET quantite_disponible -= pris
    restant -= pris;
    coutLigne += pris * prixUnit;
}
```

**Mapping v2 :** `POST /api/v1/production/simuler` (dry-run, sans transaction) + `POST /api/v1/production/executer` (transaction Prisma avec re-vérification). Voir [12-reference-logique-metier.md](12-reference-logique-metier.md) §3.3 pour l'algorithme TypeScript complet (`consumeFIFO`) et §3.9 pour le déroulé transactionnel intégral.

---

## 4.2 Produire le niveau final (N3, sources mixtes)

**Action utilisateur :**
1. Dans `FrmProduction`, changer le niveau sélectionné (N3)
2. Sélectionner la fiche finale, saisir le nombre de batches
3. "Vérifier le stock" → une ligne vérifie le stock `bom_stocks` (produit N2), une autre vérifie `lots_ingredients` (ingrédient N1 direct)
4. "Lancer la production" → confirmation
5. Vérifier que le produit N2 intermédiaire disparaît de la liste "Stock réel" si son stock est totalement épuisé (il n'est pas supprimé, juste filtré)

**Use case :** Produire le produit final consommé par deux types de sources simultanément — stock de production (niveau inférieur) et stock d'achat (ingrédient direct) — dans une seule transaction cohérente.

**Fonctionnalité(s) impliquée(s) :** `DAL/BomProductionDAL.cs` (branchement sur `TypeInput`)

**Règles métier :**
- Le type de source (`ingredient` vs `fiche`) détermine la table et la colonne de tri FIFO : `bom_stocks` trié par `date_production ASC`, ou `lots_ingredients` trié par `date_achat ASC` — même algorithme, table différente
- Traçabilité complète multi-niveaux : chaque production insère des lignes qui remontent N3 → N2 → N1 (quel lot exact a été consommé, à quelle étape)
- Un produit intermédiaire à stock épuisé (`quantite_disponible = 0`) disparaît de l'affichage "Stock réel" via `HAVING stock_actuel > 0` — c'est un filtre d'affichage, pas une suppression ; il réapparaît automatiquement dès qu'on en reproduit

**Code réel v1 (branchement par type de source) :**
```csharp
// Pour TypeInput = "fiche"      : consommer dans bom_stocks (FIFO date_production ASC)
// Pour TypeInput = "ingredient" : consommer dans lots_ingredients (FIFO date_achat ASC)

foreach (BomFicheLigne ligne in fiche.Lignes)
{
    if (ligne.TypeInput == "fiche")
    {
        var stocks = BomStockDAL.GetLotsDispoFIFO(ligne.IdInputFiche.Value, conn, tx);
        // Boucle FIFO : pris = Math.Min(restant, dispo), UPDATE bom_stocks
    }
    else
    {
        var lots = BomStockDAL.GetLotsDispoFIFO(ligne.IdInputIngredient.Value, conn, tx);
        // Boucle FIFO : pris = Math.Min(restant, dispo), UPDATE lots_ingredients
    }
}
```

**Mapping v2 :** Même route `POST /api/v1/production/executer`, avec un `switch` sur `typeInput` dans la logique de consommation. Voir aussi [14-reference-mapping-v1-v2.md](14-reference-mapping-v1-v2.md) §7.4 règle #12 (dénormalisation `bom_stocks.id_activite/id_contexte` à synchroniser à la production).
