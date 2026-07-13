// prisma/seed.ts — ArtisaStock V2
import { PrismaClient, Plan, VatRate, UnitOfMeasure, DayOfWeek } from '@prisma/client';
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
    'products.read', 'products.write', 'products.delete',
    'orders.read', 'orders.manage',
    'invoices.read', 'invoices.generate',
    'cms.read', 'cms.write', 'cms.publish',
    'team.read', 'team.manage',
    'settings.read', 'settings.write',
  ];

  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
    update: {},
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
      },
    }),
  ]);

  const [farine, sucre, beurre, oeufs, levure, sel] = ingredients;

  // ─── Recettes ───────────────────────────────────────────────────────────────
  const recipePain = await prisma.recipe.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Pain de campagne' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Pain de campagne',
      description: 'Pain rustique à la croûte dorée, mie aérée',
      category: 'Pains',
      servings: 1,
      prepTime: 20,
      cookTime: 35,
      marginCoeff: 2.5,
      vatRate: VatRate.FOOD_6,
      steps: [
        { order: 1, instruction: 'Mélanger farine, sel et eau froide. Laisser reposer 20 min (autolyse).' },
        { order: 2, instruction: 'Ajouter la levure émiettée. Pétrir 10 min jusqu\'à pâte lisse et élastique.' },
        { order: 3, instruction: 'Première pousse 1h30 à température ambiante (couvert d\'un linge).' },
        { order: 4, instruction: 'Façonner en boule, déposer en banneton fariné. Pousse finale 45 min.' },
        { order: 5, instruction: 'Préchauffer four à 240°C avec vapeur. Grigner la pâte.' },
        { order: 6, instruction: 'Cuire 35 min. La pâte doit sonner creux quand on tape le dessous.' },
      ],
      totalCost: 0.62,
      costPerServing: 0.62,
      ingredients: {
        create: [
          { ingredientId: farine.id, quantity: 0.500, unit: UnitOfMeasure.KG },
          { ingredientId: levure.id, quantity: 8, unit: UnitOfMeasure.G },
          { ingredientId: sel.id, quantity: 0.010, unit: UnitOfMeasure.KG },
        ],
      },
    },
  });

  const recipeCroissant = await prisma.recipe.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Croissant pur beurre' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Croissant pur beurre',
      description: 'Croissant feuilleté au beurre AOC, dorure brillante',
      category: 'Viennoiseries',
      servings: 12,
      prepTime: 90,
      cookTime: 18,
      marginCoeff: 3.0,
      vatRate: VatRate.FOOD_6,
      steps: [
        { order: 1, instruction: 'Préparer le détrempe (farine, sucre, sel, levure, lait, beurre de tourage). Laisser pointer 1h.' },
        { order: 2, instruction: 'Réfrigérer 30 min. Incorporer le beurre de tourage (beurrage).' },
        { order: 3, instruction: 'Réaliser 3 tours doubles avec repos au frais entre chaque.' },
        { order: 4, instruction: 'Abaisser à 3mm, découper des triangles de 90g. Façonner les croissants.' },
        { order: 5, instruction: 'Dorer à l\'oeuf battu. Pousse finale 2h à 26°C.' },
        { order: 6, instruction: 'Dorer à nouveau. Cuire à 190°C, 16-18 min.' },
      ],
      totalCost: 3.89,
      costPerServing: 0.32,
      ingredients: {
        create: [
          { ingredientId: farine.id, quantity: 0.500, unit: UnitOfMeasure.KG },
          { ingredientId: beurre.id, quantity: 0.300, unit: UnitOfMeasure.KG },
          { ingredientId: sucre.id, quantity: 0.050, unit: UnitOfMeasure.KG },
          { ingredientId: sel.id, quantity: 0.010, unit: UnitOfMeasure.KG },
          { ingredientId: levure.id, quantity: 20, unit: UnitOfMeasure.G },
          { ingredientId: oeufs.id, quantity: 2, unit: UnitOfMeasure.PIECE },
        ],
      },
    },
  });

  // ─── Produits finis ─────────────────────────────────────────────────────────
  await prisma.product.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'pain-de-campagne' } },
    update: {},
    create: {
      tenantId: tenant.id,
      recipeId: recipePain.id,
      name: 'Pain de campagne',
      slug: 'pain-de-campagne',
      description: 'Notre pain signature, cuit sur pierre chaque matin',
      descriptionLong: 'Élaboré avec une farine T65 sélectionnée, ce pain de campagne incarne le savoir-faire artisanal de notre boulangerie. Croûte dorée et craquante, mie aérée et légèrement acidulée.',
      category: 'Pains',
      priceHT: 2.83,
      priceTTC: 3.00,
      vatRate: VatRate.FOOD_6,
      allergens: ['gluten'],
      isVisible: true,
      isClickCollect: true,
      stockType: 'daily',
      stockQuantity: 30,
      sortOrder: 1,
    },
  });

  await prisma.product.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'croissant-pur-beurre' } },
    update: {},
    create: {
      tenantId: tenant.id,
      recipeId: recipeCroissant.id,
      name: 'Croissant pur beurre',
      slug: 'croissant-pur-beurre',
      description: 'Feuilleté au beurre AOC Charentes-Poitou, dorure brillante',
      category: 'Viennoiseries',
      priceHT: 1.42,
      priceTTC: 1.50,
      vatRate: VatRate.FOOD_6,
      allergens: ['gluten', 'lait', 'oeufs'],
      isVisible: true,
      isClickCollect: true,
      stockType: 'daily',
      stockQuantity: 50,
      sortOrder: 2,
    },
  });

  // ─── SiteConfig ─────────────────────────────────────────────────────────────
  await prisma.siteConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
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
      isPublished: false,
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
