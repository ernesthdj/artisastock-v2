# 7. Mapping v1 → v2 — ArtisaStock

> Repris de `docs/V1-FEATURE-AUDIT.md` §7 (généré 2026-07-16). Voir [00-INDEX.md](00-INDEX.md).

## 7.1 Écrans WinForms → Pages React

| WinForms Form | Page / Composant React v2 | Type |
|---|---|---|
| `FrmLogin` | `/auth/login` → `LoginPage` | Full page |
| `FrmPrincipal` | `MainLayout` (sidebar + outlet) | Layout |
| `FrmIngredients` | `/ingredients` → `IngredientsPage` | List + DataTable |
| `FrmIngredientEdit` | `IngredientSheet` (side panel) | Sheet |
| `FrmStocks` | `/stocks` → `StocksPage` | List |
| `FrmStockEdit` | `StockSheet` | Sheet |
| `FrmFournisseurs` | `/fournisseurs` → `FournisseursPage` | List |
| `FrmFournisseurEdit` | `FournisseurSheet` | Sheet |
| `FrmAchats` | `/achats` → `AchatsPage` | List + Filters |
| `FrmAchatEdit` | `AchatSheet` | Sheet |
| `FrmVueStock` | `/stock` → `VueStockPage` | List + Jauges |
| `FrmBomContextes` | `/bom/contextes` → `ContextesPage` | List |
| `FrmBomContexteEdit` | `ContexteSheet` | Sheet |
| `FrmBomNiveaux` | `/bom/niveaux` → `NiveauxPage` | Hierarchical list |
| `FrmBomNiveauEdit` | `NiveauSheet` | Sheet |
| `FrmBomFiches` | `/bom/fiches` → `FichesPage` | List |
| `FrmBomFicheEdit` | `FicheSheet` | Complex sheet (ligne editor) |
| `FrmBomProductionSimulation` | `/production/simulation` → `SimulationPage` | Full page |
| *Historique productions* | `/production/historique` | DataTable |
| `FrmProduits` | `/catalogue/produits` → `ProduitsPage` | List + Images |
| `FrmProduitWebEdit` | `ProduitSheet` | Sheet + Cloudinary |
| *Commandes ERP* | `/commandes` → `CommandesPage` | List + statuts |
| *HubScreen* | `/dashboard` → `DashboardPage` | KPIs + alertes |

---

## 7.2 Architecture C# DAL → API Routes Next.js v2

| DAL C# | Routes API v2 (déjà créées) | Notes |
|--------|----------------------------|-------|
| `IngredientDAL` | `GET/POST /api/v1/ingredients` `GET/PUT/DELETE /api/v1/ingredients/[id]` | ✅ Existe |
| `LotDAL` | `GET/POST /api/v1/achats` `PATCH/DELETE /api/v1/achats/[id]` | À créer |
| `FournisseurDAL` | `GET/POST /api/v1/fournisseurs` | À créer |
| `BomContexteDAL` | `GET/POST /api/v1/bom/contextes` | À créer |
| `BomNiveauDAL` | `GET/POST /api/v1/bom/niveaux` | À créer |
| `BomFicheDAL` | `GET/POST /api/v1/bom/fiches` | À créer |
| `BomCoutDAL` | `GET /api/v1/bom/fiches/[id]/cout` | À créer |
| `BomProductionDAL` | `POST /api/v1/production/simuler` `POST /api/v1/production/executer` | À créer |
| `BomStockDAL` | `GET /api/v1/bom/stocks` | À créer |
| `VueStockGlobalDAL` | `GET /api/v1/stock/global` | À créer |
| `ActiviteDAL` | Inclus dans multi-tenant (tenantId = activité) | Adapté |
| `StockDAL` | `GET/POST /api/v1/stocks` | À créer |

---

## 7.3 MySQL → Prisma (points d'attention)

| Concept MySQL v1 | Prisma v2 | Note |
|---|---|---|
| ENUM colonnes | `enum` Prisma + TS types | Mapper exactement les valeurs |
| CHECK constraints | Zod validators + Prisma `@@check` | Double validation ORM + API |
| UNIQUE composite | `@@unique([a, b])` dans Prisma | |
| ON DELETE CASCADE | `onDelete: Cascade` | |
| ON DELETE RESTRICT | `onDelete: Restrict` | |
| ON DELETE SET NULL | `onDelete: SetNull` | |
| GENERATED ALWAYS AS | Calculé en application ou `@default` | Prisma ne supporte pas les colonnes générées MySQL → calculer en code |
| `vue_stock_global` (VIEW) | Raw query Prisma ou agrégation mémoire | `$queryRaw` pour union complexe |
| `FOR UPDATE` (verrou FIFO) | `$transaction` Prisma + isolationLevel | Prisma gère via transactions |
| Dénormalisation `bom_stocks` | Conserver `id_activite`, `id_contexte` | Nécessaire pour performances filtres |

---

## 7.4 Règles métier à ne PAS oublier en v2

> Ces règles n'ont pas d'impact visible dans l'UI mais sont critiques pour la cohérence des données.

1. **Tous les niveaux saisis à la création du contexte** (premier niveau + niveaux supérieurs), insérés ensemble en transaction atomique (`InsertAvecNiveaux`) — pas de niveau ajouté automatiquement après coup
2. **Aucun niveau n'est protégé contre la suppression par son rang** — seule règle réelle : on ne peut supprimer QUE le niveau d'ordre maximum du contexte (dernier créé), y compris le premier niveau si le contexte n'en a qu'un. *(Correction : la documentation précédente affirmait à tort un "N0 non-supprimable" absent du code v1 — voir [02-etape1-infrastructure.md](02-etape1-infrastructure.md).)*
3. **Niveau N consomme uniquement M < N** (validation à l'ajout d'une ligne BOM)
4. **BomFicheLigne : exclusivité mutuelle** (ingredient XOR fiche) — CHECK constraint + Zod
5. **BomProductionLigne : exclusivité mutuelle** (lot_ingredient XOR bom_stock) — même pattern
6. **Cycle BOM détecté** (hashset visited pendant calcul récursif)
7. **FIFO strict** (ORDER BY date_achat/date_production ASC, jamais en désordre)
8. **Double vérification TOCTOU** (simulation hors TX puis re-vérif dans TX)
9. **Coûts gelés** à la production (jamais de recalcul rétroactif)
10. **Snapshot prix** dans `commandes_web_lignes.prix_unitaire` (protection contre modification prix)
11. **Stock jamais négatif** (`quantite_disponible >= 0`) — vérifier avant chaque consommation
12. **Dénormalisation intentionnelle** `bom_stocks.(id_activite, id_contexte)` — synchroniser à la production
13. **1 produit web par fiche BOM** (UNIQUE `id_bom_fiche`) — bloquer la création si déjà mappé
14. **Seuil alerte stock** calculé dynamiquement (jamais stocké, toujours = `SUM(lots.quantite_disponible) < seuil`)

---

## 7.5 Features v1 non encore implémentées en v2 (backlog)

| Feature v1 | Statut v2 | Priorité |
|---|---|---|
| CRUD Ingrédients complet | Squelette existant (`IngredientSheet`) | 🔴 P0 |
| CRUD Fournisseurs | Non créé | 🔴 P0 |
| CRUD Achats/Lots | Non créé | 🔴 P0 |
| CRUD Stocks (emplacements) | Non créé | 🟡 P1 |
| CRUD Activités (multi-tenant) | Remplacé par tenant | 🟡 P1 |
| BOM Contextes CRUD | Non créé | 🔴 P0 |
| BOM Niveaux CRUD | Non créé | 🔴 P0 |
| BOM Fiches CRUD + lignes | Non créé | 🔴 P0 |
| Simulation production | Non créé | 🔴 P0 |
| Exécution production (FIFO TX) | Non créé | 🔴 P0 |
| Vue stock globale | Non créé | 🟡 P1 |
| Jauges stock cible | Non créé | 🟡 P1 |
| Réservations BOM | Non créé | 🟠 P2 |
| Configurateur saveurs | Non créé | 🟠 P2 |
| Upload images Cloudinary/S3 | Mock URL | 🟡 P1 |
| PDF factures (Puppeteer) | HTML buffer | 🟠 P2 |
| Historique productions | Non créé | 🟡 P1 |
| Gestion commandes ERP | Placeholder | 🟡 P1 |
| Dark mode toggle | Tokens définis, toggle manquant | 🟠 P2 |
| Pages ERP squelettes (Recettes, Fournisseurs, Produits) | Squelettes | 🔴 P0 |
| BUG-004 : statut CONFIRMED non corrigé | À corriger | 🔴 P0 |
