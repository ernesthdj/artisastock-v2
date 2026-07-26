// prisma/seed.ts — ArtisaStock V2
import { PrismaClient, Plan, UnitOfMeasure, DayOfWeek, BomInputType, StockChannel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Tenant demo ───────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-boulangerie' },
    update: {},
    create: {
      name: 'Boulangerie Dupont',
      slug: 'demo-boulangerie',
      plan: Plan.FREE_TRIAL,
      locale: 'fr',
      vatNumber: 'BE0123456789',
      address: {
        street: 'Rue du Pain',
        number: '42',
        zip: '1000',
        city: 'Bruxelles',
        country: 'BE',
      },
      phone: '+32 2 123 45 67',
      email: 'contact@boulangerie-dupont.be',
      description: 'Boulangerie artisanale depuis 1985',
      openingHours: {
        monday: { open: '07:00', close: '18:00' },
        tuesday: { open: '07:00', close: '18:00' },
        wednesday: null,
        thursday: { open: '07:00', close: '18:00' },
        friday: { open: '07:00', close: '18:00' },
        saturday: { open: '07:00', close: '13:00' },
        sunday: { open: '08:00', close: '12:00' },
      },
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ─── Roles système ─────────────────────────────────────────────────────────
  const ALL_PERMISSIONS = [
    'ingredients.read', 'ingredients.write', 'ingredients.delete',
    'recipes.read', 'recipes.write', 'recipes.delete',
    'products.read', 'products.write', 'products.delete', 'products.allocate', 'products.close',
    'orders.read', 'orders.manage',
    'invoices.read', 'invoices.generate',
    'cms.read', 'cms.write', 'cms.publish',
    'team.read', 'team.manage',
    'settings.read', 'settings.write',
    'bom.read', 'bom.write', 'bom.produce',
    'activites.read', 'activites.write',
    'stocks.read', 'stocks.write',
    'achats.read', 'achats.write',
    'tenant-vat-rates.read', 'tenant-vat-rates.write',
    'pos.sell', 'pos.read', 'pos.manage',
    'flow.read',
  ];

  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
    update: { permissions: ALL_PERMISSIONS },
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      description: 'Accès complet à toutes les fonctionnalités',
      permissions: ALL_PERMISSIONS,
      isSystem: true,
    },
  });

  await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Chef Production' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Chef Production',
      description: 'Accès recettes, stock et commandes',
      permissions: [
        'ingredients.read', 'ingredients.write',
        'recipes.read', 'recipes.write',
        'products.read',
        'orders.read',
      ],
      isSystem: false,
    },
  });

  await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Vendeur' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Vendeur',
      description: 'Accès commandes et produits uniquement',
      permissions: ['products.read', 'orders.read', 'orders.manage'],
      isSystem: false,
    },
  });

  // ─── Utilisateur admin demo ─────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  await prisma.user.upsert({
    where: {
      email_tenantId: { email: 'admin@demo-boulangerie.be', tenantId: tenant.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo-boulangerie.be',
      passwordHash,
      firstName: 'Jean',
      lastName: 'Dupont',
      locale: 'fr',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
      onboardingDone: true,
      roleId: adminRole.id,
    },
  });

  // ─── Fournisseurs ───────────────────────────────────────────────────────────
  const supplierGrandsMoulins = await prisma.supplier.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Grands Moulins de Paris' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Grands Moulins de Paris',
      address: { street: 'Rue de la Farine', number: '12', zip: '1000', city: 'Bruxelles', country: 'BE' },
      phone: '+32 2 999 88 77',
      email: 'contact@grandsmoulins.be',
      vatNumber: 'BE0987654321',
      contactName: 'Marie Martin',
      notes: 'Livraison le mardi matin',
    },
  });

  const supplierSucres = await prisma.supplier.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Sucres & Épices SPRL' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sucres & Épices SPRL',
      address: { street: 'Avenue du Sucre', number: '5', zip: '4000', city: 'Liège', country: 'BE' },
      phone: '+32 4 111 22 33',
      email: 'info@sucresetepices.be',
      contactName: 'Pierre Leclerc',
    },
  });

  // ─── Stock physique (emplacement) ──────────────────────────────────────────
  // Requis par Lot.stockId — sans ça aucun lot ne peut être créé, et
  // checkAvailability (BOM) se retrouve à comparer un Ingredient.stock fictif
  // à zéro lot réel au moment de consumeFIFO (voir docs/JOURNAL.md).
  const stockPrincipal = await prisma.stock.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Réserve principale' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Réserve principale',
      description: 'Entrepôt de stockage des matières premières',
    },
  });

  // ─── Ingrédients ───────────────────────────────────────────────────────────
  const ingredients = await Promise.all([
    prisma.ingredient.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Farine T65' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Farine T65',
        category: 'Farines',
        unit: UnitOfMeasure.KG,
        priceUnit: 1.20,
        pricePack: 15.00,
        packSize: 25,
        stock: 150,
        alertThreshold: 25,
        defaultStockId: stockPrincipal.id,
        supplierId: supplierGrandsMoulins.id,
        supplierRef: 'FAR-T65-25KG',
        notes: 'Sac 25kg, stocker au sec',
      },
    }),
    prisma.ingredient.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Sucre blanc' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Sucre blanc',
        category: 'Sucres',
        unit: UnitOfMeasure.KG,
        priceUnit: 0.85,
        pricePack: 17.00,
        packSize: 25,
        stock: 80,
        alertThreshold: 10,
        defaultStockId: stockPrincipal.id,
        supplierId: supplierSucres.id,
        supplierRef: 'SUC-BLANC-25',
      },
    }),
    prisma.ingredient.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Beurre 82% MG' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Beurre 82% MG',
        category: 'Produits laitiers',
        unit: UnitOfMeasure.KG,
        priceUnit: 6.50,
        pricePack: 130.00,
        packSize: 25,
        stock: 15,
        alertThreshold: 5,
        defaultStockId: stockPrincipal.id,
        notes: 'Réfrigération 0-4°C',
      },
    }),
    prisma.ingredient.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Oeufs frais (calibre M)' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Oeufs frais (calibre M)',
        category: 'Produits laitiers',
        unit: UnitOfMeasure.PIECE,
        priceUnit: 0.22,
        pricePack: 26.40,
        packSize: 120,
        stock: 360,
        alertThreshold: 60,
        defaultStockId: stockPrincipal.id,
        notes: 'Boites de 120, réfrigération',
      },
    }),
    prisma.ingredient.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Levure boulangère fraîche' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Levure boulangère fraîche',
        category: 'Levains & Levures',
        unit: UnitOfMeasure.G,
        priceUnit: 0.018,
        stock: 2000,
        alertThreshold: 500,
        defaultStockId: stockPrincipal.id,
        notes: 'Conservation réfrigérée, max 3 semaines',
      },
    }),
    prisma.ingredient.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Sel fin' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Sel fin',
        category: 'Condiments',
        unit: UnitOfMeasure.KG,
        priceUnit: 0.30,
        stock: 10,
        alertThreshold: 2,
        defaultStockId: stockPrincipal.id,
      },
    }),
  ]);

  const [farine, sucre, beurre, oeufs, levure, sel] = ingredients;

  // ─── Lots (achats) — stock de départ réellement traçable ──────────────────
  // Un Lot par ingrédient pour justifier son Ingredient.stock (voir Stock
  // physique ci-dessus) : sans lot réel, consumeFIFO (production BOM) trouve
  // zéro stock disponible même quand Ingredient.stock affiche un chiffre.
  const purchaseDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  await Promise.all(
    [
      { ingredient: farine, supplierId: supplierGrandsMoulins.id },
      { ingredient: sucre, supplierId: supplierSucres.id },
      { ingredient: beurre, supplierId: undefined },
      { ingredient: oeufs, supplierId: undefined },
      { ingredient: levure, supplierId: undefined },
      { ingredient: sel, supplierId: undefined },
    ].map(({ ingredient, supplierId }) => {
      const qty = Number(ingredient.stock);
      const totalPriceHT = Math.round(qty * Number(ingredient.priceUnit) * 100) / 100;
      return prisma.lot.create({
        data: {
          tenantId: tenant.id,
          ingredientId: ingredient.id,
          stockId: stockPrincipal.id,
          supplierId,
          purchaseDate,
          quantityInitial: qty,
          quantityAvailable: qty,
          unitPrice: totalPriceHT,
          totalPriceHT,
        },
      });
    })
  );

  // ─── Bibliothèque de taux TVA (TenantVatRate) ──────────────────────────────
  // Remplace l'ancien enum VatRate figé (FOOD_6/STANDARD_21) pour les Product.
  const vatFood = await prisma.tenantVatRate.upsert({
    where: { tenantId_label: { tenantId: tenant.id, label: 'TVA réduite alimentaire' } },
    update: {},
    create: { tenantId: tenant.id, label: 'TVA réduite alimentaire', ratePercent: 6, isActive: true },
  });

  await prisma.tenantVatRate.upsert({
    where: { tenantId_label: { tenantId: tenant.id, label: 'TVA standard' } },
    update: {},
    create: { tenantId: tenant.id, label: 'TVA standard', ratePercent: 21, isActive: true },
  });

  // ─── Activité + hiérarchie BOM (remplace les anciennes Recipe) ─────────────
  // Le module Boutique/Produits publie depuis une BomSheet ayant du BomStock
  // disponible — voir docs/modules/BOUTIQUE-PRODUITS.md — pas depuis Recipe.
  const activite = await prisma.activite.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Boulangerie' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Boulangerie',
      description: 'Activité de production principale',
    },
  });

  await prisma.activiteStock.upsert({
    where: { activiteId_stockId: { activiteId: activite.id, stockId: stockPrincipal.id } },
    update: {},
    create: { activiteId: activite.id, stockId: stockPrincipal.id },
  });

  const bomContext = await prisma.bomContext.upsert({
    where: { activiteId_name: { activiteId: activite.id, name: 'Production' } },
    update: {},
    create: {
      tenantId: tenant.id,
      activiteId: activite.id,
      name: 'Production',
      levels: {
        create: [{ order: 1, name: 'Ingrédients' }],
      },
    },
    include: { levels: true },
  });

  const n2 = await prisma.bomLevel.upsert({
    where: { contextId_order: { contextId: bomContext.id, order: 2 } },
    update: {},
    create: { contextId: bomContext.id, order: 2, name: 'Produits finis' },
  });

  const sheetPain = await prisma.bomSheet.upsert({
    where: { levelId_name: { levelId: n2.id, name: 'Pain de campagne' } },
    update: {},
    create: {
      levelId: n2.id,
      name: 'Pain de campagne',
      description: 'Pain rustique à la croûte dorée, mie aérée',
      outputUnit: UnitOfMeasure.PIECE,
      outputQty: 1,
      prepTime: 55,
      lines: {
        create: [
          { inputType: BomInputType.INGREDIENT, ingredientId: farine.id, quantity: 0.5, unit: UnitOfMeasure.KG },
          { inputType: BomInputType.INGREDIENT, ingredientId: levure.id, quantity: 8, unit: UnitOfMeasure.G },
          { inputType: BomInputType.INGREDIENT, ingredientId: sel.id, quantity: 0.01, unit: UnitOfMeasure.KG },
        ],
      },
    },
  });

  const sheetCroissant = await prisma.bomSheet.upsert({
    where: { levelId_name: { levelId: n2.id, name: 'Croissant pur beurre' } },
    update: {},
    create: {
      levelId: n2.id,
      name: 'Croissant pur beurre',
      description: 'Croissant feuilleté au beurre AOC, dorure brillante',
      outputUnit: UnitOfMeasure.PIECE,
      outputQty: 12,
      prepTime: 108,
      lines: {
        create: [
          { inputType: BomInputType.INGREDIENT, ingredientId: farine.id, quantity: 0.5, unit: UnitOfMeasure.KG },
          { inputType: BomInputType.INGREDIENT, ingredientId: beurre.id, quantity: 0.3, unit: UnitOfMeasure.KG },
          { inputType: BomInputType.INGREDIENT, ingredientId: sucre.id, quantity: 0.05, unit: UnitOfMeasure.KG },
          { inputType: BomInputType.INGREDIENT, ingredientId: sel.id, quantity: 0.01, unit: UnitOfMeasure.KG },
          { inputType: BomInputType.INGREDIENT, ingredientId: levure.id, quantity: 20, unit: UnitOfMeasure.G },
          { inputType: BomInputType.INGREDIENT, ingredientId: oeufs.id, quantity: 2, unit: UnitOfMeasure.PIECE },
        ],
      },
    },
  });

  // ─── Production du jour + BomStock (lot disponible) ────────────────────────
  // Créés directement (pas de replay FIFO réel des Lot ingrédients) — même
  // logique de raccourci que le stock Ingredient ci-dessus, seed = démo, pas
  // un test de la logique de production elle-même.
  const productionPain = await prisma.bomProduction.create({
    data: {
      tenantId: tenant.id,
      levelId: n2.id,
      sheetId: sheetPain.id,
      nBatches: 40,
      outputQty: 40,
      ingredientsCost: 24.8,
      unitCost: 0.62,
      notes: 'Fournée du matin — démo seed',
    },
  });

  const bomStockPain = await prisma.bomStock.create({
    data: {
      tenantId: tenant.id,
      sheetId: sheetPain.id,
      productionId: productionPain.id,
      qtyAvailable: 40,
      unitCost: 0.62,
      producedAt: new Date(),
      dlcDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const productionCroissant = await prisma.bomProduction.create({
    data: {
      tenantId: tenant.id,
      levelId: n2.id,
      sheetId: sheetCroissant.id,
      nBatches: 4,
      outputQty: 50,
      ingredientsCost: 16,
      unitCost: 0.32,
      notes: 'Fournée du matin — démo seed',
    },
  });

  const bomStockCroissant = await prisma.bomStock.create({
    data: {
      tenantId: tenant.id,
      sheetId: sheetCroissant.id,
      productionId: productionCroissant.id,
      qtyAvailable: 50,
      unitCost: 0.32,
      producedAt: new Date(),
      dlcDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // ─── Produits finis (publiés depuis une BomSheet, jamais depuis Recipe) ────
  const productPain = await prisma.product.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'pain-de-campagne' } },
    update: {},
    create: {
      tenantId: tenant.id,
      bomSheetId: sheetPain.id,
      name: 'Pain de campagne',
      slug: 'pain-de-campagne',
      description: 'Notre pain signature, cuit sur pierre chaque matin',
      descriptionLong: 'Élaboré avec une farine T65 sélectionnée, ce pain de campagne incarne le savoir-faire artisanal de notre boulangerie. Croûte dorée et craquante, mie aérée et légèrement acidulée.',
      category: 'Pains',
      priceHT: 2.83,
      priceTTC: 3.0,
      vatRateId: vatFood.id,
      marginTargetFactor: 2.5,
      isPerishable: true,
      allergens: ['gluten'],
      isVisible: true,
      isClickCollect: true,
      sortOrder: 1,
    },
  });

  const productCroissant = await prisma.product.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'croissant-pur-beurre' } },
    update: {},
    create: {
      tenantId: tenant.id,
      bomSheetId: sheetCroissant.id,
      name: 'Croissant pur beurre',
      slug: 'croissant-pur-beurre',
      description: 'Feuilleté au beurre AOC Charentes-Poitou, dorure brillante',
      category: 'Viennoiseries',
      priceHT: 1.42,
      priceTTC: 1.5,
      vatRateId: vatFood.id,
      marginTargetFactor: 3.0,
      isPerishable: true,
      allergens: ['gluten', 'lait', 'oeufs'],
      isVisible: true,
      isClickCollect: true,
      sortOrder: 2,
    },
  });

  // ─── Allocation de stock par canal (UC3 — Vitrine vs Direct/POS) ───────────
  const channelAllocations = [
    { productId: productPain.id, bomStockId: bomStockPain.id, channel: StockChannel.VITRINE, qty: 10 },
    { productId: productPain.id, bomStockId: bomStockPain.id, channel: StockChannel.DIRECT, qty: 30 },
    { productId: productCroissant.id, bomStockId: bomStockCroissant.id, channel: StockChannel.VITRINE, qty: 15 },
    { productId: productCroissant.id, bomStockId: bomStockCroissant.id, channel: StockChannel.DIRECT, qty: 35 },
  ];

  for (const alloc of channelAllocations) {
    const existing = await prisma.productChannelStock.findFirst({
      where: { productId: alloc.productId, bomStockId: alloc.bomStockId, channel: alloc.channel },
    });
    if (!existing) {
      await prisma.productChannelStock.create({
        data: {
          tenantId: tenant.id,
          productId: alloc.productId,
          bomStockId: alloc.bomStockId,
          channel: alloc.channel,
          qtyAllocated: alloc.qty,
          qtyRemaining: alloc.qty,
        },
      });
    }
  }

  // ─── SiteConfig ─────────────────────────────────────────────────────────────
  await prisma.siteConfig.upsert({
    where: { tenantId: tenant.id },
    update: { isPublished: true },
    create: {
      tenantId: tenant.id,
      template: 'boulangerie',
      colors: {
        primary: '#8B4513',
        secondary: '#DEB887',
        accent: '#D2691E',
        background: '#FFF8F0',
        text: '#2D1810',
      },
      fonts: {
        heading: 'Playfair Display',
        body: 'Inter',
      },
      socialLinks: {
        facebook: 'https://facebook.com/boulangerie-dupont',
        instagram: 'https://instagram.com/boulangerie_dupont',
      },
      // Publiée par défaut — sinon StorefrontLayout renvoie systématiquement
      // notFound() et la vitrine démo n'est jamais testable au navigateur.
      isPublished: true,
    },
  });

  // ─── Pages CMS par défaut ───────────────────────────────────────────────────
  await prisma.page.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'accueil' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Accueil',
      slug: 'accueil',
      metaDescription: 'Boulangerie Dupont — Boulangerie artisanale à Bruxelles depuis 1985',
      isSystem: true,
      sortOrder: 0,
      blocks: [
        {
          id: 'hero-1',
          type: 'HERO',
          order: 0,
          visible: true,
          config: {
            title: 'Bienvenue chez Boulangerie Dupont',
            subtitle: 'Artisans boulangers depuis 1985 — Pain frais chaque matin',
            ctaText: 'Voir nos produits',
            ctaLink: '/catalog',
            overlay: true,
            overlayOpacity: 0.4,
          },
        },
        {
          id: 'products-1',
          type: 'PRODUCTS',
          order: 1,
          visible: true,
          config: {
            title: 'Nos spécialités',
            layout: 'grid',
            columns: 3,
            limit: 6,
          },
        },
        {
          id: 'contact-1',
          type: 'CONTACT',
          order: 2,
          visible: true,
          config: {
            showMap: false,
            showForm: false,
            showHours: true,
            showPhone: true,
            showEmail: true,
          },
        },
      ],
    },
  });

  await prisma.page.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'catalogue' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Notre catalogue',
      slug: 'catalogue',
      metaDescription: 'Découvrez tous nos pains, viennoiseries et pâtisseries artisanales',
      isSystem: true,
      sortOrder: 1,
      blocks: [],
    },
  });

  // ─── Créneaux de retrait ────────────────────────────────────────────────────
  const pickupDays = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ];

  for (const day of pickupDays) {
    await prisma.pickupSlot.create({
      data: {
        tenantId: tenant.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '12:00',
        slotDuration: 30,
        maxOrders: 5,
        minAdvanceHours: 24,
        isActive: true,
      },
    }).catch(() => {
      // Ignore si déjà créé
    });
  }

  console.log('✅ Seed terminé avec succès');
  console.log(`   Tenant  : ${tenant.name} (slug: ${tenant.slug})`);
  console.log(`   Admin   : admin@demo-boulangerie.be / Demo1234!`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
