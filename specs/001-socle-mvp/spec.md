# Socle MVP — pipeline d'agents (spec 001)

**Created**: 2026-06-07
**Status**: Livrée · 2026-07-16

Socle construit par le pipeline d'agents (Product Owner, Architecte, UI/UX, Backend, Frontend, QA) : multi-tenant, auth JWT, RBAC, i18n, API v1, vitrine publique, commandes. Références : `docs/USER-STORIES.md`, `docs/ARCHITECTURE.md`, `docs/UI-DESIGN.md`, `docs/QA-REPORT.md`.

### User Story 1 — Le patron crée son compte et se connecte (P1)
### User Story 2 — Le patron gère ses ingrédients et son stock (P1)
### User Story 3 — Le client commande en ligne et paie (P1)
### User Story 4 — Le patron suit ses commandes (P1)

| Décision | Choix |
|---|---|
| D1 | Auth JWT custom (access 15 min / refresh), pas NextAuth |
| D2 | Prisma $extends injecte tenantId sur toutes les requêtes |
| D3 | Stripe Connect Express, un compte par artisan |
| D4 | withPermission : les routes lisent tenantId/userId injectés par le middleware |
