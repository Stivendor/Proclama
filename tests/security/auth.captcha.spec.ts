import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.TEST_USER_EMAIL!;

/** Mock the Turnstile script so the widget calls onSuccess with a fake token,
 *  enabling the submit button in headless. The token is intentionally fake —
 *  Supabase must still reject it server-side. */
async function mockTurnstile(page: Page) {
  await page.route('**/turnstile/v0/api.js*', route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render: function(el, params) {
            setTimeout(function() {
              if (params && typeof params.callback === 'function')
                params.callback('mock-token-e2e');
            }, 200);
            return 'mock-widget-id';
          },
          reset: function() {}, remove: function() {},
          getResponse: function() { return 'mock-token-e2e'; },
          isExpired: function() { return false; }
        };
      `,
    });
  });
}

async function goToLoginCard(page: Page) {
  await page.waitForSelector('.landing-btn-line', { timeout: 15000 });
  await page.locator('.landing-btn-line').first().click();
  await page.waitForSelector('.auth-card', { timeout: 8000 });
}

test.describe('Captcha enforcement', () => {
  test('submit button stays disabled until captcha resolves', async ({ page }) => {
    await mockTurnstile(page);
    await page.goto('/');
    await goToLoginCard(page);

    const submit = page.locator('button[type="submit"]').first();
    await expect(submit).toBeDisabled();           // before captcha fires
    await expect(submit).toBeEnabled({ timeout: 5000 }); // after mock callback
  });

  test('server rejects a forged captcha token', async ({ page }) => {
    await mockTurnstile(page);
    await page.goto('/');
    await goToLoginCard(page);

    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill('whatever123');
    await expect(page.locator('button[type="submit"]').first()).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').first().click();

    // Supabase validates the token server-side against Cloudflare → forged token fails.
    // This proves captcha protection is enforced, not just rendered.
    const error = page.locator('.auth-error');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).toContainText(/captcha/i);

    // And login must NOT have succeeded
    await expect(page.locator('.app-shell')).not.toBeVisible();
  });
});
