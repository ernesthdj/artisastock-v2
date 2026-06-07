# Architecture Technique — ArtisaStock V2

> **Auteur :** Agent #2 — Software Architect
> **Date :** 2026-06-07
> **Version :** 1.0.0
> **Stack :** Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind + shadcn/ui

---

## 1. Arborescence du Projet

```
artisastock-v2/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + typecheck + tests
│       └── deploy.yml                # Deploy Vercel
├── prisma/
│   ├── schema.prisma                 # Schema complet
│   ├── migrations/                   # Migrations versionnees
│   └── seed.ts                       # Seed data (templates, roles par defaut)
├── public/
│   ├── locales/
│   │   ├── fr/                       # Traductions FR
│   │   └── nl/                       # Traductions NL
│   └── templates/                    # Assets templates vitrines
├── src/
│   ├── app/
│   │   ├── [locale]/                 # Routes i18n (next-intl)
│   │   │   ├── (auth)/               # Route group auth (pas de layout ERP)
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   ├── forgot-password/page.tsx
│   │   │   │   └── reset-password/page.tsx
│   │   │   ├── (dashboard)/          # Route group ERP (layout backoffice)
│   │   │   │   ├── layout.tsx        # Sidebar + header + tenant context
│   │   │   │   ├── page.tsx          # Dashboard KPI (US-001)
│   │   │   │   ├── ingredients/      # CRUD ingredients (US-002, US-003)
│   │   │   │   ├── recipes/          # Recettes + fiches techniques (US-004, US-005)
│   │   │   │   ├── suppliers/        # Fournisseurs (US-007)
│   │   │   │   ├── products/         # Produits finis (US-008)
│   │   │   │   ├── orders/           # Commandes backoffice (US-010)
│   │   │   │   ├── invoices/         # Facturation (US-009)
│   │   │   │   ├── cms/              # Builder de vitrine
│   │   │   │   │   ├── pages/        # Gestion pages (US-017)
│   │   │   │   │   ├── editor/       # Editeur drag & drop (US-016)
│   │   │   │   │   ├── design/       # Personnalisation (US-014)
│   │   │   │   │   └── templates/    # Choix template (US-013)
│   │   │   │   ├── settings/         # Parametres
│   │   │   │   │   ├── profile/      # Profil artisan (US-032)
│   │   │   │   │   ├── team/         # Employes + RBAC (US-011, US-012)
│   │   │   │   │   ├── stripe/       # Config Stripe (US-023)
│   │   │   │   │   ├── pickup-slots/ # Creneaux retrait (US-022)
│   │   │   │   │   └── domain/       # Sous-domaine (US-033)
│   │   │   │   └── onboarding/       # Wizard (US-031)
│   │   │   └── (storefront)/         # Route group vitrine publique
│   │   │       ├── layout.tsx        # Layout vitrine (template-driven)
│   │   │       ├── page.tsx          # Page d'accueil vitrine
│   │   │       ├── catalog/          # Catalogue (US-018)
│   │   │       ├── product/[slug]/   # Fiche produit (US-019)
│   │   │       ├── cart/             # Panier (US-020)
│   │   │       ├── checkout/         # Commande + Stripe (US-021)
│   │   │       ├── order/[id]/       # Suivi commande (US-038)
│   │   │       ├── [slug]/           # Pages dynamiques CMS
│   │   │       ├── privacy/          # Politique confidentialite
│   │   │       └── terms/            # CGV
│   │   ├── api/
│   │   │   ├── v1/                   # API versionnee
│   │   │   │   ├── auth/             # Endpoints auth
│   │   │   │   ├── ingredients/      # CRUD ingredients
│   │   │   │   ├── recipes/          # CRUD recettes
│   │   │   │   ├── suppliers/        # CRUD fournisseurs
│   │   │   │   ├── products/         # CRUD produits
│   │   │   │   ├── orders/           # Gestion commandes
│   │   │   │   ├── invoices/         # Facturation + PDF
│   │   │   │   ├── cms/              # Pages + blocs + config
│   │   │   │   ├── site-config/      # Config vitrine
│   │   │   │   ├── users/            # Gestion employes
│   │   │   │   ├── roles/            # RBAC
│   │   │   │   ├── tenants/          # Admin tenant
│   │   │   │   ├── pickup-slots/     # Creneaux retrait
│   │   │   │   ├── dashboard/        # KPI aggregations
│   │   │   │   └── upload/           # Upload fichiers
│   │   │   └── webhooks/
│   │   │       └── stripe/           # Webhook Stripe
│   │   ├── sitemap.ts                # Sitemap dynamique
│   │   └── robots.ts                 # robots.txt
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── atoms/                    # Boutons, inputs, badges
│   │   ├── molecules/                # Cards, form fields
│   │   ├── organisms/                # Tables, formulaires complets
│   │   ├── templates/                # Layouts (dashboard, storefront)
│   │   └── cms/                      # Composants blocs CMS
│   │       ├── blocks/               # HeroBlock, TextBlock, GalleryBlock...
│   │       ├── editor/               # DnD editor components
│   │       └── renderer/             # Rendu dynamique des blocs
│   ├── lib/
│   │   ├── prisma.ts                 # Client Prisma singleton
│   │   ├── auth.ts                   # Config NextAuth v5
│   │   ├── stripe.ts                 # Client Stripe + helpers
│   │   ├── email.ts                  # Client Resend + templates
│   │   ├── storage.ts                # Upload abstraction
│   │   ├── pdf.ts                    # Generation PDF factures
│   │   ├── permissions.ts            # RBAC helpers + constants
│   │   ├── costs.ts                  # Algorithme calcul couts cascade
│   │   ├── validators/               # Schemas Zod partages
│   │   │   ├── ingredient.ts
│   │   │   ├── recipe.ts
│   │   │   ├── product.ts
│   │   │   ├── order.ts
│   │   │   ├── invoice.ts
│   │   │   └── common.ts
│   │   ├── utils/
│   │   │   ├── tenant.ts             # Helpers multi-tenant
│   │   │   ├── format.ts             # Formatage prix, dates
│   │   │   ├── slug.ts               # Generation slugs
│   │   │   └── vat.ts                # Calculs TVA belge
│   │   └── constants/
│   │       ├── permissions.ts        # Liste des permissions
│   │       ├── units.ts              # Unites de mesure
│   │       ├── order-status.ts       # Statuts commande
│   │       └── block-types.ts        # Types de blocs CMS
│   ├── hooks/
│   │   ├── use-tenant.ts             # Context tenant courant
│   │   ├── use-permissions.ts        # Verification permissions
│   │   ├── use-cart.ts               # Panier client (localStorage)
│   │   └── use-realtime.ts           # Subscriptions temps reel
│   ├── middleware.ts                 # Middleware Next.js (auth + tenant + i18n)
│   ├── services/                     # Couche metier (Domain Services)
│   │   ├── ingredient.service.ts
│   │   ├── recipe.service.ts
│   │   ├── cost-calculator.service.ts
│   │   ├── product.service.ts
│   │   ├── order.service.ts
│   │   ├── invoice.service.ts
│   │   ├── notification.service.ts
│   │   └── tenant.service.ts
│   ├── types/
│   │   ├── api.ts                    # Types reponses API
│   │   ├── cms.ts                    # Types blocs CMS
│   │   ├── permissions.ts            # Types RBAC
│   │   └── index.ts                  # Re-exports
│   └── i18n/
│       ├── request.ts                # next-intl request config
│       ├── routing.ts                # Routing config (locales)
│       └── messages/
│           ├── fr.json
│           └── nl.json
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   └── lib/
│   ├── integration/
│   │   ├── api/
│   │   └── tenant-isolation.test.ts  # Tests isolation multi-tenant
│   └── e2e/
│       ├── auth.spec.ts
│       ├── order-flow.spec.ts
│       └── cms-editor.spec.ts
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

---

## 2. Schema Prisma Complet

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════

enum Plan {
  FREE_TRIAL
  STARTER
  PRO
  ENTERPRISE
}

enum OrderStatus {
  NEW
  IN_PREPARATION
  READY
  PICKED_UP
  CANCELLED
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  CANCELLED
}

enum VatRate {
  FOOD_6        // 6% alimentaire Belgique
  STANDARD_21   // 21% standard Belgique
}

enum UnitOfMeasure {
  KG
  G
  L
  ML
  PIECE
  DOZEN
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

enum BlockType {
  HERO
  TEXT
  IMAGE
  GALLERY
  PRODUCTS
  CONTACT
  TESTIMONIALS
  MAP
  CUSTOM_HTML
}

enum NotificationType {
  ORDER_NEW
  ORDER_READY
  STOCK_ALERT
  REGISTRATION
  PASSWORD_RESET
  INVOICE_GENERATED
}

enum GdprRequestType {
  ACCESS
  DELETION
}

enum GdprRequestStatus {
  PENDING
  PROCESSED
  REJECTED
}

// ═══════════════════════════════════════════════
// TENANT & AUTH
// ═══════════════════════════════════════════════

model Tenant {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  plan        Plan     @default(FREE_TRIAL)
  locale      String   @default("fr")
  vatNumber   String?  // Format BE0xxx.xxx.xxx
  address     Json?    // { street, number, zip, city, country }
  phone       String?
  email       String?
  description String?
  openingHours Json?   // { monday: { open: "08:00", close: "18:00" }, ... }
  settings    Json     @default("{}")
  trialEndsAt DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  // Relations
  users        User[]
  roles        Role[]
  ingredients  Ingredient[]
  suppliers    Supplier[]
  recipes      Recipe[]
  products     Product[]
  orders       Order[]
  customers    Customer[]
  invoices     Invoice[]
  pages        Page[]
  siteConfig   SiteConfig?
  pickupSlots  PickupSlot[]
  closedDays   ClosedDay[]
  notifications NotificationLog[]
  gdprRequests GdprRequest[]

  @@index([slug])
  @@index([isActive])
}

model User {
  id              String   @id @default(cuid())
  tenantId        String
  email           String
  passwordHash    String
  firstName       String
  lastName        String
  locale          String   @default("fr")
  emailVerified   Boolean  @default(false)
  emailVerifiedAt DateTime?
  isActive        Boolean  @default(true)
  lastLoginAt     DateTime?
  onboardingDone  Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  // Relations
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role       Role?    @relation(fields: [roleId], references: [id])
  roleId     String?
  sessions   Session[]
  invitations UserInvitation[] @relation("InvitedBy")

  @@unique([email, tenantId])
  @@index([tenantId])
  @@index([email])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  refreshToken String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  userAgent    String?
  ipAddress    String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([refreshToken])
}

model UserInvitation {
  id        String   @id @default(cuid())
  tenantId  String
  email     String
  roleId    String?
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  invitedById String
  createdAt DateTime @default(now())

  invitedBy User @relation("InvitedBy", fields: [invitedById], references: [id])

  @@index([token])
  @@index([tenantId])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([token])
}

// ═══════════════════════════════════════════════
// RBAC
// ═══════════════════════════════════════════════

model Role {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  description String?
  permissions Json     // Array de strings : ["ingredients.read", "recipes.write", ...]
  isSystem    Boolean  @default(false) // true = Admin non supprimable
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users  User[]

  @@unique([tenantId, name])
  @@index([tenantId])
}

// ═══════════════════════════════════════════════
// ERP — INGREDIENTS & STOCK
// ═══════════════════════════════════════════════

model Ingredient {
  id             String        @id @default(cuid())
  tenantId       String
  name           String
  category       String?
  unit           UnitOfMeasure
  priceUnit      Decimal       @db.Decimal(10, 4) // Prix par unite de base
  pricePack      Decimal?      @db.Decimal(10, 4) // Prix par conditionnement
  packSize       Decimal?      @db.Decimal(10, 4) // Taille du conditionnement
  stock          Decimal       @default(0) @db.Decimal(10, 4)
  alertThreshold Decimal       @default(0) @db.Decimal(10, 4)
  isAlertActive  Boolean       @default(true)
  supplierId     String?
  supplierRef    String?       // Reference chez le fournisseur
  notes          String?
  isActive       Boolean       @default(true)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?

  // Relations
  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  supplier        Supplier?           @relation(fields: [supplierId], references: [id])
  recipeIngredients RecipeIngredient[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, category])
  @@index([tenantId, isActive])
  @@index([supplierId])
}

// ═══════════════════════════════════════════════
// ERP — FOURNISSEURS
// ═══════════════════════════════════════════════

model Supplier {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  address     Json?    // { street, number, zip, city, country }
  phone       String?
  email       String?
  website     String?
  vatNumber   String?  // Format belge BE0xxx.xxx.xxx
  contactName String?
  notes       String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  // Relations
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ingredients Ingredient[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, isActive])
}

// ═══════════════════════════════════════════════
// ERP — RECETTES & FICHES TECHNIQUES
// ═══════════════════════════════════════════════

model Recipe {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  category        String?
  imageUrl        String?
  servings        Int      @default(1)   // Nombre de portions
  prepTime        Int?                   // Minutes
  cookTime        Int?                   // Minutes
  steps           Json     @default("[]") // Array de { order, instruction }
  costPerServing  Decimal? @db.Decimal(10, 4) // Cache calcule
  totalCost       Decimal? @db.Decimal(10, 4) // Cache calcule
  marginCoeff     Decimal  @default(2.5) @db.Decimal(5, 2) // Coefficient de marge
  vatRate         VatRate  @default(FOOD_6)
  version         Int      @default(1)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  // Relations
  tenant      Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ingredients RecipeIngredient[]
  product     Product?
  versions    RecipeVersion[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, category])
  @@index([tenantId, isActive])
}

model RecipeIngredient {
  id           String  @id @default(cuid())
  recipeId     String
  ingredientId String
  quantity     Decimal @db.Decimal(10, 4)
  unit         UnitOfMeasure

  // Relations
  recipe     Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  ingredient Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Restrict)

  @@unique([recipeId, ingredientId])
  @@index([recipeId])
  @@index([ingredientId])
}

model RecipeVersion {
  id             String   @id @default(cuid())
  recipeId       String
  version        Int
  name           String
  ingredients    Json     // Snapshot : [{ ingredientId, name, quantity, unit, priceAtTime }]
  steps          Json
  servings       Int
  totalCost      Decimal? @db.Decimal(10, 4)
  costPerServing Decimal? @db.Decimal(10, 4)
  createdAt      DateTime @default(now())
  createdById    String?

  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([recipeId, version])
  @@index([recipeId])
}

// ═══════════════════════════════════════════════
// ERP — PRODUITS FINIS
// ═══════════════════════════════════════════════

model Product {
  id              String   @id @default(cuid())
  tenantId        String
  recipeId        String?  @unique
  name            String
  slug            String
  description     String?
  descriptionLong String?
  category        String?
  images          Json     @default("[]") // Array de URLs
  priceHT         Decimal  @db.Decimal(10, 2)
  priceTTC        Decimal  @db.Decimal(10, 2)
  vatRate         VatRate  @default(FOOD_6)
  allergens       Json     @default("[]") // Array de strings
  isVisible       Boolean  @default(true)
  isClickCollect  Boolean  @default(true)
  stockType       String   @default("unlimited") // "unlimited" | "daily" | "limited"
  stockQuantity   Int?
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  // Relations
  tenant     Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  recipe     Recipe?     @relation(fields: [recipeId], references: [id])
  orderItems OrderItem[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([tenantId, category])
  @@index([tenantId, isVisible, isActive])
}

// ═══════════════════════════════════════════════
// ERP — COMMANDES
// ═══════════════════════════════════════════════

model Customer {
  id        String   @id @default(cuid())
  tenantId  String
  email     String
  firstName String
  lastName  String
  phone     String?
  locale    String   @default("fr")
  gdprConsent Boolean @default(false)
  gdprConsentAt DateTime?
  isAnonymized Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  tenant Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  orders Order[]

  @@unique([tenantId, email])
  @@index([tenantId])
}

model Order {
  id              String      @id @default(cuid())
  tenantId        String
  orderNumber     String      // Format : CMD-YYYY-XXXX
  customerId      String
  status          OrderStatus @default(NEW)
  totalHT         Decimal     @db.Decimal(10, 2)
  totalTVA        Decimal     @db.Decimal(10, 2)
  totalTTC        Decimal     @db.Decimal(10, 2)
  pickupSlotStart DateTime
  pickupSlotEnd   DateTime
  pickupDate      DateTime
  stripeSessionId String?
  stripePaymentId String?
  paidAt          DateTime?
  trackingToken   String      @unique @default(cuid()) // UUID pour suivi public
  notes           String?
  statusHistory   Json        @default("[]") // [{ status, timestamp, userId? }]
  cgvAcceptedAt   DateTime
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // Relations
  tenant   Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer Customer    @relation(fields: [customerId], references: [id])
  items    OrderItem[]
  invoice  Invoice?

  @@unique([tenantId, orderNumber])
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@index([customerId])
  @@index([trackingToken])
  @@index([stripeSessionId])
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  productId String
  quantity  Int
  unitPrice Decimal @db.Decimal(10, 2)
  vatRate   VatRate
  totalHT   Decimal @db.Decimal(10, 2)
  totalTTC  Decimal @db.Decimal(10, 2)

  // Relations
  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([orderId])
  @@index([productId])
}

// ═══════════════════════════════════════════════
// ERP — FACTURATION
// ═══════════════════════════════════════════════

model Invoice {
  id              String        @id @default(cuid())
  tenantId        String
  orderId         String        @unique
  invoiceNumber   String        // Format : FACT-YYYY-XXXX
  status          InvoiceStatus @default(ISSUED)
  issuedAt        DateTime      @default(now())
  dueAt           DateTime?
  // Vendeur (snapshot au moment de l'emission)
  sellerName      String
  sellerAddress   Json
  sellerVat       String
  // Acheteur
  buyerName       String
  buyerEmail      String
  buyerAddress    Json?
  // Montants
  totalHT         Decimal       @db.Decimal(10, 2)
  totalTVA        Decimal       @db.Decimal(10, 2)
  totalTTC        Decimal       @db.Decimal(10, 2)
  vatBreakdown    Json          // [{ rate: "6%", base, amount }]
  // Lignes
  lines           Json          // [{ description, quantity, unitPriceHT, vatRate, totalHT, totalTTC }]
  // PDF
  pdfUrl          String?
  pdfGeneratedAt  DateTime?
  // Meta
  notes           String?
  paymentTerms    String?       @default("Payee par carte bancaire")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order  Order  @relation(fields: [orderId], references: [id])

  @@unique([tenantId, invoiceNumber])
  @@index([tenantId])
  @@index([tenantId, issuedAt])
  @@index([tenantId, status])
}

// ═══════════════════════════════════════════════
// ERP — CRENEAUX DE RETRAIT
// ═══════════════════════════════════════════════

model PickupSlot {
  id             String    @id @default(cuid())
  tenantId       String
  dayOfWeek      DayOfWeek
  startTime      String    // Format "HH:mm"
  endTime        String    // Format "HH:mm"
  slotDuration   Int       @default(30)  // Minutes
  maxOrders      Int       @default(5)   // Par creneau
  minAdvanceHours Int      @default(24)  // Heures minimum avant commande
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, dayOfWeek, isActive])
}

model ClosedDay {
  id       String   @id @default(cuid())
  tenantId String
  date     DateTime @db.Date
  reason   String?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, date])
  @@index([tenantId])
}

// ═══════════════════════════════════════════════
// CMS — PAGES & BLOCS
// ═══════════════════════════════════════════════

model Page {
  id              String   @id @default(cuid())
  tenantId        String
  title           String
  slug            String
  metaDescription String?
  ogImage         String?
  blocks          Json     @default("[]") // Array de Block objects
  sortOrder       Int      @default(0)
  isVisible       Boolean  @default(true)
  isSystem        Boolean  @default(false) // Pages non supprimables (accueil, contact)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([tenantId, isVisible])
}

model SiteConfig {
  id            String   @id @default(cuid())
  tenantId      String   @unique
  template      String   @default("boulangerie") // boulangerie | patisserie | traiteur
  logo          String?
  favicon       String?
  colors        Json     @default("{}") // { primary, secondary, accent, background, text }
  fonts         Json     @default("{}") // { heading, body }
  socialLinks   Json     @default("{}") // { facebook, instagram, ... }
  customCss     String?
  isPublished   Boolean  @default(false)
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

// ═══════════════════════════════════════════════
// NOTIFICATIONS & LOGS
// ═══════════════════════════════════════════════

model NotificationLog {
  id          String           @id @default(cuid())
  tenantId    String
  type        NotificationType
  recipientEmail String
  subject     String
  status      String           @default("sent") // sent | failed | bounced
  metadata    Json?
  sentAt      DateTime         @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, type])
  @@index([sentAt])
}

model CookieConsent {
  id          String   @id @default(cuid())
  tenantId    String
  sessionId   String
  necessary   Boolean  @default(true)
  analytics   Boolean  @default(false)
  marketing   Boolean  @default(false)
  ipAddress   String?
  userAgent   String?
  consentedAt DateTime @default(now())
  expiresAt   DateTime

  @@index([tenantId])
  @@index([sessionId])
}

model GdprRequest {
  id          String            @id @default(cuid())
  tenantId    String
  customerId  String?
  email       String
  type        GdprRequestType
  status      GdprRequestStatus @default(PENDING)
  processedAt DateTime?
  processedBy String?
  notes       String?
  createdAt   DateTime          @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, status])
}

// ═══════════════════════════════════════════════
// AUDIT LOG (transversal)
// ═══════════════════════════════════════════════

model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String?
  action    String   // "create" | "update" | "delete" | "login" | ...
  entity    String   // "ingredient" | "recipe" | "order" | ...
  entityId  String?
  changes   Json?    // { before, after }
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, entity])
  @@index([tenantId, userId])
  @@index([createdAt])
}
```

---

## 3. Patterns Architecturaux

### 3.1 Multi-Tenant (Schema Partage + Middleware Prisma)

**Strategie :** Single database, shared schema, `tenantId` sur chaque table metier.

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Extension Prisma pour injection automatique du tenantId
export function getPrismaWithTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        // Models sans tenantId (Session, PasswordResetToken, AuditLog global)
        const GLOBAL_MODELS = ['Session', 'PasswordResetToken'];
        if (GLOBAL_MODELS.includes(model ?? '')) return query(args);

        // Injection automatique sur les reads
        if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(operation)) {
          args.where = { ...args.where, tenantId };
        }
        // Injection automatique sur les creates
        if (['create', 'createMany'].includes(operation)) {
          if (operation === 'create') {
            args.data = { ...args.data, tenantId };
          }
        }
        // Injection automatique sur updates/deletes
        if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
    },
  });
}
```

**Middleware Next.js** extrait le `tenantId` depuis la session utilisateur :

```typescript
// src/middleware.ts (simplifie)
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['fr', 'nl'],
  defaultLocale: 'fr',
});

export async function middleware(request: NextRequest) {
  // 1. i18n routing
  const intlResponse = intlMiddleware(request);

  // 2. Auth check pour routes protegees
  if (request.nextUrl.pathname.startsWith('/api/v1/') ||
      request.nextUrl.pathname.includes('(dashboard)')) {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    // Inject tenantId dans les headers pour les Route Handlers
    const response = intlResponse ?? NextResponse.next();
    response.headers.set('x-tenant-id', token.tenantId as string);
    response.headers.set('x-user-id', token.userId as string);
    response.headers.set('x-user-role', token.role as string);
    return response;
  }

  return intlResponse ?? NextResponse.next();
}
```

### 3.2 RBAC Dynamique (Permissions JSON)

**Structure des permissions :** Namespace par module + action.

```typescript
// src/lib/constants/permissions.ts
export const PERMISSIONS = {
  // Module Ingredients
  'ingredients.read': 'Voir les ingredients',
  'ingredients.write': 'Creer/modifier des ingredients',
  'ingredients.delete': 'Supprimer des ingredients',
  // Module Recipes
  'recipes.read': 'Voir les recettes',
  'recipes.write': 'Creer/modifier des recettes',
  'recipes.delete': 'Supprimer des recettes',
  // Module Products
  'products.read': 'Voir les produits',
  'products.write': 'Creer/modifier des produits',
  'products.delete': 'Supprimer des produits',
  // Module Orders
  'orders.read': 'Voir les commandes',
  'orders.manage': 'Changer le statut des commandes',
  // Module Invoices
  'invoices.read': 'Voir les factures',
  'invoices.generate': 'Generer des factures',
  // Module CMS
  'cms.read': 'Voir le builder vitrine',
  'cms.write': 'Modifier la vitrine',
  'cms.publish': 'Publier les changements',
  // Module Team
  'team.read': 'Voir les employes',
  'team.manage': 'Gerer les employes et roles',
  // Module Settings
  'settings.read': 'Voir les parametres',
  'settings.write': 'Modifier les parametres',
} as const;

export type Permission = keyof typeof PERMISSIONS;
```

**Verification dans les Route Handlers :**

```typescript
// src/lib/permissions.ts
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import type { Permission } from './constants/permissions';

export async function checkPermission(
  request: NextRequest,
  required: Permission | Permission[]
): Promise<{ authorized: boolean; userId: string; tenantId: string }> {
  const tenantId = request.headers.get('x-tenant-id')!;
  const userId = request.headers.get('x-user-id')!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || user.tenantId !== tenantId || !user.isActive) {
    return { authorized: false, userId, tenantId };
  }

  // Admin systeme = toutes les permissions
  if (user.role?.isSystem) {
    return { authorized: true, userId, tenantId };
  }

  const permissions = (user.role?.permissions as string[]) ?? [];
  const requiredPerms = Array.isArray(required) ? required : [required];
  const authorized = requiredPerms.every(p => permissions.includes(p));

  return { authorized, userId, tenantId };
}
```

### 3.3 Bloc-Based CMS (Structure JSON)

**Schema des blocs :**

```typescript
// src/types/cms.ts
export interface BlockBase {
  id: string;          // UUID unique par bloc
  type: BlockType;
  order: number;
  visible: boolean;
}

export interface HeroBlock extends BlockBase {
  type: 'HERO';
  config: {
    title: string;
    subtitle?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaLink?: string;
    overlay?: boolean;
    overlayOpacity?: number;
  };
}

export interface TextBlock extends BlockBase {
  type: 'TEXT';
  config: {
    content: string;     // HTML sanitise
    alignment?: 'left' | 'center' | 'right';
  };
}

export interface ProductsBlock extends BlockBase {
  type: 'PRODUCTS';
  config: {
    title?: string;
    category?: string;   // Filtrer par categorie, null = tous
    limit?: number;
    layout: 'grid' | 'carousel';
    columns?: 2 | 3 | 4;
  };
}

export interface GalleryBlock extends BlockBase {
  type: 'GALLERY';
  config: {
    images: Array<{ url: string; alt: string; caption?: string }>;
    layout: 'grid' | 'masonry' | 'carousel';
    columns?: 2 | 3 | 4;
  };
}

export interface ContactBlock extends BlockBase {
  type: 'CONTACT';
  config: {
    showMap: boolean;
    showForm: boolean;
    showHours: boolean;
    showPhone: boolean;
    showEmail: boolean;
    mapCoordinates?: { lat: number; lng: number };
  };
}

export type Block = HeroBlock | TextBlock | ProductsBlock | GalleryBlock | ContactBlock;
// ... (autres types de blocs)
```

**Rendu dynamique vitrine :**

```typescript
// src/components/cms/renderer/BlockRenderer.tsx
import { Block } from '@/types/cms';
import { HeroRenderer } from './HeroRenderer';
import { TextRenderer } from './TextRenderer';
import { ProductsRenderer } from './ProductsRenderer';
import { GalleryRenderer } from './GalleryRenderer';
import { ContactRenderer } from './ContactRenderer';

const BLOCK_COMPONENTS: Record<string, React.FC<{ block: Block }>> = {
  HERO: HeroRenderer,
  TEXT: TextRenderer,
  PRODUCTS: ProductsRenderer,
  GALLERY: GalleryRenderer,
  CONTACT: ContactRenderer,
};

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks
        .filter(b => b.visible)
        .sort((a, b) => a.order - b.order)
        .map(block => {
          const Component = BLOCK_COMPONENTS[block.type];
          if (!Component) return null;
          return <Component key={block.id} block={block} />;
        })}
    </>
  );
}
```

### 3.4 Calcul de Cout en Cascade (Event-Driven)

**Pattern :** Quand un prix ingredient change, on recalcule toutes les recettes affectees, puis les produits lies.

```typescript
// src/services/cost-calculator.service.ts
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export class CostCalculatorService {
  /**
   * Recalcule le cout d'une recette a partir de ses ingredients actuels.
   */
  static async recalculateRecipeCost(recipeId: string, tenantId: string) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe || recipe.tenantId !== tenantId) return;

    let totalCost = new Decimal(0);
    for (const ri of recipe.ingredients) {
      const ingredientCost = ri.ingredient.priceUnit.mul(ri.quantity);
      totalCost = totalCost.add(ingredientCost);
    }

    const costPerServing = recipe.servings > 0
      ? totalCost.div(recipe.servings)
      : totalCost;

    await prisma.recipe.update({
      where: { id: recipeId },
      data: { totalCost, costPerServing },
    });

    // Si un produit est lie a cette recette, mettre a jour son prix suggere
    await this.propagateToProduct(recipeId, tenantId);
  }

  /**
   * Quand un ingredient change de prix, recalculer TOUTES les recettes l'utilisant.
   */
  static async onIngredientPriceChange(ingredientId: string, tenantId: string) {
    const affectedRecipes = await prisma.recipeIngredient.findMany({
      where: { ingredientId },
      select: { recipeId: true },
    });

    // Recalcul en parallele (batch)
    await Promise.all(
      affectedRecipes.map(ri => this.recalculateRecipeCost(ri.recipeId, tenantId))
    );
  }

  private static async propagateToProduct(recipeId: string, tenantId: string) {
    const product = await prisma.product.findUnique({
      where: { recipeId },
    });
    if (!product || product.tenantId !== tenantId) return;

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe?.costPerServing) return;

    // Prix HT = cout * marge
    const suggestedPriceHT = recipe.costPerServing.mul(recipe.marginCoeff);
    const vatMultiplier = product.vatRate === 'FOOD_6' ? 1.06 : 1.21;
    const suggestedPriceTTC = suggestedPriceHT.mul(vatMultiplier);

    // NB : on ne force pas le prix — on log l'ecart pour alerte
    // Le prix reel est modifie manuellement par l'artisan
  }
}
```

### 3.5 ISR pour la Vitrine

**Strategie :** Les pages de la vitrine utilisent ISR (Incremental Static Regeneration) avec revalidation on-demand quand l'artisan publie des modifications.

```typescript
// src/app/[locale]/(storefront)/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BlockRenderer } from '@/components/cms/renderer/BlockRenderer';

// Revalidation toutes les 60 secondes en fallback
export const revalidate = 60;

export async function generateStaticParams() {
  // Pre-generer les pages des tenants actifs
  const pages = await prisma.page.findMany({
    where: { isVisible: true, deletedAt: null, tenant: { isActive: true } },
    select: { slug: true, tenant: { select: { slug: true } } },
  });
  return pages.map(p => ({ slug: p.slug }));
}

// Revalidation on-demand depuis le backoffice :
// POST /api/v1/cms/publish → revalidatePath(`/${tenantSlug}/${pageSlug}`)
```

### 3.6 Structure Modulaire (Plugin-Ready)

Pour ajouter un nouveau module (ex: "fidelite") sans modifier le core :

```
src/
├── modules/
│   └── loyalty/                    # Nouveau module
│       ├── loyalty.service.ts      # Logique metier
│       ├── loyalty.validator.ts    # Schemas Zod
│       ├── loyalty.permissions.ts  # Permissions du module
│       ├── api/                    # Route handlers
│       │   └── route.ts
│       └── components/             # UI specifique
```

**Enregistrement :** Ajouter les permissions dans `src/lib/constants/permissions.ts` et les routes dans `src/app/api/v1/loyalty/`.

---

## 4. Middleware Stack

L'ordre de traitement des requetes :

```
Request
  │
  ├── 1. Rate Limiter (upstash/ratelimit)
  │     └── Limite par IP : 100 req/min API, 5 req/min login
  │
  ├── 2. Security Headers (next.config.ts)
  │     └── CSP, HSTS, X-Frame-Options, X-Content-Type-Options
  │
  ├── 3. i18n Middleware (next-intl)
  │     └── Detecte locale → prefix /fr/ ou /nl/
  │
  ├── 4. Auth Middleware (NextAuth JWT)
  │     └── Verifie token → extrait userId, tenantId, role
  │     └── 401 si token absent/expire sur routes protegees
  │
  ├── 5. Tenant Context (headers injection)
  │     └── x-tenant-id, x-user-id injectes dans headers
  │
  ├── 6. RBAC Check (dans chaque Route Handler)
  │     └── checkPermission(req, 'module.action')
  │     └── 403 si permission absente
  │
  ├── 7. Input Validation (Zod)
  │     └── Schema validation sur body/query
  │     └── 400 + details si invalide
  │
  └── 8. Handler (logique metier)
        └── Utilise getPrismaWithTenant(tenantId)
        └── Response format uniforme
```

**Format de reponse API uniforme :**

```typescript
// src/types/api.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}
```

---

## 5. Diagramme d'Architecture (Mermaid)

```mermaid
graph TB
    subgraph "Client"
        Browser[Navigateur]
        Mobile[Mobile PWA]
    end

    subgraph "CDN / Edge"
        Vercel[Vercel Edge Network]
        ISR_Cache[ISR Cache<br/>Pages Vitrine]
    end

    subgraph "Next.js 15 (App Router)"
        Middleware[Middleware Stack<br/>i18n → Auth → Tenant → RBAC]

        subgraph "Frontend SSR/CSR"
            Dashboard[ERP Dashboard<br/>React + shadcn/ui]
            CMS_Editor[CMS Editor<br/>dnd-kit + React]
            Storefront[Vitrine Publique<br/>SSR/ISR]
        end

        subgraph "API Layer (/api/v1/)"
            Auth_API[Auth Routes]
            ERP_API[ERP Routes<br/>CRUD + Business Logic]
            CMS_API[CMS Routes<br/>Pages + Config]
            Webhook_API[Webhook Handler<br/>Stripe Events]
        end

        subgraph "Services Layer"
            CostCalc[Cost Calculator<br/>Event-driven cascade]
            InvoiceGen[Invoice Generator<br/>@react-pdf/renderer]
            NotifService[Notification Service]
        end
    end

    subgraph "External Services"
        Stripe[Stripe<br/>Checkout + Connect + Webhooks]
        Resend[Resend<br/>Emails Transactionnels]
        Sentry[Sentry<br/>Error Monitoring]
    end

    subgraph "Data Layer"
        Supabase_DB[(PostgreSQL<br/>Supabase)]
        Supabase_Storage[Supabase Storage<br/>Images + PDFs]
        Prisma[Prisma ORM<br/>+ Tenant Extension]
    end

    Browser --> Vercel
    Mobile --> Vercel
    Vercel --> ISR_Cache
    ISR_Cache --> Storefront
    Vercel --> Middleware
    Middleware --> Dashboard
    Middleware --> CMS_Editor
    Middleware --> Storefront
    Middleware --> Auth_API
    Middleware --> ERP_API
    Middleware --> CMS_API
    Webhook_API --> Stripe

    ERP_API --> CostCalc
    ERP_API --> InvoiceGen
    ERP_API --> NotifService
    CMS_API --> NotifService

    Auth_API --> Prisma
    ERP_API --> Prisma
    CMS_API --> Prisma
    CostCalc --> Prisma
    InvoiceGen --> Prisma

    Prisma --> Supabase_DB
    InvoiceGen --> Supabase_Storage
    Dashboard --> Supabase_Storage
    CMS_Editor --> Supabase_Storage

    NotifService --> Resend
    Stripe --> Webhook_API
    Middleware --> Sentry
```

---

## 6. Decisions Techniques Cles

### 6.1 Pourquoi pas de microservices ?

- **Complexite operationnelle** : un seul deploiement Vercel suffit pour un SaaS PME.
- **Latence** : communication inter-services inutile a cette echelle.
- **Cout** : infrastructure minimale, pas de Kubernetes.
- **Evolution** : la structure modulaire permet d'extraire un service si necessaire ulterieurement.

### 6.2 Server Actions vs Route Handlers

| Use Case | Approche |
|----------|----------|
| Formulaires simples (CRUD) | Server Actions (mutations directes) |
| Operations complexes (checkout, factures) | Route Handlers (API RESTful) |
| Appels depuis des clients externes | Route Handlers uniquement |
| Revalidation cache | Server Actions + `revalidatePath()` |

### 6.3 Strategie de Cache

| Donnee | Strategie | TTL |
|--------|-----------|-----|
| Pages vitrine | ISR | 60s + revalidation on-demand |
| Dashboard KPI | SWR client-side | 30s stale, 5min cache |
| Liste ingredients | React Query | 60s stale |
| Config site | ISR | Revalidation on-demand |
| Catalogue produits | ISR | 60s + revalidation on-demand |

### 6.4 Securite — Implementation

```typescript
// next.config.ts (headers securite)
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co https://*.sentry.io",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
    ].join('; '),
  },
];
```

### 6.5 i18n — Structure next-intl

```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'nl'],
  defaultLocale: 'fr',
  localePrefix: 'always', // /fr/... et /nl/...
});
```

**Messages par module :**

```
public/locales/
├── fr/
│   ├── common.json        # Labels generiques (boutons, navigation)
│   ├── auth.json          # Login, register, reset
│   ├── dashboard.json     # KPI, widgets
│   ├── ingredients.json   # Module ingredients
│   ├── recipes.json       # Module recettes
│   ├── products.json      # Module produits
│   ├── orders.json        # Module commandes
│   ├── invoices.json      # Module facturation
│   ├── cms.json           # Module CMS/editor
│   ├── settings.json      # Parametres
│   └── storefront.json    # Vitrine publique
└── nl/
    └── ... (meme structure)
```

---

## 7. Configuration Environnement

```bash
# .env.example
# === Database ===
DATABASE_URL="postgresql://user:pass@host:5432/artisastock?schema=public"

# === NextAuth ===
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# === Stripe ===
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# === Supabase Storage ===
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."
SUPABASE_STORAGE_BUCKET="artisastock"

# === Email (Resend) ===
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@artisastock.be"

# === Sentry ===
SENTRY_DSN="https://xxx@sentry.io/yyy"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/yyy"

# === App ===
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_STOREFRONT_DOMAIN="artisastock.be"
```

---

## 8. Conventions et Regles pour les Developpeurs

### Nommage

| Element | Convention | Exemple |
|---------|-----------|---------|
| Fichiers components | PascalCase | `IngredientCard.tsx` |
| Fichiers utils/lib | camelCase | `costCalculator.ts` |
| Variables/fonctions | camelCase | `calculateTotalCost()` |
| Types/Interfaces | PascalCase | `RecipeIngredient` |
| Constantes | SCREAMING_SNAKE | `MAX_FILE_SIZE` |
| Routes API | kebab-case | `/api/v1/pickup-slots` |
| DB columns | camelCase (Prisma) | `createdAt`, `tenantId` |

### Imports

Ordre obligatoire :
1. Modules externes (`next`, `react`, librairies)
2. Alias internes (`@/lib`, `@/components`, `@/services`)
3. Types (imports `type`)
4. Styles

### Tests

- **Unit** : services et lib (Vitest)
- **Integration** : API routes avec DB de test (Vitest + Prisma)
- **E2E** : parcours critiques (Playwright)
- **Isolation tenant** : tests dedies verifiant qu'un tenant A ne voit pas les donnees du tenant B

---

> **Document genere par Agent #2 — Software Architect**
> Prochaine etape : transmission aux Agents #4 (Backend) et #5 (Frontend) pour implementation.
