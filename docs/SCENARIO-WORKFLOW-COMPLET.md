# Scénario — Workflow Complet (test de bout en bout, toute l'app)

> mentalyas · Full-Stack Dev
> Date : 2026-07-26
> Statut : Script de test — à exécuter au navigateur phase par phase, en cochant et en notant chaque bug/coquille/silence trouvé
> Objectif : parcourir chaque module implémenté dans l'ordre réel d'usage d'un patron artisan, pour détecter les régressions, les coquilles UI et les échecs silencieux (données qui ne se rafraîchissent pas, erreurs avalées, états incohérents) qu'un test module-par-module ne révèle pas toujours.

---

## Comment utiliser ce document

- Chaque phase = un bloc cohérent du parcours business (pas un découpage technique).
- Chaque étape a une **action**, un **résultat attendu**, une case à cocher.
- Après chaque phase, une sous-section **Bugs trouvés** liste ce qui a été corrigé (ou à corriger) — remplie au fur et à mesure de l'exécution, pas à l'avance.
- Comptes de test : `admin@demo-boulangerie.be` / `Demo1234!` (Admin, tenant Boulangerie Dupont). Créer un second compte à permissions réduites en Phase 10 pour vérifier le RBAC.
- Ne pas exécuter les 12 phases d'une seule traite si le budget de tokens est serré — une phase = une unité de travail raisonnable, à committer/pusher séparément si des fixes sont appliqués.

---

## Phase 0 — Connexion & Hub

- [ ] Se connecter avec le compte démo. **Attendu :** redirection vers `/dashboard`, KPIs affichés (commandes du jour, CA jour/mois, alertes stock).
- [ ] Vérifier le widget **Vue Flux** en bas du Hub. **Attendu :** 4 nodes réels (Stocks liés → Activité → POS/Boutique), drag fonctionnel, clic ouvre le panneau, double-clic navigue.
- [ ] Changer d'activité via le sélecteur "Atelier" (si plusieurs activités existent) et vérifier que le Hub se recharge avec les bonnes données.

---

## Phase 1 — Référentiels : Activités & Contextes

- [ ] `Gérer les activités` → créer une nouvelle activité de test (ex. "Traiteur événementiel"). **Attendu :** apparaît dans le sélecteur Atelier.
- [ ] Aller sur `/bom`, créer un nouveau contexte pour cette activité (ex. "Mariage Dupont"). **Attendu :** contexte créé avec niveau N1 verrouillé auto-créé.
- [ ] Vérifier qu'on **ne peut pas** supprimer le niveau N1 (protection structurelle). **Attendu :** action bloquée ou absente de l'UI.
- [ ] Désactiver l'activité de test créée (pas de suppression physique). **Attendu :** disparaît du sélecteur actif, réapparaît si on inclut les inactives.

---

## Phase 2 — Stocks, Fournisseurs, Ingrédients, Achats

- [ ] `/suppliers` → créer un fournisseur de test.
- [ ] `/stocks-liaisons` → créer un nouveau Stock, le lier à l'activité active. **Attendu :** apparaît dans le node "Stocks liés" de la Vue Flux au prochain chargement du Hub.
- [ ] `/ingredients` → créer une fiche ingrédient (nom, unité, prix, seuil d'alerte, stock par défaut = le Stock créé ci-dessus).
- [ ] `/achats` → créer un achat (lot) pour cet ingrédient, quantité > 0. **Attendu :** `Ingredient.stock` (dénormalisé) reflète la quantité du lot ; un vrai `Lot` existe (pas juste le champ dénormalisé — piège connu, voir règle #29 du JOURNAL).
- [ ] `/vue-stock` → vérifier que l'ingrédient apparaît avec la bonne quantité disponible, regroupé par niveau logique.
- [ ] `/mouvements` → vérifier que l'achat apparaît comme mouvement "entrée", filtrable par type.
- [ ] Baisser artificiellement le seuil d'alerte sous le stock actuel (édition ingrédient). **Attendu :** l'ingrédient apparaît dans "Alertes stock" du Hub ET dans le node "Stocks liés" de la Vue Flux (`alerte: true`).

---

## Phase 3 — BOM : niveaux, fiches, production

- [ ] `/bom` → dans le contexte de test, créer un niveau N2 et une fiche BOM N2 consommant l'ingrédient de la Phase 2.
- [ ] Créer un niveau N3 et une fiche BOM N3 référençant la fiche N2 comme sous-fiche (input `type: SHEET`). **Attendu :** l'unité de la ligne reprend automatiquement celle de la sous-fiche (règle #25 JOURNAL).
- [ ] Lancer une production sur la fiche N2 (quantité qui **dépasse volontairement** le stock ingrédient disponible). **Attendu :** blocage clair, aucune écriture partielle.
- [ ] Relancer avec une quantité réalisable. **Attendu :** production réussie, `Ingredient.stock` décrémenté (FIFO), `BomStock` créé pour la fiche N2.
- [ ] Lancer une production sur la fiche N3 (consommant le `BomStock` N2 produit juste avant). **Attendu :** FIFO sur sous-fiche fonctionne (règle #26 JOURNAL — bug historique corrigé, à re-vérifier qu'il ne régresse pas).
- [ ] Retour Hub → vérifier que "Vue Flux" reflète le nouveau nombre de fiches actives pour cette activité.

---

## Phase 4 — Boutique/Produits : TVA, publication, marge

- [ ] `/settings` → section Taux de TVA : créer/vérifier un taux (ex. 6%).
- [ ] `/products` → publier un produit depuis la fiche BOM N3 de la Phase 3 (prix HT, TVA, périssable ou non). **Attendu :** rejeté si la fiche n'a pas de `BomStock` disponible (`NO_STOCK`) ; accepté sinon, `priceTTC` calculé correctement.
- [ ] Vérifier l'indicateur de marge (live, avant sauvegarde) en changeant le prix HT. **Attendu :** couleur/texte cohérent avec `avgUnitCost` de la fiche.
- [ ] Modifier le taux de TVA du produit après publication. **Attendu :** `priceTTC` recalculé, aperçu visible avant sauvegarde.
- [ ] Allouer du stock au canal `VITRINE` (ou `DIRECT`) depuis le panneau d'allocation produit. **Attendu :** `ProductChannelStock` créé/mis à jour, visible dans les deux canaux séparément.
- [ ] Dépublier / republier le produit (visibilité). **Attendu :** toggle fonctionne sans perdre les données.

---

## Phase 5 — Storefront client (canal VITRINE)

- [ ] Ouvrir `/storefront/<tenantSlug>/catalog` dans un nouvel onglet (pas de session admin). **Attendu :** le produit publié en Phase 4 est visible avec son stock `vitrineQtyRemaining` réel.
- [ ] Ajouter au panier, aller sur `/cart` puis `/checkout`. **Attendu :** total TTC cohérent, créneau de retrait sélectionnable (sauf jour fermé).
- [ ] Finaliser la commande (si Stripe configuré en mode test) ou noter le blocage si `STRIPE_NOT_CONFIGURED`.
- [ ] Retour ERP `/orders` → la commande apparaît avec le bon statut, montant, client.
- [ ] Ouvrir la commande (`/orders/[id]`) → changer son statut. **Attendu :** transition cohérente, historique visible.
- [ ] `/invoices` → générer une facture pour cette commande si applicable.

---

## Phase 6 — Boutique web (CMS builder) — vérification rapide

- [ ] `/cms` → ouvrir l'éditeur, vérifier qu'un bloc existant s'édite sans erreur console.
- [ ] Publier les changements (`cms.publish`). **Attendu :** la vitrine `/storefront/<tenantSlug>` reflète le changement après refresh.

---

## Phase 7 — POS : vendeurs, comptoir, historique

- [ ] `/pos/vendeurs` → créer un vendeur de test avec PIN à 4 chiffres. **Attendu :** apparaît actif.
- [ ] `/pos/caisse` → pad numérique par défaut (pas de grille de sélection). Taper le PIN du vendeur de test. **Attendu :** identifié directement, pas de session de caisse ouverte détectée.
- [ ] Ouvrir la caisse (fond d'ouverture) sans redemander le PIN.
- [ ] Composer une vente avec le produit publié en Phase 4 (si stock `DIRECT` alloué) — sinon allouer du stock DIRECT d'abord. **Attendu :** vente finalisée sans redemander le PIN, stock `DIRECT` décrémenté en direct, retour automatique au pad.
- [ ] Tenter une vente avec quantité > stock disponible. **Attendu :** rejet `INSUFFICIENT_STOCK`, aucune écriture partielle.
- [ ] Bouton "Début de service" puis "Fin de service" pour le vendeur de test. **Attendu :** pointage enregistré, visible immédiatement.
- [ ] Fermer la caisse (fond de fermeture). **Attendu :** écart calculé et affiché correctement.
- [ ] `/pos/historique` → vérifier les 3 onglets (Ventes, Caisse, Pointages) reflètent bien tout ce qui précède.

---

## Phase 8 — Devis pâtisserie & Recettes (modules annexes)

- [ ] `/devis` → configurer un gâteau (forme, taille, couches), vérifier le calcul de devis et l'aperçu allergènes.
- [ ] `/recipes` → vérifier que la liste des recettes correspond aux fiches BOM existantes, pas d'erreur de chargement.

---

## Phase 9 — Planning (placeholder connu)

- [ ] `/planning` → confirmer que c'est toujours un placeholder explicite ("module en développement"), pas une page cassée silencieusement.

---

## Phase 10 — Équipe & Permissions (RBAC)

- [ ] `/settings/team` → créer un rôle restreint (ex. sans `pos.manage`, sans `flow.read`) et un utilisateur avec ce rôle.
- [ ] Se connecter avec ce compte restreint. **Attendu :** les entrées de nav gated par permission absente sont invisibles (Vendeurs, Vue Flux widget, etc.), pas juste "grisées" ou accessibles en contournant l'URL directe (revérifier qu'un accès direct par URL à une route gated renvoie bien une erreur d'autorisation côté API, pas juste un menu caché côté client).
- [ ] Accorder `flow.read` à ce rôle depuis l'écran Équipe. **Attendu :** le widget Vue Flux apparaît au rechargement du Hub pour ce compte.

---

## Phase 11 — Paramètres généraux

- [ ] `/settings` → modifier un paramètre général (hors TVA déjà couvert Phase 4), vérifier la persistance après reload.

---

## Bugs trouvés — journal de bord global

> Renseigné au fur et à mesure de l'exécution, une ligne par bug avec la phase concernée. Les détails complets vont dans `docs/JOURNAL.md` comme d'habitude ; ce tableau n'est qu'un index rapide pendant l'exécution du scénario.

| # | Phase | Symptôme | Statut |
|---|-------|----------|--------|
| — | — | — | — |

---

## Prochaines étapes après ce scénario

1. Exécuter phase par phase, committer les fixes au fur et à mesure (pas un seul gros commit en fin de parcours).
2. Toute règle métier découverte à cette occasion (pas déjà dans le JOURNAL) doit y être ajoutée comme règle apprise.
3. Si une phase révèle un module entièrement cassé ou manquant, ouvrir un mini-brainstorm dédié plutôt que de rustiner en place (cohérent avec la méthodologie du projet).
