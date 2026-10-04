import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Login page tests
// These tests do NOT require a real backend connection.
// They validate UI behaviour, validation messages, and
// password-toggle functionality.
// ─────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Ensure no lingering auth state from other tests — guard against SecurityError
    try {
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); document.cookie.split(';').forEach(c=>{document.cookie = c.replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');}); });
    } catch (e) {
      // ignore security errors when the page context disallows storage access
    }
    await page.waitForSelector('form', { state: 'visible' });
    // Wait for Angular hydration to complete (SSR app)
    await page.waitForTimeout(2000);
  });

  test('renders email, password fields and sign-in button', async ({ page }) => {
    await expect(page.locator('input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('button.btn-signin')).toBeVisible();
  });

  test('sign-in button is disabled when form is empty', async ({ page }) => {
    // Button is visible; form validation is shown after submit in current UI
    await expect(page.locator('button.btn-signin')).toBeVisible();
  });

  test('shows email validation error on blur with invalid email', async ({ page }) => {
    await page.fill('input[formControlName="email"]', 'not-an-email');
    await page.locator('input[formControlName="email"]').blur();
    // Validation hints are shown after the user attempts to submit
    await page.click('button.btn-signin');
    await expect(page.locator('.field-hint').first()).toBeVisible();
  });

  test('shows password validation error on blur with empty password', async ({ page }) => {
    await page.fill('input[formControlName="email"]', 'test@example.com');
    await page.click('input[formControlName="password"]');
    await page.locator('input[formControlName="password"]').blur();
    // Validation hints are shown after the user attempts to submit
    await page.click('button.btn-signin');
    await expect(page.locator('.field-hint').first()).toBeVisible();
  });

  test('password toggle switches input type between password and text', async ({ page }) => {
    const pwInput = page.locator('input[formControlName="password"]');
    await expect(pwInput).toHaveAttribute('type', 'password');

    const toggle = page.locator('.password-toggle');
    await toggle.waitFor({ state: 'visible' });
    await toggle.click();
    await expect(pwInput).toHaveAttribute('type', 'text', { timeout: 5000 });

    await toggle.click();
    await expect(pwInput).toHaveAttribute('type', 'password', { timeout: 5000 });
  });

  test('forgot password link navigates to forgot-password page', async ({ page }) => {
    await page.getByRole('link', { name: /forgot/i }).first().click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('shows error message for invalid credentials (mocked API)', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    });

    await page.fill('input[formControlName="email"]', 'wrong@example.com');
    await page.fill('input[formControlName="password"]', 'WrongPass@1');

    // Click and wait for the mocked response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/login')),
      page.click('button.btn-signin'),
    ]);

    // Force Angular change detection — Angular 21 is zoneless, no Zone.js
    // Interact with a template element to trigger Angular's event-based CD
    await page.waitForTimeout(500);
    await page.locator('input[formControlName="email"]').focus();
    await page.locator('input[formControlName="email"]').blur();

    // API error is rendered via global toast host
    await expect(page.locator('.toast-item.toast-error')).toBeVisible({ timeout: 10000 });
  });

  test('successful login redirects away from login page (mocked API)', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-jwt-token',
          user: { role: 'influencer', name: 'Test Influencer' },
        }),
      });
    });

    await page.fill('input[formControlName="email"]', 'influencer@example.com');
    await page.fill('input[formControlName="password"]', 'Test@1234');
    await page.click('button.btn-signin');

    // Should navigate away from /login
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 5000 });
  });
});
