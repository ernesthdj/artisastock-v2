# Étape 7 — Retour ERP : vérification stock et gestion des commandes

> Source : `CN_docs/SCRIPT_DEFENSE_EXAMEN.md` §ETAPE 7. Voir [00-INDEX.md](00-INDEX.md).

## 7.1 Vérifier la répercussion stock côté ERP + gérer le cycle de vie de la commande

**Action utilisateur :**
1. Retour dans l'application C# WinForms
2. "Fiches & Stock" → Stock réel → vérifier que l'ingrédient consommé côté boutique a bien diminué
3. "Commandes" → `FrmCommandes` liste les commandes reçues depuis la boutique, avec statut/date/montant
4. Ouvrir le détail d'une commande (lignes, adresse livraison, infos client)
5. Changer le statut : Payée → En préparation → Expédiée
6. Retour boutique → "Mes commandes" côté client → le nouveau statut est visible immédiatement

**Use case :** Boucler le circuit complet : une action côté boutique (achat client) doit être immédiatement visible et actionnable côté ERP, sans synchronisation applicative — la source de vérité unique est la base de données partagée.

**Fonctionnalité(s) impliquée(s) :** `Forms/FrmPrincipal.BoutiqueWeb.cs` (onglet "Commandes"), `DAL/CommandeWebDAL.cs`

**Règles métier :**
- Les commandes créées côté Laravel sont visibles instantanément côté C# car elles vivent dans la même table MySQL `commandes_web` — aucune synchronisation applicative, aucun délai
- Cycle de statut piloté uniquement côté ERP : `payee → en_preparation → expediee → livree` (le client ne peut que consulter, jamais changer le statut lui-même)
- Le client voit son statut mis à jour sans action supplémentaire — c'est une simple lecture de la même ligne DB, pas un événement poussé

**Mapping v2 :** Puisque C# et Laravel deviennent un seul monolithe Next.js en v2, cette étape perd sa dimension "deux applications séparées partageant une DB" — mais la règle métier reste : le rôle ERP (`MANAGER`/`VENDEUR`) peut changer le statut, le rôle client (`VIEWER` côté ses propres commandes) ne peut que consulter. Envisager un état `updated_at` + vérification optimiste si des mises à jour concurrentes deviennent possibles (ERP + automatisations) — non nécessaire en v1 mais mentionné comme piste si le multi-tenant introduit plusieurs opérateurs simultanés sur la même commande.

`GET/PATCH /api/v1/commandes/[id]` — voir [14-reference-mapping-v1-v2.md](14-reference-mapping-v1-v2.md) backlog "Gestion commandes ERP" (statut : placeholder, 🟡 P1).

---

## Fin du circuit

Le circuit complet (Login → Infrastructure → Fiches & Stock → Recettes BOM → Production → Publication boutique → Parcours client → Retour ERP) couvre l'intégralité du scénario de démonstration v1 (Bar / Long Island Ice Tea). Pour le détail du schéma DB sous-jacent et des contraintes d'intégrité (normalisation 3NF, ON DELETE RESTRICT/CASCADE, soft delete), voir [11-reference-schema-donnees.md](11-reference-schema-donnees.md).
