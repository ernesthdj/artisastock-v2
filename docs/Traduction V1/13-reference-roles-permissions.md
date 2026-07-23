# 6. Rôles & Permissions — ArtisaStock v1

> Repris de `docs/V1-FEATURE-AUDIT.md` §6 (généré 2026-07-16). Voir [00-INDEX.md](00-INDEX.md).

## v1 : Rôle unique ADMIN

Tout l'ERP WinForms est réservé aux comptes `role='admin'`. Pas de granularité RBAC (Role-Based Access Control) en v1.

| Module | Actions admin |
|--------|---------------|
| Auth | Login / Logout |
| Activités | CRUD + soft delete + liaison stocks |
| Ingrédients | CRUD + filtre par stock/activité |
| Fournisseurs | CRUD |
| Achats/Lots | CRUD + FIFO |
| BOM Contextes | CRUD (niveaux définis à la création, aucun niveau auto-généré après coup) |
| BOM Niveaux | CRUD (hiérarchie) |
| BOM Fiches | CRUD + lignes composites |
| Production | Simulation + Exécution (TX) |
| Catalogue Web | CRUD produits + images |
| Commandes Web | Consultation + changement statut |
| Vue Stock Global | Lecture seule |

## Pour v2 (SaaS multi-tenant) — à concevoir

Rôles à implémenter en v2 (déjà prévu dans Prisma schema) :
- **OWNER** : accès total (actuel admin)
- **MANAGER** : ERP sans gestion comptes
- **PRODUCTION** : simulation + production uniquement
- **VENDEUR** : commandes web + catalogue
- **VIEWER** : lecture seule
