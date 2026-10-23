# Module Boutique / Produits (spec 004)

**Created**: 2026-07-24
**Status**: Livrée · 2026-07-25

Premier module de la cascade, issu de L1-artisastock-horeca.md puis L2-artisastock-boutique-produits.md. Plan : `docs/modules/BOUTIQUE-PRODUITS-IMPLEMENTATION.md`.

### User Story 1 — Publier un produit depuis une fiche BOM (P1)
### User Story 2 — Fixer prix, marge et TVA (P1)
### User Story 3 — Répartir le stock entre Vitrine et Direct (P1)
### User Story 4 — Gérer les périssables et la clôture du jour (P2)

| Décision | Choix |
|---|---|
| D1 | Un produit est toujours issu d'une fiche BOM avec stock (sinon NO_STOCK) |
| D2 | Taux de TVA en bibliothèque par activité, un taux par produit |
| D3 | Allocation manuelle du stock par canal (ProductChannelStock) |
