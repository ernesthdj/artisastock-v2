# BOM multi-niveaux et production (spec 002)

**Created**: 2026-07-16
**Status**: Livrée · 2026-07-24

Nomenclature de production : contextes, niveaux N0..Nn, fiches techniques avec sous-fiches, coût de revient récursif, production FIFO transactionnelle et kanban de production.

### User Story 1 — Le patron écrit ses fiches techniques sur plusieurs niveaux (P1)
### User Story 2 — Le patron lance une production qui consomme le stock en FIFO (P1)

| Décision | Choix |
|---|---|
| D1 | Niveau racine créé automatiquement, dans la même transaction que le contexte |
| D2 | Coût calculé par parcours récursif avec détection de cycles |
