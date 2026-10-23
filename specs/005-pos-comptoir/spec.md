# Module POS — caisse comptoir (spec 005)

**Created**: 2026-07-25
**Status**: En cours — 7/7 étapes livrées, vente de stock déjà produit et faille PIN à traiter

Issu de L2-artisastock-pos.md. Plan : `docs/modules/POS-IMPLEMENTATION.md`. Question ouverte : L1-pos-vente-stock-preproduit.md.

### User Story 1 — Le vendeur s'identifie par PIN (P1)
### User Story 2 — Le vendeur ouvre et ferme la caisse avec calcul d'écart (P1)
### User Story 3 — Le vendeur pointe son début et sa fin de service (P2)
### User Story 4 — Le vendeur encaisse une vente au comptoir (P1)
### User Story 5 — Le patron contrôle ventes, écarts et pointages (P2)

| Décision | Choix |
|---|---|
| D1 | Identification par PIN seul, sans sélection préalable du vendeur |
| D2 | Vente à la demande : chaque vente déclenche une production BOM (révision 2026-07-26) |
| D3 | Un PIN est unique par tenant |
