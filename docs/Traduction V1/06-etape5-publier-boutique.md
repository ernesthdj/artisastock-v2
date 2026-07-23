# Étape 5 — Publier sur la boutique web

> Source : `CN_docs/SCRIPT_DEFENSE_EXAMEN.md` §ETAPE 5. Voir [00-INDEX.md](00-INDEX.md).

## 5.1 Publier un produit BOM fini vers le catalogue Laravel

**Action utilisateur :**
1. Côté C#, sélectionner un produit BOM de niveau final (ex: N3) disponible en stock
2. "Publier sur la boutique"
3. Remplir : Nom public, Description, Prix de vente, TVA, Stock disponible (auto-rempli depuis `bom_stocks`)
4. "Publier"
5. Le produit apparaît immédiatement sur la boutique Laravel (`http://localhost`) avec son prix et son stock

**Use case :** Rendre un produit fabriqué (BOM) commercialisable côté e-commerce, en créant le pont entre le référentiel de production (ERP C#) et le catalogue client (Laravel).

**Fonctionnalité(s) impliquée(s) :** `DAL/ProduitWebDAL.cs` (INSERT dans `produits_web`), `app/Models/Produit.php` (Laravel — même table MySQL)

**Règles métier :**
- **1 produit web par fiche BOM** — contrainte `UNIQUE(id_bom_fiche)` : bloquer la création si la fiche est déjà mappée à un produit
- Aucune API entre C# et Laravel : les deux applications partagent directement la même base MySQL. C# écrit dans `produits_web`, Laravel lit dans `produits_web`. La cohérence est garantie par la DB (contraintes FK, transactions), pas par une communication applicative
- `id_bom_stock_source` (ou `id_bom_fiche`) relie le produit web à sa recette BOM — au checkout, c'est ce lien qui permettra de décrémenter le bon `bom_stocks`

**Mapping v2 :** En v2, C# + Laravel + MySQL partagé devient un **monolithe Next.js unique** (pas deux applications séparées) — donc cette étape n'a plus de sens architectural en tant que "pont inter-applications". Ce qui doit être préservé fonctionnellement : la contrainte 1:1 fiche BOM ↔ produit catalogue, et le fait que le stock affiché catalogue vient toujours d'une requête live sur `bom_stocks` (jamais dupliqué/caché). Voir [14-reference-mapping-v1-v2.md](14-reference-mapping-v1-v2.md) §7.4 règle #13.
