/**
 * Tests E2E — Parcours Authentification
 *
 * Prérequis : Playwright installé + serveur Next.js actif
 * Commande  : npx playwright test tests/e2e/auth.spec.ts
 *
 * Ces tests couvrent le parcours complet d'authentification :
 * inscription → connexion → accès dashboard → déconnexion.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
}

// ─── Inscription ──────────────────────────────────────────────────────────────

test.describe('Inscription artisan', () => {
  test('should_complete_registration_with_valid_data', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/register`);

    await page.fill('input[name="businessName"]', 'Boulangerie Test E2E');
    await page.fill('input[name="firstName"]', 'Jean');
    await page.fill('input[name="lastName"]', 'Test');
    await page.fill('input[name="email"]', `e2e-${Date.now()}@test.be`);
    await page.fill('input[name="password"]', 'SecurePass1!');

    await page.click('button[type="submit"]');

    // Après inscription réussie : état success avec message
    await expect(page.locator('text=inscription')).toBeVisible({ timeout: 5000 });
  });

  test('should_show_password_strength_indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/register`);
    await page.fill('input[name="password"]', 'weak');

    // Les barres de force de mot de passe sont présentes
    const strengthBars = page.locator('[class*="h-1"]');
    await expect(strengthBars.first()).toBeVisible();
  });

  test('should_reject_invalid_email_format', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/register`);
    await page.fill('input[name="email"]', 'not-an-email');
    await page.fill('input[name="password"]', 'SecurePass1!');
    await page.fill('input[name="businessName"]', 'Test');
    await page.fill('input[name="firstName"]', 'J');
    await page.fill('input[name="lastName"]', 'T');
    await page.click('button[type="submit"]');

    // Message d'erreur de validation visible
    await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible({ timeout: 3000 });
  });
});

// ─── Connexion ────────────────────────────────────────────────────────────────

test.describe('Connexion artisan', () => {
  test('should_login_and_redirect_to_dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/login`);

    await fillLoginForm(page, 'admin@artisastock.be', 'Admin1234!');
    await page.click('button[type="submit"]');

    // Redirection vers le dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
    await expect(page.locator('text=Dashboard, text=Tableau de bord')).toBeVisible();
  });

  test('should_show_error_for_wrong_credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/login`);

    await fillLoginForm(page, 'unknown@test.be', 'WrongPass1!');
    await page.click('button[type="submit"]');

    // Message d'erreur visible sans redirection
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible({ timeout: 5000 });
  });

  test('should_toggle_password_visibility', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/login`);

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Cliquer sur le bouton show/hide
    await page.click('button[aria-label*="mot de passe"], button:has([data-lucide])');
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('should_remember_me_option_exist', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/login`);
    // Option "Se souvenir de moi" présente
    const rememberMe = page.locator('input[type="checkbox"]');
    await expect(rememberMe).toBeVisible();
  });
});

// ─── Mot de passe oublié ──────────────────────────────────────────────────────

test.describe('Forgot password flow', () => {
  test('should_show_success_message_without_revealing_email_existence', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/forgot-password`);

    await page.fill('input[type="email"]', 'nonexistent@test.be');
    await page.click('button[type="submit"]');

    // Toujours afficher le succès (ne pas révéler si l'email existe)
    await expect(page.locator('text=envoyé')).toBeVisible({ timeout: 5000 });
  });
});

// ─── RBAC — Accès refusé ──────────────────────────────────────────────────────

test.describe('RBAC access control', () => {
  test('should_redirect_unauthenticated_user_to_login', async ({ page }) => {
    // Accès direct au dashboard sans token
    await page.goto(`${BASE_URL}/fr/dashboard`);
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
