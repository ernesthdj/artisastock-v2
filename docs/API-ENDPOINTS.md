# API Endpoints — ArtisaStock V2

> **Auteur :** Agent #2 — Software Architect
> **Date :** 2026-06-07
> **Version :** 1.0.0
> **Base URL :** `/api/v1`

---

## Conventions Generales

### Format de reponse

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ 'name' est requis.",
    "details": [{ "field": "name", "message": "Required" }]
  }
}
```

### Codes d'erreur

| Code HTTP | Usage |
|-----------|-------|
| `200` | Succes (GET, PUT, PATCH) |
| `201` | Creation reussie (POST) |
| `204` | Suppression reussie (DELETE) |
| `400` | Validation echouee |
| `401` | Non authentifie |
| `403` | Permission insuffisante |
| `404` | Ressource introuvable |
| `409` | Conflit (doublon, contrainte unique) |
| `429` | Rate limit depasse |
| `500` | Erreur serveur |

### Pagination

Tous les endpoints de liste supportent :

| Parametre | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Numero de page |
| `pageSize` | number | 20 | Elements par page (max 100) |
| `sortBy` | string | `createdAt` | Champ de tri |
| `sortOrder` | string | `desc` | `asc` ou `desc` |

### Filtrage

Les endpoints de liste supportent des filtres via query params :
- `search` : recherche textuelle (nom, description)
- `category` : filtre par categorie
- `isActive` : filtre par statut actif (`true`/`false`)
- `dateFrom` / `dateTo` : filtre par plage de dates

### Authentification

Toutes les routes `/api/v1/*` (sauf `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`) requierent un token JWT valide dans le header :

```
Authorization: Bearer <token>
```

Le `tenantId` est extrait automatiquement du token JWT. **Aucune donnee cross-tenant n'est accessible.**

---

## AUTH — Authentification

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `POST` | `/auth/register` | Inscription artisan | Non | - |
| `POST` | `/auth/login` | Connexion | Non | - |
| `POST` | `/auth/logout` | Deconnexion (revoke refresh) | Oui | - |
| `POST` | `/auth/refresh` | Renouveler le token | Non (refresh token cookie) | - |
| `POST` | `/auth/forgot-password` | Demande reset password | Non | - |
| `POST` | `/auth/reset-password` | Reinitialiser le mot de passe | Non (token URL) | - |
| `POST` | `/auth/verify-email` | Verifier l'email (token) | Non (token URL) | - |
| `GET` | `/auth/me` | Profil utilisateur courant | Oui | - |
| `PATCH` | `/auth/me` | Modifier son profil | Oui | - |
| `PATCH` | `/auth/me/password` | Changer son mot de passe | Oui | - |

### Details

**POST `/auth/register`**
```json
{
  "businessName": "Ma Boulangerie",
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@boulangerie.be",
  "password": "SecureP@ss123",
  "locale": "fr"
}
```
- Rate limit : 3 req/heure/IP
- Cree un Tenant + User (role Admin) + SiteConfig par defaut
- Envoie email de verification

**POST `/auth/login`**
```json
{
  "email": "jean@boulangerie.be",
  "password": "SecureP@ss123",
  "rememberMe": false
}
```
- Rate limit : 5 tentatives/15min/email
- Retourne : `{ token, refreshToken, user, tenant }`
- `rememberMe: true` → refresh token 30 jours (sinon 7 jours)

---

## INGREDIENTS — Gestion du stock

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/ingredients` | Liste des ingredients | Oui | `ingredients.read` |
| `GET` | `/ingredients/:id` | Detail d'un ingredient | Oui | `ingredients.read` |
| `POST` | `/ingredients` | Creer un ingredient | Oui | `ingredients.write` |
| `PATCH` | `/ingredients/:id` | Modifier un ingredient | Oui | `ingredients.write` |
| `DELETE` | `/ingredients/:id` | Soft delete ingredient | Oui | `ingredients.delete` |
| `GET` | `/ingredients/alerts` | Ingredients sous seuil d'alerte | Oui | `ingredients.read` |
| `PATCH` | `/ingredients/:id/stock` | Mettre a jour le stock | Oui | `ingredients.write` |

### Filtres specifiques

| Parametre | Type | Description |
|-----------|------|-------------|
| `category` | string | Filtrer par categorie |
| `alertOnly` | boolean | Uniquement les ingredients en alerte |
| `supplierId` | string | Filtrer par fournisseur |
| `search` | string | Recherche par nom (debounce cote client) |

### Body POST/PATCH

```json
{
  "name": "Farine T65",
  "category": "Farines",
  "unit": "KG",
  "priceUnit": 1.20,
  "pricePack": 15.00,
  "packSize": 25,
  "stock": 100,
  "alertThreshold": 20,
  "supplierId": "cuid_supplier",
  "supplierRef": "FAR-T65-25",
  "notes": "Fournisseur principal : Grands Moulins"
}
```

---

## RECIPES — Recettes et fiches techniques

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/recipes` | Liste des recettes | Oui | `recipes.read` |
| `GET` | `/recipes/:id` | Detail d'une recette (avec ingredients) | Oui | `recipes.read` |
| `POST` | `/recipes` | Creer une recette | Oui | `recipes.write` |
| `PATCH` | `/recipes/:id` | Modifier une recette | Oui | `recipes.write` |
| `DELETE` | `/recipes/:id` | Soft delete recette | Oui | `recipes.delete` |
| `POST` | `/recipes/:id/duplicate` | Dupliquer une recette | Oui | `recipes.write` |
| `GET` | `/recipes/:id/versions` | Historique des versions | Oui | `recipes.read` |
| `POST` | `/recipes/:id/versions/:version/restore` | Restaurer une version | Oui | `recipes.write` |
| `GET` | `/recipes/:id/cost` | Detail du calcul de cout | Oui | `recipes.read` |
| `POST` | `/recipes/:id/recalculate` | Forcer recalcul du cout | Oui | `recipes.write` |
| `GET` | `/recipes/:id/pdf` | Telecharger fiche technique PDF | Oui | `recipes.read` |

### Body POST/PATCH

```json
{
  "name": "Pain au levain",
  "description": "Pain rustique au levain naturel",
  "category": "Pains",
  "servings": 8,
  "prepTime": 30,
  "cookTime": 45,
  "marginCoeff": 2.5,
  "vatRate": "FOOD_6",
  "ingredients": [
    { "ingredientId": "cuid_xxx", "quantity": 0.5, "unit": "KG" },
    { "ingredientId": "cuid_yyy", "quantity": 0.01, "unit": "KG" }
  ],
  "steps": [
    { "order": 1, "instruction": "Melanger farine et eau..." },
    { "order": 2, "instruction": "Laisser reposer 12h..." }
  ]
}
```

---

## SUPPLIERS — Fournisseurs

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/suppliers` | Liste des fournisseurs | Oui | `ingredients.read` |
| `GET` | `/suppliers/:id` | Detail d'un fournisseur | Oui | `ingredients.read` |
| `POST` | `/suppliers` | Creer un fournisseur | Oui | `ingredients.write` |
| `PATCH` | `/suppliers/:id` | Modifier un fournisseur | Oui | `ingredients.write` |
| `DELETE` | `/suppliers/:id` | Soft delete fournisseur | Oui | `ingredients.delete` |
| `GET` | `/suppliers/:id/ingredients` | Ingredients de ce fournisseur | Oui | `ingredients.read` |

### Body POST/PATCH

```json
{
  "name": "Grands Moulins de Paris",
  "address": {
    "street": "Rue de la Farine",
    "number": "12",
    "zip": "1000",
    "city": "Bruxelles",
    "country": "BE"
  },
  "phone": "+32 2 123 45 67",
  "email": "contact@grandsmoulins.be",
  "website": "https://grandsmoulins.be",
  "vatNumber": "BE0123456789",
  "contactName": "Marie Martin",
  "notes": "Livraison le mardi"
}
```

---

## PRODUCTS — Produits finis

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/products` | Liste des produits | Oui | `products.read` |
| `GET` | `/products/:id` | Detail d'un produit | Oui | `products.read` |
| `POST` | `/products` | Creer un produit | Oui | `products.write` |
| `PATCH` | `/products/:id` | Modifier un produit | Oui | `products.write` |
| `DELETE` | `/products/:id` | Soft delete produit | Oui | `products.delete` |
| `PATCH` | `/products/:id/visibility` | Toggle visibilite vitrine | Oui | `products.write` |
| `PATCH` | `/products/reorder` | Reordonner les produits | Oui | `products.write` |

### Endpoint public (vitrine)

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/storefront/:tenantSlug/products` | Catalogue public | Non | - |
| `GET` | `/storefront/:tenantSlug/products/:slug` | Fiche produit publique | Non | - |

### Body POST/PATCH

```json
{
  "recipeId": "cuid_recipe",
  "name": "Pain au levain",
  "slug": "pain-au-levain",
  "description": "Notre pain signature",
  "descriptionLong": "Elabore avec un levain naturel cultive depuis 3 ans...",
  "category": "Pains",
  "priceHT": 3.30,
  "vatRate": "FOOD_6",
  "allergens": ["gluten", "sesame"],
  "isVisible": true,
  "isClickCollect": true,
  "stockType": "daily",
  "stockQuantity": 20
}
```

---

## ORDERS — Commandes

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/orders` | Liste des commandes (backoffice) | Oui | `orders.read` |
| `GET` | `/orders/:id` | Detail d'une commande | Oui | `orders.read` |
| `PATCH` | `/orders/:id/status` | Changer le statut | Oui | `orders.manage` |
| `GET` | `/orders/today` | Commandes du jour | Oui | `orders.read` |
| `GET` | `/orders/stats` | Statistiques commandes (KPI) | Oui | `orders.read` |

### Endpoints publics (vitrine — checkout)

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `POST` | `/storefront/:tenantSlug/checkout` | Creer une commande + session Stripe | Non | - |
| `GET` | `/storefront/:tenantSlug/order/:trackingToken` | Suivi commande (public) | Non | - |

### Filtres specifiques (backoffice)

| Parametre | Type | Description |
|-----------|------|-------------|
| `status` | OrderStatus | Filtrer par statut |
| `dateFrom` | ISO date | Date de debut |
| `dateTo` | ISO date | Date de fin |
| `customerId` | string | Filtrer par client |

### Body PATCH status

```json
{
  "status": "IN_PREPARATION"
}
```
- Statuts valides : `NEW` → `IN_PREPARATION` → `READY` → `PICKED_UP`
- `CANCELLED` accessible depuis n'importe quel statut
- Le passage a `READY` declenche un email au client

### Body POST checkout

```json
{
  "customer": {
    "firstName": "Alice",
    "lastName": "Martin",
    "email": "alice@email.be",
    "phone": "+32 476 12 34 56"
  },
  "items": [
    { "productId": "cuid_product_1", "quantity": 2 },
    { "productId": "cuid_product_2", "quantity": 1 }
  ],
  "pickupSlot": {
    "date": "2026-06-10",
    "startTime": "10:00",
    "endTime": "10:30"
  },
  "locale": "fr",
  "cgvAccepted": true
}
```
- Retourne : `{ stripeCheckoutUrl: "https://checkout.stripe.com/..." }`
- Verifie la disponibilite des produits et du creneau
- Verifie que le creneau n'est pas plein
- Cree une commande en statut `NEW` uniquement apres succes Stripe (via webhook)

---

## INVOICES — Facturation

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/invoices` | Liste des factures | Oui | `invoices.read` |
| `GET` | `/invoices/:id` | Detail d'une facture | Oui | `invoices.read` |
| `POST` | `/invoices/generate/:orderId` | Generer facture pour une commande | Oui | `invoices.generate` |
| `GET` | `/invoices/:id/pdf` | Telecharger le PDF | Oui | `invoices.read` |
| `POST` | `/invoices/:id/credit-note` | Generer une note de credit | Oui | `invoices.generate` |

### Filtres specifiques

| Parametre | Type | Description |
|-----------|------|-------------|
| `status` | InvoiceStatus | Filtrer par statut |
| `dateFrom` | ISO date | Date d'emission debut |
| `dateTo` | ISO date | Date d'emission fin |
| `minAmount` | number | Montant TTC minimum |
| `maxAmount` | number | Montant TTC maximum |

### Reponse detail facture

```json
{
  "success": true,
  "data": {
    "id": "cuid_invoice",
    "invoiceNumber": "FACT-2026-0001",
    "status": "ISSUED",
    "issuedAt": "2026-06-07T14:30:00Z",
    "seller": {
      "name": "Boulangerie Dupont",
      "address": { "street": "Rue du Pain", "number": "1", "zip": "1000", "city": "Bruxelles" },
      "vatNumber": "BE0123456789"
    },
    "buyer": {
      "name": "Alice Martin",
      "email": "alice@email.be"
    },
    "lines": [
      {
        "description": "Pain au levain",
        "quantity": 2,
        "unitPriceHT": 3.30,
        "vatRate": "6%",
        "totalHT": 6.60,
        "totalTTC": 7.00
      }
    ],
    "totalHT": 6.60,
    "totalTVA": 0.40,
    "totalTTC": 7.00,
    "vatBreakdown": [
      { "rate": "6%", "base": 6.60, "amount": 0.40 }
    ],
    "pdfUrl": "https://storage.supabase.co/.../FACT-2026-0001.pdf"
  }
}
```

---

## CMS — Pages et Blocs

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/cms/pages` | Liste des pages | Oui | `cms.read` |
| `GET` | `/cms/pages/:id` | Detail d'une page (avec blocs) | Oui | `cms.read` |
| `POST` | `/cms/pages` | Creer une page | Oui | `cms.write` |
| `PATCH` | `/cms/pages/:id` | Modifier une page | Oui | `cms.write` |
| `DELETE` | `/cms/pages/:id` | Soft delete page | Oui | `cms.write` |
| `PATCH` | `/cms/pages/:id/blocks` | Mettre a jour les blocs (drag & drop) | Oui | `cms.write` |
| `PATCH` | `/cms/pages/reorder` | Reordonner les pages (menu) | Oui | `cms.write` |
| `POST` | `/cms/publish` | Publier toutes les modifications | Oui | `cms.publish` |

### Body PATCH blocks

```json
{
  "blocks": [
    {
      "id": "block_uuid_1",
      "type": "HERO",
      "order": 0,
      "visible": true,
      "config": {
        "title": "Bienvenue chez nous",
        "subtitle": "Boulangerie artisanale depuis 1985",
        "backgroundImage": "https://storage.../hero.jpg",
        "ctaText": "Voir nos produits",
        "ctaLink": "/catalog"
      }
    },
    {
      "id": "block_uuid_2",
      "type": "PRODUCTS",
      "order": 1,
      "visible": true,
      "config": {
        "title": "Nos specialites",
        "layout": "grid",
        "columns": 3,
        "limit": 6
      }
    }
  ]
}
```

---

## SITE-CONFIG — Configuration vitrine

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/site-config` | Configuration actuelle | Oui | `cms.read` |
| `PATCH` | `/site-config` | Modifier la configuration | Oui | `cms.write` |
| `POST` | `/site-config/template` | Changer de template | Oui | `cms.write` |
| `GET` | `/site-config/templates` | Liste des templates disponibles | Oui | `cms.read` |
| `POST` | `/site-config/publish` | Publier les changements | Oui | `cms.publish` |

### Endpoint public

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/storefront/:tenantSlug/config` | Config vitrine publique | Non | - |

### Body PATCH

```json
{
  "logo": "https://storage.../logo.png",
  "favicon": "https://storage.../favicon.ico",
  "colors": {
    "primary": "#8B4513",
    "secondary": "#DEB887",
    "accent": "#D2691E",
    "background": "#FFF8F0",
    "text": "#2D1810"
  },
  "fonts": {
    "heading": "Playfair Display",
    "body": "Inter"
  },
  "socialLinks": {
    "facebook": "https://facebook.com/maboulangerie",
    "instagram": "https://instagram.com/maboulangerie"
  }
}
```

---

## USERS — Gestion des employes

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/users` | Liste des utilisateurs du tenant | Oui | `team.read` |
| `GET` | `/users/:id` | Detail d'un utilisateur | Oui | `team.read` |
| `POST` | `/users/invite` | Inviter un employe | Oui | `team.manage` |
| `PATCH` | `/users/:id` | Modifier un utilisateur (role, statut) | Oui | `team.manage` |
| `PATCH` | `/users/:id/deactivate` | Desactiver un employe | Oui | `team.manage` |
| `PATCH` | `/users/:id/reactivate` | Reactiver un employe | Oui | `team.manage` |
| `POST` | `/users/accept-invite/:token` | Accepter une invitation | Non | - |

### Body POST invite

```json
{
  "email": "employe@email.be",
  "roleId": "cuid_role"
}
```
- Envoie un email d'invitation avec lien d'inscription
- Le lien expire apres 7 jours

---

## ROLES — RBAC

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/roles` | Liste des roles du tenant | Oui | `team.read` |
| `GET` | `/roles/:id` | Detail d'un role (avec permissions) | Oui | `team.read` |
| `POST` | `/roles` | Creer un role | Oui | `team.manage` |
| `PATCH` | `/roles/:id` | Modifier un role (permissions) | Oui | `team.manage` |
| `DELETE` | `/roles/:id` | Supprimer un role | Oui | `team.manage` |
| `GET` | `/roles/permissions` | Liste de toutes les permissions disponibles | Oui | `team.read` |

### Body POST/PATCH

```json
{
  "name": "Chef production",
  "description": "Acces recettes et stock",
  "permissions": [
    "ingredients.read",
    "ingredients.write",
    "recipes.read",
    "recipes.write",
    "orders.read"
  ]
}
```

- Le role systeme `Admin` ne peut etre ni modifie ni supprime
- Un role ne peut pas etre supprime s'il est assigne a des utilisateurs actifs

---

## TENANTS — Administration tenant

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/tenants/current` | Info du tenant courant | Oui | `settings.read` |
| `PATCH` | `/tenants/current` | Modifier les infos du tenant | Oui | `settings.write` |
| `PATCH` | `/tenants/current/locale` | Changer la langue par defaut | Oui | `settings.write` |
| `GET` | `/tenants/current/onboarding` | Etat de l'onboarding | Oui | - |
| `PATCH` | `/tenants/current/onboarding` | Mettre a jour l'onboarding | Oui | - |

### Body PATCH tenant

```json
{
  "name": "Boulangerie Dupont",
  "slug": "boulangerie-dupont",
  "vatNumber": "BE0123456789",
  "address": {
    "street": "Rue du Pain",
    "number": "42",
    "zip": "1000",
    "city": "Bruxelles",
    "country": "BE"
  },
  "phone": "+32 2 123 45 67",
  "email": "contact@boulangerie-dupont.be",
  "description": "Boulangerie artisanale depuis 1985",
  "openingHours": {
    "monday": { "open": "07:00", "close": "18:00" },
    "tuesday": { "open": "07:00", "close": "18:00" },
    "wednesday": null,
    "thursday": { "open": "07:00", "close": "18:00" },
    "friday": { "open": "07:00", "close": "18:00" },
    "saturday": { "open": "07:00", "close": "13:00" },
    "sunday": { "open": "08:00", "close": "12:00" }
  }
}
```

---

## PICKUP-SLOTS — Creneaux de retrait

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/pickup-slots` | Liste des creneaux configures | Oui | `settings.read` |
| `POST` | `/pickup-slots` | Creer un creneau recurrent | Oui | `settings.write` |
| `PATCH` | `/pickup-slots/:id` | Modifier un creneau | Oui | `settings.write` |
| `DELETE` | `/pickup-slots/:id` | Supprimer un creneau | Oui | `settings.write` |
| `GET` | `/pickup-slots/closed-days` | Jours fermes | Oui | `settings.read` |
| `POST` | `/pickup-slots/closed-days` | Ajouter un jour ferme | Oui | `settings.write` |
| `DELETE` | `/pickup-slots/closed-days/:id` | Supprimer un jour ferme | Oui | `settings.write` |

### Endpoint public

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/storefront/:tenantSlug/pickup-slots/available` | Creneaux disponibles pour commande | Non | - |

### Query params (available)

| Parametre | Type | Description |
|-----------|------|-------------|
| `date` | ISO date | Date souhaitee |
| `days` | number | Nombre de jours a afficher (default 7, max 14) |

### Body POST creneau

```json
{
  "dayOfWeek": "MONDAY",
  "startTime": "08:00",
  "endTime": "12:00",
  "slotDuration": 30,
  "maxOrders": 5,
  "minAdvanceHours": 24
}
```

---

## DASHBOARD — KPI et Statistiques

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/dashboard/kpi` | KPI principaux | Oui | - |
| `GET` | `/dashboard/revenue` | CA par periode | Oui | - |
| `GET` | `/dashboard/recent-orders` | 5 dernieres commandes | Oui | `orders.read` |
| `GET` | `/dashboard/stock-alerts` | Nombre d'alertes stock | Oui | `ingredients.read` |

### Reponse KPI

```json
{
  "success": true,
  "data": {
    "ordersToday": 12,
    "revenueToday": 342.50,
    "revenueMonth": 8750.00,
    "stockAlerts": 3,
    "recentOrders": [
      {
        "id": "cuid",
        "orderNumber": "CMD-2026-0042",
        "customerName": "Alice Martin",
        "total": 28.50,
        "status": "NEW",
        "createdAt": "2026-06-07T09:15:00Z"
      }
    ]
  }
}
```

---

## UPLOAD — Gestion des fichiers

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `POST` | `/upload/image` | Upload une image (produit, hero, galerie) | Oui | `cms.write` ou `products.write` |
| `POST` | `/upload/logo` | Upload un logo | Oui | `settings.write` |
| `DELETE` | `/upload/:fileId` | Supprimer un fichier | Oui | Owner |

### Contraintes upload

| Type | Formats | Taille max | Dimensions recommandees |
|------|---------|------------|------------------------|
| Logo | PNG, SVG, JPEG | 2 Mo | 500x500px |
| Image produit | JPEG, PNG, WebP | 5 Mo | 800x800px |
| Hero image | JPEG, PNG, WebP | 5 Mo | 1920x1080px |
| Galerie | JPEG, PNG, WebP | 5 Mo | 1200x800px |

- Les images sont automatiquement redimensionnees et optimisees (WebP)
- Stockage : Supabase Storage, namespace `{tenantId}/images/`
- L'URL retournee est signee (expiration longue pour les assets publics)

---

## WEBHOOKS — Stripe

### Endpoint

```
POST /api/webhooks/stripe
```

- **Pas d'authentification JWT** — verification par signature Stripe
- Header requis : `stripe-signature`
- Secret de verification : `STRIPE_WEBHOOK_SECRET`

### Evenements traites

| Evenement Stripe | Action |
|-----------------|--------|
| `checkout.session.completed` | Creer la commande, envoyer email confirmation client + notification artisan |
| `payment_intent.succeeded` | Mettre a jour le statut de paiement |
| `payment_intent.payment_failed` | Logger l'echec, ne pas creer la commande |
| `account.updated` (Connect) | Mettre a jour l'etat de connexion Stripe du tenant |

### Idempotence

- Chaque evenement est traite une seule fois (deduplication par `event.id` stocke en base)
- Retry automatique par Stripe en cas de 5xx (jusqu'a 3 tentatives)

### Securite

```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  // Traitement de l'evenement...
}
```

---

## STRIPE CONNECT — Configuration artisan

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `POST` | `/stripe/connect` | Generer un lien Stripe Connect onboarding | Oui | `settings.write` |
| `GET` | `/stripe/status` | Statut de la connexion Stripe | Oui | `settings.read` |
| `POST` | `/stripe/disconnect` | Deconnecter le compte Stripe | Oui | `settings.write` |

### Flow Stripe Connect

1. `POST /stripe/connect` → retourne `{ url: "https://connect.stripe.com/..." }`
2. L'artisan complete l'onboarding Stripe
3. Redirect vers `/settings/stripe?success=true`
4. Le webhook `account.updated` met a jour l'etat en base

---

## GDPR — Demandes RGPD

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/gdpr/requests` | Liste des demandes RGPD | Oui | `settings.read` |
| `POST` | `/gdpr/requests/:id/process` | Traiter une demande (export ou suppression) | Oui | `settings.write` |
| `GET` | `/gdpr/requests/:id/export` | Telecharger l'export des donnees client | Oui | `settings.read` |

### Endpoint public

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `POST` | `/storefront/:tenantSlug/gdpr/request` | Soumettre une demande d'acces/suppression | Non | - |

### Body POST request

```json
{
  "email": "client@email.be",
  "type": "ACCESS",
  "message": "Je souhaite recevoir une copie de mes donnees personnelles."
}
```

---

## NOTIFICATIONS — Configuration

| Methode | Endpoint | Description | Auth | Permission |
|---------|----------|-------------|------|------------|
| `GET` | `/notifications/settings` | Preferences de notifications | Oui | `settings.read` |
| `PATCH` | `/notifications/settings` | Modifier les preferences | Oui | `settings.write` |
| `GET` | `/notifications/log` | Historique des envois | Oui | `settings.read` |

### Body PATCH settings

```json
{
  "stockAlertEmail": true,
  "newOrderEmail": true,
  "orderReadyAutoEmail": true
}
```

---

## Rate Limiting

| Route | Limite |
|-------|--------|
| `POST /auth/login` | 5 req / 15 min / email |
| `POST /auth/register` | 3 req / heure / IP |
| `POST /auth/forgot-password` | 3 req / heure / email |
| `POST /storefront/*/checkout` | 10 req / min / IP |
| `POST /api/webhooks/stripe` | Illimite (verification par signature) |
| Routes API generales | 100 req / min / user |
| Routes publiques (storefront) | 200 req / min / IP |

---

## Storefront — Resume des endpoints publics

Tous les endpoints prefixes par `/storefront/:tenantSlug/` sont **publics** (pas d'auth JWT).
Le `tenantSlug` identifie le commerce.

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/storefront/:slug/config` | Configuration visuelle de la vitrine |
| `GET` | `/storefront/:slug/pages` | Liste des pages publiques |
| `GET` | `/storefront/:slug/pages/:pageSlug` | Contenu d'une page (blocs) |
| `GET` | `/storefront/:slug/products` | Catalogue produits |
| `GET` | `/storefront/:slug/products/:productSlug` | Fiche produit |
| `GET` | `/storefront/:slug/pickup-slots/available` | Creneaux disponibles |
| `POST` | `/storefront/:slug/checkout` | Creer commande + paiement |
| `GET` | `/storefront/:slug/order/:trackingToken` | Suivi commande |
| `POST` | `/storefront/:slug/gdpr/request` | Demande RGPD |
| `POST` | `/storefront/:slug/cookie-consent` | Enregistrer consentement cookies |

---

> **Document genere par Agent #2 — Software Architect**
> Prochaine etape : transmission aux Agents #4 (Backend) et #5 (Frontend) pour implementation.
