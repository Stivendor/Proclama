import { test, expect, type Page } from '@playwright/test';

// ─── helpers ───────────────────────────────────────────────────────────────
/** Open the auth card.
 *  LandingView shows a marketing page (.lp) by default; clicking the nav
 *  "Acceder" button (.lp-btn) sets landingShowAuth=true which renders
 *  AuthView (.auth-overlay > .auth-card) with the Google-only login.
 *
 *  useAuth.ts has a 10-second safety timeout before resolving auth as
 *  unauthenticated, so we wait up to 15s for the landing to render. */
async function waitForAuthCard(page: Page) {
  await page.waitForSelector('.lp-btn', { timeout: 15000 });
  await page.getByRole('button', { name: /^Acceder$/ }).first().click();
  await page.waitForSelector('.auth-card', { timeout: 8000 });
}

// ─── Route protection ───────────────────────────────────────────────────────
test.describe('Route protection', () => {
  test('/ shows landing page to unauthenticated users', async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);
    await expect(page.locator('.auth-card')).toBeVisible();
  });

  // Check that protected routes render the landing page, not the app shell.
  // We only look for the landing root (no auth) rather than opening the auth
  // card on every iteration to keep the test fast.
  test('protected routes show landing page, not app shell', async ({ page }) => {
    test.setTimeout(90_000);
    for (const route of ['/library', '/setlists', '/settings', '/bible', '/notes']) {
      await page.goto(route);
      // Auth resolves in ≤10s via safety timeout; landing renders shortly after
      await page.waitForSelector('.lp', { timeout: 15000 });
      await expect(page.locator('.lp')).toBeVisible();
      // The main app shell must NOT be visible
      await expect(page.locator('.app-shell')).not.toBeVisible();
    }
  });

  test('/admin redirects unauthenticated users away', async ({ page }) => {
    await page.goto('/admin');
    // AdminGuard does window.location.href = "/" when no session
    await page.waitForURL('http://localhost:5173/', { timeout: 15000 });
    await expect(page).toHaveURL('/');
  });
});

// ─── Google-only auth card ──────────────────────────────────────────────────
test.describe('Google-only auth card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);
  });

  test('auth card shows the Google button', async ({ page }) => {
    const googleBtn = page.locator('.auth-btn-google');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toContainText('Continuar con Google');
    await expect(page.locator('.auth-card button')).toHaveCount(1);
  });

  test('no email or password inputs exist', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="current-password"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
  });

  test('no register/login toggle exists', async ({ page }) => {
    await expect(page.locator('.auth-toggle')).toHaveCount(0);
  });

  test('clean load shows no error region and Google button is enabled', async ({ page }) => {
    await expect(page.locator('.auth-error')).toHaveCount(0);
    await expect(page.locator('.auth-btn-google')).toBeEnabled();
  });
});

// ─── No sensitive data leakage ───────────────────────────────────────────────
test.describe('Sensitive data exposure', () => {
  test('no service_role key exposed in page source', async ({ page }) => {
    const response = await page.goto('/');
    const html = await response!.text();
    expect(html).not.toMatch(/service_role/i);
    expect(html).not.toMatch(/SUPABASE_SERVICE_KEY/i);
  });
});
