# 1. Vue d'ensemble — ArtisaStock v1

> Repris de `docs/V1-FEATURE-AUDIT.md` §1 (généré 2026-07-16). Voir [00-INDEX.md](00-INDEX.md).

## Architecture v1
- **ERP C# WinForms** : application desktop Single-Form Architecture (SFA) — gestion ingrédients, achats, BOM (Bill of Materials — Nomenclature de fabrication), stock, production
- **Boutique Laravel** : site e-commerce B2C (catalogue, panier, checkout Stripe, suivi commande)
- **Base MySQL partagée** : 20 tables + 1 vue + 22 migrations (v04 → v22)

## Domaine métier
Pâtisserie artisanale belge. Concepts clés :
- **Ingrédient** : matière première achetée (chocolat, crème, beurre…)
- **Lot** : achat physique d'un ingrédient (traçabilité AFSCA, FIFO)
- **BOM (Bill of Materials)** : nomenclature de fabrication — recette hiérarchique
- **Activité** : branche métier (ex : "Chocolaterie", "Boulangerie")
- **Contexte** : domaine de production dans une activité (ex : "Pralines Noël")
- **Niveau** : étape de fabrication ordonnée, `ordre` commence à 1 (N1=ingrédients, N2=ganaches, N3=assemblage…) — voir [02-etape1-infrastructure.md](02-etape1-infrastructure.md) pour la règle vérifiée dans le code réel
- **Fiche** : recette à un niveau donné (inputs + quantité output)
- **Production** : exécution d'une fiche (consommation FIFO + création stock)
- **Stock** : quantité disponible (lots ingrédients + produits fabriqués)

## Chiffres clés v1
- 48 fichiers .cs WinForms
- 20 tables + 1 vue SQL
- 22 migrations DB
- 15 DAL (Data Access Layer)
- 80+ routes API Laravel implicites (controllers)
- ~33 fonctionnalités majeures + 30+ règles métier
