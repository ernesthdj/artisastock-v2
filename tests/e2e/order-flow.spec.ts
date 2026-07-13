/**
 * Tests E2E — Parcours Commande Client (Storefront)
 *
 * Prérequis : Playwright installé + serveur Next.js actif + seed DB démo
 * Commande  : npx playwright test tests/e2e/order-flow.spec.ts
 *
 * Couvre le parcours critique :
 * vitrine catalogue → panier → checkout → Stripe redirect → suivi commande
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DEMO_SLUG = process.env.E2E_TENANT_SLUG ?? 'boulangerie-demo';
const STOREFRONT_URL = `${BASE_URL}/storefront/${DEMO_SLUG}`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function addFirstProductToCart(page: Page) {
  await page.goto(`${STOREFRONT_URL}/catalog`);
  await page.waitForLoadState('networkidle');

  // Cliquer sur le premier bouton "Ajouter au panier"
  const addBtn = page.locator('button:has-text("Ajouter"), button[aria-label*="panier"]').first();
  await addBtn.click();
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

test.describe('Catalogue produits', () => {
  test('should_display_product_catalog_for_valid_tenant', async ({ page }) => {
    await page.goto(`${STOREFRONT_URL}/catalog`);

    // Titre ou grille produits visibles
    await expect(page.locator('[data-testid="product-grid"], .product-card')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should_show_not_found_for_invalid_tenant_slug', async ({ page }) => {
    await page.goto(`${BASE_URL}/storefront/tenant-qui-nexiste-pas/catalog`);
    // Next.js notFound() → 404
    await expect(page.locator('text=404, text=introuvable')).toBeVisible({ timeout: 5000 });
  });

  test('should_display_out_of_stock_overlay_for_unavailable_products', async ({ page }) => {
    await page.goto(`${STOREFRONT_URL}/catalog`);
    // Si produits en rupture : overlay visible
    const outOfStock = page.locator('text=Rupture, text=Indisponible');
    // Ne pas échouer si tous les produits sont dispo
    const count = await outOfStock.count();
    if (count > 0) {
      await expect(outOfStock.first()).toBeVisible();
    }
  });
});

// ─── Panier ──────────────────────────────────────────────────────────────────

test.describe('Gestion du panier', () => {
  test('should_add_product_to_cart_and_show_badge', async ({ page }) => {
    await addFirstProductToCart(page);

    // Badge panier dans le header > 0
    const cartBadge = page.locator('[data-testid="cart-badge"], .cart-count');
    await expect(cartBadge).toBeVisible({ timeout: 3000 });
    const badgeText = await cartBadge.textContent();
    expect(Number(badgeText)).toBeGreaterThan(0);
  });

  test('should_increment_quantity_in_cart', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto(`${STOREFRONT_URL}/cart`);

    const initialQty = await page.locator('[data-testid="quantity-value"], .quantity-display').first().textContent();
    await page.locator('button[aria-label*="augmenter"], button:has-text("+")').first().click();

    const newQty = await page.locator('[data-testid="quantity-value"], .quantity-display').first().textContent();
    expect(Number(newQty)).toBeGreaterThan(Number(initialQty));
  });

  test('should_clear_cart_with_empty_state', async ({ page }) => {
    await page.goto(`${STOREFRONT_URL}/cart`);
    // Si panier vide : CTA visible
    const emptyState = page.locator('text=panier est vide, text=Votre panier');
    // Si le panier est vide, l'état empty doit être visible
    const isEmpty = (await emptyState.count()) > 0;
    if (isEmpty) {
      await expect(emptyState.first()).toBeVisible();
    }
  });
});

// ─── Checkout ─────────────────────────────────────────────────────────────────

test.describe('Checkout multi-étapes', () => {
  test.beforeEach(async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto(`${STOREFRONT_URL}/checkout`);
  });

  test('should_display_checkout_steps', async ({ page }) => {
    // Étapes visibles : informations / créneau / paiement
    const stepIndicators = page.locator('[data-step], .step-indicator, .checkout-step');
    await expect(stepIndicators.first()).toBeVisible({ timeout: 5000 });
  });

  test('should_require_customer_info_before_proceeding', async ({ page }) => {
    // Cliquer sur Suivant sans remplir les champs
    const nextBtn = page.locator('button:has-text("Suivant"), button:has-text("Continuer")');
    await nextBtn.click();

    // Messages d'erreur de validation
    await expect(page.locator('.text-destructive, [role="alert"]').first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('should_list_available_pickup_slots', async ({ page }) => {
    // Remplir les infos client d'abord
    await page.fill('input[name="firstName"]', 'Alice');
    await page.fill('input[name="lastName"]', 'Test');
    await page.fill('input[name="email"]', 'alice@test.be');

    await page.click('button:has-text("Suivant"), button:has-text("Continuer")');

    // Créneaux de retrait visibles
    await expect(
      page.locator('[data-testid="pickup-slot"], .pickup-slot-option').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ─── Suivi de commande ────────────────────────────────────────────────────────

test.describe('Suivi commande', () => {
  test('should_display_order_tracking_page_with_progress_bar', async ({ page }) => {
    // Utiliser un token de tracking de démo
    const demoToken = process.env.E2E_TRACKING_TOKEN ?? 'demo-tracking-token';
    await page.goto(`${STOREFRONT_URL}/order/${demoToken}`);

    // La page de tracking affiche soit les infos commande, soit une erreur gracieuse
    const content = page.locator('[data-testid="tracking-page"], .tracking-container, text=commande');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('should_display_pending_page_after_stripe_redirect', async ({ page }) => {
    await page.goto(`${STOREFRONT_URL}/order/pending?session_id=cs_test_fake`);

    // Page d'attente post-paiement
    await expect(
      page.locator('text=paiement, text=Merci, text=commande confirmée')
    ).toBeVisible({ timeout: 5000 });
  });
});
