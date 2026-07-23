# Étape 1 — Infrastructure (Stock, Activité, Contexte)

> Source : code réel vérifié dans `app-csharp/CharlesNadejda/CharlesNadejda/` (DAL + Forms + Models + `sql/schema_complet.sql` + `sql/migration_v09_cascade.sql`), pas seulement `CN_docs/SCRIPT_DEFENSE_EXAMEN.md`. Voir [00-INDEX.md](00-INDEX.md).
>
> **Pourquoi cette révision (2026-07-23) :** ce fichier est le point de départ demandé pour l'implémentation V2 de ces 3 entités fondamentales. Une lecture directe du code source a révélé que la documentation précédente (héritée de `V1-FEATURE-AUDIT.md`) contenait une règle inventée — "N0 auto-créé, non-supprimable" — qui **n'existe pas dans le code réel**. Voir §1.3 et l'encart "⚠️ Écart corrigé" plus bas. Toutes les règles ci-dessous sont vérifiées ligne à ligne contre le DAL/Forms/SQL réels.

---

## 1.1 STOCK — emplacement physique de rangement

### Schéma DB réel (`sql/schema_complet.sql`)
```sql
CREATE TABLE stocks (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom           VARCHAR(200) NOT NULL UNIQUE,
    description   TEXT,
    actif         TINYINT(1)  NOT NULL DEFAULT 1,
    date_creation DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activites_stocks (           -- jonction M:N
    id_activite INT NOT NULL,
    id_stock    INT NOT NULL,
    PRIMARY KEY (id_activite, id_stock),
    FOREIGN KEY (id_activite) REFERENCES activites(id) ON DELETE CASCADE,
    FOREIGN KEY (id_stock)    REFERENCES stocks(id)    ON DELETE CASCADE
);
```
**Pas de champ `Adresse`** — le modèle réel n'a que `Nom`, `Description`, `Actif`, `DateCreation`. (Le script de démo `SCRIPT_DEFENSE_EXAMEN.md` mentionne une "Adresse" pour l'exemple pédagogique du Bar — ce champ n'existe pas en base.)

### CRUD complet

**Liste** (`Forms/FrmStocks.cs`, hérite `FrmListeBase<Stock>`) :
- Colonnes affichées : Nom, Description, Créé le (Id et Actif masqués)
- Layout particulier : `SplitContainer` — Panel1 = DGV liste, Panel2 = `CheckedListBox` "Activités liées" au stock sélectionné, mise à jour en temps réel (chaque coche/décoche fait un INSERT/DELETE immédiat dans `activites_stocks`, sans bouton "Enregistrer" séparé)
- Le bouton Supprimer est désactivé dynamiquement (`ActualiserBoutonSupprimer`) si `StockDAL.ContientDonnees(idStock)` retourne vrai, avec tooltip explicatif — **prévention d'erreur avant clic**, pas gestion d'erreur après

**Création/Édition** (`Forms/FrmStockEdit.cs`, hérite `FrmEditBase`) :
- Champs : Nom (obligatoire), Description (multiligne, optionnelle)
- Validation : nom non vide + unique (`StockDAL.NomExiste(nom, excludeId)`)

**Suppression** (`DAL/StockDAL.Delete`) :
- Pré-vérification en 2 temps AVANT le DELETE : (1) tout `lots_ingredients` lié → exception avec message clair "contient N lot(s)" ; (2) lots avec `quantite_disponible > 0` → exception séparée. Aucune des deux ne s'appuie sur une erreur FK brute — ce sont des `SELECT COUNT(*)` explicites.
- La jonction `activites_stocks` n'est PAS vérifiée avant suppression — elle est en `ON DELETE CASCADE`, donc supprimer un stock délie silencieusement toutes les activités qui l'utilisaient (pas d'avertissement spécifique au-delà de la confirmation générique "Cette action est irréversible").

**Liaison M:N avec Activité** — deux points d'entrée symétriques dans l'UI, tous deux via `StockDAL.LierActivite(idActivite, idStock)` / `DelierActivite(...)` :
1. Depuis `FrmStocks` (panel latéral, sélection du stock → coche les activités)
2. Depuis `FrmActivites` → bouton "📦 Stocks liés" → `FrmActiviteStocks` (dialog modal, sélection de l'activité → coche les stocks, sauvegarde groupée au clic "Enregistrer" plutôt qu'immédiate)

**Code réel (`StockDAL.Delete`) :**
```csharp
public static void Delete(int id)
{
    using (var conn = DbHelper.GetConnection())
    using (var cmd  = conn.CreateCommand())
    {
        cmd.CommandText = @"SELECT COUNT(*) FROM lots_ingredients WHERE id_stock = @id";
        cmd.Parameters.AddWithValue("@id", id);
        int nb = Convert.ToInt32(cmd.ExecuteScalar());
        if (nb > 0)
            throw new InvalidOperationException(
                $"Impossible de supprimer : ce stock contient {nb} lot(s) d'ingrédients.\n" +
                "Déplacez ou supprimez les lots avant de supprimer le stock.");

        cmd.CommandText = @"SELECT COUNT(*) FROM lots_ingredients
                            WHERE id_stock = @id AND quantite_disponible > 0";
        cmd.Parameters.Clear();
        cmd.Parameters.AddWithValue("@id", id);
        int nbLots = Convert.ToInt32(cmd.ExecuteScalar());
        if (nbLots > 0)
            throw new InvalidOperationException(
                $"Impossible de supprimer : ce stock contient {nbLots} lot(s) d'ingrédients actifs.");

        cmd.CommandText = "DELETE FROM stocks WHERE id = @id";
        cmd.Parameters.Clear();
        cmd.Parameters.AddWithValue("@id", id);
        cmd.ExecuteNonQuery();
    }
}
```

**Mapping v2 :**
- `GET /api/v1/stocks`, `POST /api/v1/stocks`, `PUT /api/v1/stocks/[id]`, `DELETE /api/v1/stocks/[id]` — 🟡 P1, non créé
- `POST/DELETE /api/v1/stocks/[id]/activites/[idActivite]` (liaison M:N) — non créé
- Reproduire les 2 pré-vérifications explicites avant DELETE (jamais compter sur l'erreur FK Prisma brute — message générique et peu actionnable pour l'utilisateur)
- Prisma : `onDelete: Cascade` sur la relation `ActiviteStock` des deux côtés

---

## 1.2 ACTIVITÉ — branche métier

### Schéma DB réel
```sql
CREATE TABLE activites (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom           VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    actif         TINYINT(1)  NOT NULL DEFAULT 1,
    date_creation DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
`bom_contextes.id_activite` est en **`ON DELETE RESTRICT`** (vérifié dans `migration_v09_cascade.sql` — cette FK n'apparaît PAS dans la liste "RESTRICT → CASCADE" de la migration, elle reste donc RESTRICT depuis l'origine).

### CRUD complet

**Liste** (`Forms/FrmActivites.cs`, hérite `FrmListeBase<Activite>`) :
- `ChargerDonnees()` appelle `ActiviteDAL.GetAll(includeInactifs: true)` — **contrairement à Stock/Contexte, la liste Activités affiche aussi les inactives**, grisées en italique (`AppliquerStylesLignes`)
- Deux boutons additionnels propres à cet écran : **"✕ Désactiver / ✓ Réactiver"** (toggle selon état) et **"📦 Stocks liés"** (ouvre `FrmActiviteStocks`)

**Création/Édition** (`Forms/FrmActiviteEdit.cs`) :
- Champs : Nom (obligatoire, max 100 caractères), Description (multiligne)
- Validation : nom non vide + unique (`ActiviteDAL.NomExiste`)

**Désactivation (soft delete) — `ActiviteDAL.Desactiver(id)`, chemin recommandé :**
- Transaction avec 2 vérifications avant `UPDATE actif=0` : (1) `bom_contextes` actifs rattachés → exception ; (2) `lots_ingredients` avec stock > 0 dans les stocks liés à l'activité (via `activites_stocks`) → exception
- Si tout passe : `Commit`. Si une vérification échoue : `Rollback` + message clair
- `ActiviteDAL.Reactiver(id)` : simple `UPDATE actif=1`, aucune vérification (symétrie non gardée intentionnellement — réactiver ne peut rien casser)

**Suppression physique — `ActiviteDAL.Delete(id)` :**
> **⚠️ Écart réel identifié dans le code v1 — à ne PAS reproduire tel quel en v2.**
> Le commentaire XML de la méthode affirme : *"Suppression physique avec cascade complète... → bom_contextes (+ leurs bom_niveaux). Géré intégralement par les FK CASCADE en DB (migration v9)."*
> **C'est faux.** La FK réelle `bom_contextes.fk_bc_activite` est `ON DELETE RESTRICT` (confirmée dans `schema_complet.sql` ligne ~209 et absente de la liste des FK converties en CASCADE dans `migration_v09_cascade.sql`). Si un `bom_contexte` référence l'activité, `DELETE FROM activites` lève une erreur de contrainte FK MySQL brute.
> Le bouton "Supprimer" générique de `FrmListeBase` (hérité, pas masqué dans `FrmActivites`) attrape cette exception dans un `catch` générique et affiche `ex.Message` tel quel — donc un message MySQL technique non traduit, pas une phrase métier claire comme celles de `StockDAL.Delete` ou `BomContexteDAL.Delete`.
> **En pratique**, le chemin utilisateur normal passe par "Désactiver" (qui, lui, vérifie proprement) — le hard-delete est une voie de secours peu protégée.
> **Pour V2 :** soit répliquer un vrai `RESTRICT` + une pré-vérification explicite (comme Stock/Contexte) avant toute tentative de delete, soit ne pas exposer de hard-delete du tout sur l'entité tenant/activité et n'offrir que la désactivation.

**Code réel (`ActiviteDAL.Desactiver` — le chemin correct à reproduire) :**
```csharp
public static void Desactiver(int id)
{
    using (var conn = DbHelper.GetConnection())
    using (var tx = conn.BeginTransaction())
    {
        try
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = "SELECT COUNT(*) FROM bom_contextes WHERE id_activite = @id AND actif = 1";
                cmd.Parameters.AddWithValue("@id", id);
                int nbContextes = Convert.ToInt32(cmd.ExecuteScalar());
                if (nbContextes > 0)
                    throw new InvalidOperationException(
                        $"Impossible de désactiver : {nbContextes} contexte(s) actif(s) rattaché(s) à cette activité.");

                cmd.CommandText = @"
                    SELECT COUNT(*)
                    FROM lots_ingredients li
                    WHERE li.id_stock IN (
                        SELECT id_stock FROM activites_stocks WHERE id_activite = @id
                    ) AND li.quantite_disponible > 0";
                cmd.Parameters.Clear();
                cmd.Parameters.AddWithValue("@id", id);
                int nbLots = Convert.ToInt32(cmd.ExecuteScalar());
                if (nbLots > 0)
                    throw new InvalidOperationException(
                        $"Impossible de désactiver : {nbLots} lot(s) actif(s) dans les stocks rattachés à cette activité.");

                cmd.CommandText = "UPDATE activites SET actif = 0 WHERE id = @id";
                cmd.Parameters.Clear();
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }
        catch { tx.Rollback(); throw; }
    }
}
```

**Mapping v2 :**
- En SaaS multi-tenant, `Activite` devient conceptuellement le **tenant** — voir [14-reference-mapping-v1-v2.md](14-reference-mapping-v1-v2.md) §7.2
- `GET/POST /api/v1/activites` (ou `/api/v1/tenants`), `PATCH /api/v1/activites/[id]/deactivate` (reproduit `Desactiver`), `PATCH /api/v1/activites/[id]/reactivate` — 🟡 P1, non créé
- **Ne pas exposer de hard-delete non gardé.** Si un delete définitif est requis, ajouter les mêmes pré-vérifications explicites que `Desactiver`, dans la même transaction Prisma

---

## 1.3 CONTEXTE — domaine de production (+ ses Niveaux)

### Schéma DB réel
```sql
CREATE TABLE bom_contextes (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom           VARCHAR(200) NOT NULL,
    description   TEXT,
    id_activite   INT NOT NULL,
    actif         TINYINT(1) NOT NULL DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bomctx_nom_activite (nom, id_activite),
    FOREIGN KEY (id_activite) REFERENCES activites(id) ON DELETE RESTRICT
);

CREATE TABLE bom_niveaux (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    id_contexte   INT NOT NULL,
    ordre         TINYINT UNSIGNED NOT NULL,
    nom           VARCHAR(200) NOT NULL,
    description   TEXT,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bom_niveau_ordre (id_contexte, ordre),
    FOREIGN KEY (id_contexte) REFERENCES bom_contextes(id) ON DELETE CASCADE
);
```

> **⚠️ Écart corrigé par rapport à la documentation précédente (héritée de `V1-FEATURE-AUDIT.md`) :**
> L'ancienne doc affirmait *"N0 ('Stock ingrédients') est auto-créé en transaction atomique, non-supprimable"* et *"ordre : 0 = stock ingrédients, 1+ = niveaux fabrication"*.
> **Ceci ne correspond pas au code réel.** Les faits vérifiés :
> - `ordre` commence à **1**, pas 0 (`BomNiveauDAL.Insert` calcule `MAX(ordre)+1`, la première insertion donne `ordre=1`)
> - Le premier niveau est nommé **"Ingrédients" par défaut** (modifiable par l'utilisateur — champ `_txtNomN1` pré-rempli mais éditable dans `FrmBomContexteEdit`), pas "N0" ni "Stock ingrédients"
> - **Il n'existe aucune protection spécifique empêchant la suppression du premier niveau.** La seule règle de suppression (`BomNiveauDAL.Delete`) est : *on ne peut supprimer que le niveau d'ordre le plus élevé du contexte* — cette règle s'applique uniformément à TOUS les niveaux, y compris le premier s'il est aussi le dernier (contexte à un seul niveau)
> - Aucune création automatique de niveau après la création du contexte : **tous les niveaux (N1 + N2, N3...) sont saisis par l'utilisateur AVANT le premier `Enregistrer`**, dans le même formulaire de création (`FrmBomContexteEdit`, section "Niveaux de transformation"), puis insérés ensemble dans une seule transaction (`BomContexteDAL.InsertAvecNiveaux`)
>
> **Pour V2 :** reproduire la règle réelle — "un niveau ne peut être supprimé que s'il est le dernier de son contexte (ordre max)" — sans coder en dur une protection spéciale sur le niveau 1. Si un contexte n'a plus qu'un seul niveau, ce niveau reste supprimable (le contexte se retrouverait à 0 niveau — comportement du v1, à valider avec l'utilisateur si c'est le comportement désiré pour v2, ou si une garde minimale doit être ajoutée).

### CRUD complet — Contexte

**Liste** (`Forms/FrmBomContextes.cs`, hérite `FrmListeBase<BomContexte>`) :
- `ChargerDonnees()` → `BomContexteDAL.GetAll(idActivite)` — `idActivite = 0` retourne tous les contextes actifs (toutes activités), sinon filtré
- Colonnes : Nom du contexte, Activité, Description
- Bouton additionnel **"→ Niveaux"** ouvre `FrmBomNiveaux(contexte)` en modal

**Création (`FrmBomContexteEdit`, mode création) :**
- Champs en-tête : Nom (obligatoire), Activité (ComboBox, obligatoire — peut être forcée/verrouillée si le formulaire est ouvert depuis le contexte d'une activité précise via le paramètre `activiteForce`), Description
- Section "Niveaux de transformation" (**visible uniquement en création**, absente en édition) :
  - N1 toujours présent, nom éditable (défaut "Ingrédients")
  - Bouton "+" → dialog inline demandant le nom du niveau suivant (N2, N3...), ajouté à une `ListBox` locale
  - Bouton "−" → retire le dernier niveau ajouté de la liste (avant sauvegarde, purement côté formulaire)
- Validation : nom obligatoire, activité sélectionnée obligatoire, nom unique **par activité** (`BomContexteDAL.NomExiste(nom, idActivite, excludeId)` — contrainte DB `UNIQUE(nom, id_activite)`, donc le même nom de contexte peut exister dans deux activités différentes)
- Sauvegarde : `BomContexteDAL.InsertAvecNiveaux(contexte, listeNoms)` — transaction unique, INSERT contexte puis INSERT de chaque niveau avec `ordre = index+1`

**Édition (`FrmBomContexteEdit`, mode édition) :**
- Seuls Nom, Description, Activité sont modifiables — **pas de gestion des niveaux depuis ce formulaire** (passe par l'écran séparé `FrmBomNiveaux`)

**Suppression (`BomContexteDAL.Delete`) :**
- Transaction avec 2 pré-vérifications : (1) `bom_productions` enregistrées dans ce contexte (via `bom_niveaux`) → exception ; (2) `bom_stocks` avec `quantite_disponible > 0` dans ce contexte → exception
- Si tout passe : DELETE (cascade automatique vers `bom_niveaux` via FK `ON DELETE CASCADE`)

**Code réel (`BomContexteDAL.InsertAvecNiveaux` — création atomique contexte + niveaux) :**
```csharp
public static int InsertAvecNiveaux(BomContexte c, List<string> nomsNiveaux)
{
    using (var conn = DbHelper.GetConnection())
    using (var tx = conn.BeginTransaction())
    {
        try
        {
            int idContexte;
            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = @"
                    INSERT INTO bom_contextes (nom, description, id_activite, actif)
                    VALUES (@nom, @desc, @idActivite, 1)";
                Bind(cmd, c);
                cmd.ExecuteNonQuery();
                idContexte = (int)cmd.LastInsertedId;
            }

            string nomN1 = (nomsNiveaux != null && nomsNiveaux.Count > 0
                            && !string.IsNullOrWhiteSpace(nomsNiveaux[0]))
                ? nomsNiveaux[0] : "Ingrédients";

            var tousLesNoms = new List<string> { nomN1 };
            if (nomsNiveaux != null)
                for (int i = 1; i < nomsNiveaux.Count; i++)
                    if (!string.IsNullOrWhiteSpace(nomsNiveaux[i]))
                        tousLesNoms.Add(nomsNiveaux[i].Trim());

            for (int i = 0; i < tousLesNoms.Count; i++)
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
                        INSERT INTO bom_niveaux (id_contexte, ordre, nom, description)
                        VALUES (@idCtx, @ordre, @nom, NULL)";
                    cmd.Parameters.AddWithValue("@idCtx", idContexte);
                    cmd.Parameters.AddWithValue("@ordre", i + 1);   // ordre commence a 1
                    cmd.Parameters.AddWithValue("@nom",   tousLesNoms[i]);
                    cmd.ExecuteNonQuery();
                }
            }

            tx.Commit();
            return idContexte;
        }
        catch { tx.Rollback(); throw; }
    }
}
```

### CRUD complet — Niveau (sous-entité, écran séparé `FrmBomNiveaux`)

**Liste** (`Forms/FrmBomNiveaux.cs`) : `BomNiveauDAL.GetByContexte(idContexte)`, triée par `ordre`

**Ajout** — pas de nom de niveau imposé à l'avance : `OuvrirFormulaire(null)` calcule `BomNiveauDAL.GetProchainOrdre(idContexte)` = `MAX(ordre)+1`, puis ouvre `FrmBomNiveauEdit` avec cet ordre pré-assigné (affiché en lecture seule, jamais saisi par l'utilisateur)

**Édition** : Nom + Description modifiables, `Ordre` toujours en lecture seule. **Aucune vérification d'unicité du nom** au sein du contexte (contrairement à Stock/Activité/Contexte) — seule la contrainte `UNIQUE(id_contexte, ordre)` protège l'intégrité, pas le nom

**Suppression (`BomNiveauDAL.Delete`)** — règle unique et absolue : uniquement le niveau d'ordre maximum du contexte
```csharp
public static void Delete(int id)
{
    using (var conn = DbHelper.GetConnection())
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = @"
            SELECT COUNT(*) FROM bom_niveaux
            WHERE id_contexte = (SELECT id_contexte FROM bom_niveaux WHERE id = @id)
              AND ordre > (SELECT ordre FROM bom_niveaux WHERE id = @id)";
        cmd.Parameters.AddWithValue("@id", id);
        int niveauxSupérieurs = Convert.ToInt32(cmd.ExecuteScalar());

        if (niveauxSupérieurs > 0)
            throw new InvalidOperationException(
                "Impossible de supprimer un niveau intermédiaire. " +
                "Supprimez d'abord les niveaux supérieurs.");

        cmd.CommandText = "DELETE FROM bom_niveaux WHERE id = @id";
        cmd.Parameters.Clear();
        cmd.Parameters.AddWithValue("@id", id);
        cmd.ExecuteNonQuery();
    }
}
```

**Mapping v2 :**
- `GET/POST /api/v1/bom/contextes` avec body incluant la liste de niveaux à la création (`InsertAvecNiveaux` → une seule route, une seule transaction Prisma) — 🔴 P0, non créé
- `GET/POST /api/v1/bom/niveaux`, `DELETE /api/v1/bom/niveaux/[id]` (avec la vérification "dernier niveau uniquement" reproduite en Prisma) — 🔴 P0, non créé
- Contrainte Prisma `@@unique([nom, idActivite])` sur Contexte, `@@unique([idContexte, ordre])` sur Niveau
- `id_activite` sur `BomContexte` : `onDelete: Restrict` (pas Cascade) — cohérent avec la FK réelle v1
- `id_contexte` sur `BomNiveau` : `onDelete: Cascade` — cohérent avec la FK réelle v1
- **Ne pas implémenter de règle "N0 protégé" absente du v1** — si une protection du premier niveau est souhaitée en v2, ce serait un **choix produit nouveau**, pas une reproduction fidèle de v1 : à trancher explicitement avec l'utilisateur plutôt qu'assumé silencieusement

---

## Résumé des règles transverses aux 3 entités

| Règle | Stock | Activité | Contexte | Niveau |
|---|---|---|---|---|
| Nom unique | ✅ global | ✅ global | ✅ par activité | ❌ aucune (seul `ordre` est contraint) |
| Soft delete (`actif`) | possède la colonne mais pas de bouton dédié dans l'UI | ✅ Désactiver/Réactiver avec gardes | possède la colonne, pas de bouton dédié dans l'UI (uniquement hard delete gardé) | pas de colonne `actif` |
| Hard delete gardé par pré-check applicatif | ✅ (lots) | ⚠️ non — RESTRICT brut non catché proprement | ✅ (productions + stocks) | ✅ (dernier niveau seulement) |
| Transaction requise à la création | non (INSERT simple) | non (INSERT simple) | ✅ (contexte + niveaux ensemble) | non (INSERT simple, ordre calculé en sous-requête) |
