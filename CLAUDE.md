# CLAUDE.md — ArtisaStock_V2

> **Projet :** ArtisaStock_V2
> **Slug :** artisastock-v2
> **Type :** Web App
> **Cree le :** 2026-06-07
> **Description :** ERP pâtisserie artisanale v2

---

## Contexte

Ce projet a ete cree via `/hub new` dans le workspace ProjectMaster.

**Origine et filiation academique (clarifie 2026-07-24)** : artisastock-v2 est la migration React/Next.js d'un projet unique qui mature a travers plusieurs examens plutot que d'etre recommence a chaque fois :
1. **PDSGBD** (examen de gestion de base de donnees) — projet initial nomme `charlesnadejda-project`, interface C# WinForms imposee par l'examen. Idee de depart : une app de gestion de stock pour la mere et le beau-pere de mentalyas, chocolatiers/patissiers (cas d'usage reel, pas hypothetique).
2. **PID** (examen a venir, exigences pas encore clarifiees) — c'est artisastock-v2 dans son etat courant qui doit servir cet examen.
3. **TFE** (Travail de Fin d'Etudes, horizon 1+ an) — artisastock-v2 continuera d'evoluer jusqu'a devenir le livrable final.

**Pivot de vision (brainstorm macro 2026-07-24)** : le projet s'est recentre sur un persona patron de restaurant (HORECA), avec trois modules a terme — RH, ERP, POS — partageant une seule source de verite (le stock), architecture modulaire activable/desactivable communiquant en API. Voir memoire `project_vision_horeca_pivot` pour le detail complet (references RESTOMAX/Securex, principe anti-fraude).

## Structure

```
artisastock-v2/
├── CLAUDE.md          # Ce fichier
├── docs/
│   └── JOURNAL.md     # Journal du projet
├── src/               # Code source
└── tests/             # Tests
```

## Regles specifiques

> Les regles globales de `~/.claude/CLAUDE.md` s'appliquent par defaut.

### Methodologie de conception — cascade de brainstorms (validee 2026-07-24)

Pour toute nouvelle fonctionnalite/module d'envergure sur ce projet, suivre systematiquement :

1. **Brainstorm macro** (`/brainstorm`) — vision globale, persona, differenciateurs, contraintes transverses. Deja mene le 2026-07-24 : pivot HORECA (voir memoire `project_vision_horeca_pivot`).
2. **Brainstorm par module** — un brainstorm dedie et plus precis par module (POS, Boutique/Produits, RH, etc.), dont l'objectif explicite est de produire :
   - les **use cases** du module,
   - un **workflow utilisateur complet** (parcours bout-en-bout, pas juste une liste de features).
3. **Implementation guidee par ce workflow** — le code suit le workflow utilisateur defini a l'etape 2, avec **test de la fonctionnalite dans le navigateur au fur et a mesure** (pas uniquement en fin de developpement).

Ne pas sauter l'etape 2 pour un module consequent : coder directement depuis le brainstorm macro produit un decalage entre l'intention et l'implementation.

### Architecture modulaire — activable/desactivable, API-first

Chaque module (RH, ERP, POS, Boutique, futurs modules comme FlowGet) doit pouvoir etre **active/desactive independamment** et communiquer avec les autres modules ou la DB **uniquement via API** — jamais de couplage direct en dur entre modules. Meme quand un module est reporte (ex. RH), tout module deja construit qui devra un jour s'y connecter (ex. POS) doit exposer des points d'API prevus pour cette integration future, sans attendre que le module recepteur existe.

## Stack

> A definir apres `/brainstorm`.

## Workflows actifs

- [ ] Brainstorm initial (`/brainstorm`)
- [ ] Pipeline agents (`/pipeline`)
- [ ] Graphify projet (`/graphify`)
