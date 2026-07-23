# Traduction V1 → V2 — Index

> **Objet :** Traduction du fonctionnement d'ArtisaStock v1 (C# WinForms + Laravel/MySQL) vers v2 (Next.js 15 + Prisma/PostgreSQL), produite par l'instance Claude Code travaillant sur `charlesnadejda-project` (le dépôt v1).
> **Usage pour l'instance v2 :** ce dossier est la SOURCE DE VÉRITÉ sur le comportement de v1. Toute règle métier, contrainte ou workflow implémenté en v2 doit être vérifié par rapport à ces fichiers avant merge.

## Fonctionnement du tunnel

- Deux instances Claude Code travaillent en parallèle : une sur `charlesnadejda-project` (v1, lecture/extraction), une sur `artisastock-v2` (implémentation).
- L'instance v1 dépose ou met à jour des fichiers `.md` dans ce dossier au fil des sessions.
- L'instance v2 lit ces fichiers, implémente, puis peut annoter le fichier correspondant (section "Statut v2") pour tracer ce qui a été fait.
- Aucune des deux instances ne modifie le code source de l'autre projet.

## Comment lire ce dossier

La documentation suit le **circuit complet de l'utilisateur** (calqué sur `CN_docs/SCRIPT_DEFENSE_EXAMEN.md` côté v1, le scénario de démonstration Bar / Long Island Ice Tea) plutôt qu'un découpage purement technique par module. À chaque sous-étape du parcours, on isole :

- **Action utilisateur** — ce qu'il clique/saisit dans l'UI, dans l'ordre
- **Use case** — l'objectif métier de l'action
- **Fonctionnalité(s) impliquée(s)** — écrans WinForms/Laravel + DAL/Controllers concernés
- **Règles métier** — contraintes à reproduire à l'identique en v2
- **Code réel v1** — snippet vérifié dans le code source (pas de pseudo-code)
- **Mapping v2** — route/page cible et statut d'implémentation

Cette lecture "circuit" donne le contexte fonctionnel ; les fichiers de référence (10-14) donnent le détail technique transverse (schéma complet, algorithmes, mapping global) quand une étape y renvoie.

## 1. Circuit utilisateur (lecture principale, dans l'ordre)

| Fichier | Étape du circuit | Statut |
|---------|-------------------|--------|
| [01-etape0-login.md](01-etape0-login.md) | Connexion admin (WinForms) | ✅ Initial |
| [02-etape1-infrastructure.md](02-etape1-infrastructure.md) | Créer Stock → Activité → Contexte (3 niveaux) | ✅ Initial |
| [03-etape2-fiches-stock.md](03-etape2-fiches-stock.md) | Fiches ingrédients (catalogue) + achats de lots (stock réel) | ✅ Initial |
| [04-etape3-recettes-bom.md](04-etape3-recettes-bom.md) | Créer les recettes BOM N2 (Premix) et N3 (Cocktail) | ✅ Initial |
| [05-etape4-production.md](05-etape4-production.md) | Lancer la production en 2 passes (FIFO) | ✅ Initial |
| [06-etape5-publier-boutique.md](06-etape5-publier-boutique.md) | Publier un produit BOM sur la boutique Laravel | ✅ Initial |
| [07-etape6-parcours-client-laravel.md](07-etape6-parcours-client-laravel.md) | Catalogue → inscription → connexion → panier → checkout (client) | ✅ Initial |
| [08-etape7-retour-erp.md](08-etape7-retour-erp.md) | Retour ERP : vérification stock + gestion commande | ✅ Initial |

## 2. Références transverses (consultées depuis le circuit)

| Fichier | Contenu | Statut |
|---------|---------|--------|
| [10-reference-vue-ensemble.md](10-reference-vue-ensemble.md) | Architecture v1, domaine métier, chiffres clés | ✅ Initial |
| [11-reference-schema-donnees.md](11-reference-schema-donnees.md) | Tables MySQL, vue `vue_stock_global`, diagramme relations, timeline migrations | ✅ Initial |
| [12-reference-logique-metier.md](12-reference-logique-metier.md) | Conversions unités, coût BOM récursif, FIFO, HTVA/TVAC, isolation multi-activité | ✅ Initial |
| [13-reference-roles-permissions.md](13-reference-roles-permissions.md) | Rôle unique v1 vs RBAC prévu v2 | ✅ Initial |
| [14-reference-mapping-v1-v2.md](14-reference-mapping-v1-v2.md) | Écrans→pages, DAL→routes API, MySQL→Prisma, règles à ne pas oublier, backlog | ✅ Initial |
| [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md) | Pattern transversal Fiche (classe) vs Instance (Lot / BomStock) — asymétrie clé : Lot créé librement par formulaire, BomStock uniquement en sous-produit d'une production | ✅ Ajouté 2026-07-23 |

## Historique

- **2026-07-23** — Réorganisation initiale depuis `V1-FEATURE-AUDIT.md` (2026-07-16) en 7 fichiers thématiques.
- **2026-07-23** — Bascule vers une structure "circuit utilisateur" : ajout des 8 fichiers d'étape (01-08) calqués sur `SCRIPT_DEFENSE_EXAMEN.md`, renumérotation des fichiers thématiques restants en "références transverses" (10-14), suppression de `04-modules-fonctionnalites.md` et `05-workflows.md` (contenu absorbé par les fichiers d'étape, plus précis et contextualisé).
- **2026-07-23** — Approfondissement ciblé sur Stock/Activité/Contexte (demande explicite : ce sont les 3 fondations à implémenter en premier). [02-etape1-infrastructure.md](02-etape1-infrastructure.md) réécrit à partir d'une lecture directe du code source réel (DAL/Forms/Models + `sql/schema_complet.sql` + `migration_v09_cascade.sql`), pas seulement du script de démonstration. **Deux inexactitudes corrigées**, propagées depuis `V1-FEATURE-AUDIT.md` (2026-07-16) : (1) le niveau BOM "N0 non-supprimable" n'existe pas — `ordre` commence à 1, aucun niveau n'est protégé par son rang, seule règle réelle = suppression du dernier niveau uniquement ; (2) `ActiviteDAL.Delete` (hard delete) n'est PAS géré par cascade FK comme son commentaire XML l'affirme — la FK `bom_contextes→activites` est `RESTRICT`, pas `CASCADE` ; le chemin sûr est `Desactiver()`. Corrections répercutées dans 10, 11, 12, 13, 14.
- **2026-07-23** — Approfondissement ciblé sur Fiche ingrédient/Lot et Fiche BOM/BomStock (demande explicite : comprendre le fonctionnement des instanciations pour l'implémentation V2). [03-etape2-fiches-stock.md](03-etape2-fiches-stock.md) et [04-etape3-recettes-bom.md](04-etape3-recettes-bom.md) réécrits avec le CRUD complet vérifié contre le code source (synchronisation tripartite des prix, modes d'achat Conditionnement/Lot, préservation de consommation sur update de lot, règle réelle de disponibilité des inputs par niveau, comportement delete-all/recreate sur update de fiche BOM). Nouveau fichier [15-reference-pattern-fiche-instance.md](15-reference-pattern-fiche-instance.md) : le pattern classe/instance commun aux deux paires, et son asymétrie clé (un Lot se crée librement via formulaire, un BomStock ne peut naître que d'une production exécutée — aucune route/méthode de création manuelle n'existe pour `bom_stocks`).
