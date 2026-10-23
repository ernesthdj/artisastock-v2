# Fondation — ArtisaStock v2

> Résumé d'entrée pour la vue Workflow. Les fondations détaillées restent dans `docs/FONDATION.md` (cadrage initial du 2026-06-07), `docs/FONDATION-POS.md` (2026-07-23) et surtout `docs/FONDATION-HORECA.md` (pivot du 2026-07-24), qui les remplace.

## Vision

ArtisaStock est un logiciel tout-en-un pour restaurateurs et artisans de bouche (ERP + POS + boutique web, RH à terme), centré sur un patron qui veut une vue à 360° de son activité, avec le stock comme source unique de vérité et une discipline anti-fraude. Né pour la chocolaterie-pâtisserie familiale (examen PDSGBD, V1 WinForms), migré en Next.js pour l'examen PID, il deviendra le TFE.

## Stack

Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL (Supabase) · Tailwind + shadcn/ui · Stripe Connect · déployé sur Vercel.

## Principes

- Modules activables et désactivables qui communiquent uniquement par API.
- Méthode en cascade : brainstorm global, puis brainstorm par module (cas d'usage + parcours utilisateur), puis code testé au navigateur au fur et à mesure.
- Multi-tenant strict (tenantId injecté par Prisma) et RBAC par permission.
