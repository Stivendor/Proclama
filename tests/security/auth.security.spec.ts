import { test, expect } from '@playwright/test';

// ─── helpers ───────────────────────────────────────────────────────────────
/** Navigate to the auth card.
 *  LandingView shows a marketing page by default; clicking the nav "Acceder"
 *  button sets landingShowAuth=true which renders AuthView (.auth-card).
 *
 *  useAuth.ts has a 10-second safety timeout before resolving auth as
 *  unauthenticated, so we wait up to 15s for the button to appear. */
async function waitForAuthCard(page: import('@playwright/test').Page) {
  // Wait for auth to resolve and landing page to render (may take up to 10s)
  await page.waitForSelector('.landing-btn-line', { timeout: 15000 });
  await page.locator('.landing-btn-line').first().click();
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
  // We only look for .landing-root (no auth) rather than opening the auth card
  // on every iteration to keep the test fast.
  test('protected routes show landing page, not app shell', async ({ page }) => {
    for (const route of ['/library', '/setlists', '/settings', '/bible', '/notes']) {
      await page.goto(route);
      // Auth resolves in ≤10s via safety timeout; landing renders shortly after
      await page.waitForSelector('.landing-root', { timeout: 15000 });
      await expect(page.locator('.landing-root')).toBeVisible();
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

// ─── Password field security ─────────────────────────────────────────────────
test.describe('Password field security', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);
  });

  test('password input is masked by default on login', async ({ page }) => {
    const pw = page.locator('input[type="password"]').first();
    await expect(pw).toBeVisible();
    await expect(pw).toHaveAttribute('type', 'password');
  });

  test('show/hide toggle switches between password and text', async ({ page }) => {
    const pw = page.locator('input[autocomplete="current-password"]');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.locator('.auth-eye-btn').click();
    await expect(pw).toHaveAttribute('type', 'text');
    await page.locator('.auth-eye-btn').click();
    await expect(pw).toHaveAttribute('type', 'password');
  });

  test('password is masked by default on register step 1', async ({ page }) => {
    await page.locator('.auth-toggle button').click();
    await page.waitForSelector('input[autocomplete="new-password"]');
    const pw = page.locator('input[autocomplete="new-password"]');
    await expect(pw).toHaveAttribute('type', 'password');
  });
});

// ─── Login form validation ───────────────────────────────────────────────────
test.describe('Login form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);
  });

  test('email and password inputs have required attribute', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toHaveAttribute('required');
    await expect(page.locator('input[autocomplete="current-password"]')).toHaveAttribute('required');
  });

  test('submit button is disabled without captcha token', async ({ page }) => {
    // Turnstile iframe loads but won't complete in headless → captchaToken stays null
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeDisabled();
  });
});

// ─── Registration form validation ───────────────────────────────────────────
test.describe('Registration form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);
    await page.locator('.auth-toggle button').click();
    await page.waitForSelector('input[autocomplete="new-password"]');
  });

  test('password field has minlength of 6', async ({ page }) => {
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveAttribute('minlength', '6');
  });

  test('step 1 next button shows error when terms not accepted', async ({ page }) => {
    await page.locator('input[autocomplete="name"]').fill('Test User');
    await page.locator('input[autocomplete="email"]').fill('test@example.com');
    await page.locator('input[autocomplete="new-password"]').fill('secret123');
    await page.locator('button[type="submit"]').click();
    const error = page.locator('.auth-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Términos');
  });

  test('step 1 next button shows error for whitespace-only name', async ({ page }) => {
    // Fill all browser-required fields so native validation doesn't block.
    // Name is whitespace only → passes browser required but fails React's trim() check.
    await page.locator('input[autocomplete="name"]').fill('   ');
    await page.locator('input[autocomplete="email"]').fill('test@example.com');
    await page.locator('input[autocomplete="new-password"]').fill('secret123');
    await page.locator('button[type="submit"]').click();
    const error = page.locator('.auth-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('nombre');
  });
});

// ─── XSS prevention ─────────────────────────────────────────────────────────
test.describe('XSS prevention', () => {
  test('script injection in name field does not execute', async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);
    await page.locator('.auth-toggle button').click();
    await page.waitForSelector('input[autocomplete="name"]');

    let xssExecuted = false;
    await page.exposeFunction('__xssProbe', () => { xssExecuted = true; });
    await page.addInitScript(() => {
      window.alert = () => { (window as any).__xssProbe?.(); };
    });

    await page.locator('input[autocomplete="name"]').fill('<script>window.__xssProbe()</script>');
    await page.locator('input[autocomplete="email"]').click(); // trigger blur
    expect(xssExecuted).toBe(false);
  });

  test('HTML in email field is treated as plain text', async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);

    const emailInput = page.locator('input[type="email"]').first();
    const payload = '"><img src=x onerror=alert(1)>';
    await emailInput.fill(payload);
    await expect(emailInput).toHaveValue(payload);
    // No img element injected into the auth card
    await expect(page.locator('.auth-card img')).toHaveCount(0);
  });
});

// ─── No sensitive data leakage ───────────────────────────────────────────────
test.describe('Sensitive data exposure', () => {
  test('password is not stored in localStorage', async ({ page }) => {
    await page.goto('/');
    await waitForAuthCard(page);

    await page.locator('input[type="email"]').first().fill('user@example.com');
    await page.locator('input[autocomplete="current-password"]').fill('mysecretpassword');

    const storage = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(storage).not.toContain('mysecretpassword');
  });

  test('no service_role key exposed in page source', async ({ page }) => {
    const response = await page.goto('/');
    const html = await response!.text();
    // ponytail: simple heuristic; real secret scanning uses static analysis
    expect(html).not.toMatch(/service_role/i);
    expect(html).not.toMatch(/SUPABASE_SERVICE_KEY/i);
  });
});
