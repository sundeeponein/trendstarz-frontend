import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Forgot-password + Reset-password E2E
// All backend calls are mocked to avoid email dependency.
// ─────────────────────────────────────────────────────────────

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForSelector('input[formControlName="email"]', { state: 'visible' });
  });

  test('renders email field and Send Reset Link button', async ({ page }) => {
    await expect(page.locator('input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Send Reset Link")')).toBeVisible();
  });

  test('button is disabled when email is empty', async ({ page }) => {
    await expect(page.locator('button:has-text("Send Reset Link")')).toBeDisabled();
  });

  test('shows validation error for invalid email format', async ({ page }) => {
    await page.fill('input[formControlName="email"]', 'not-an-email');
    await page.locator('input[formControlName="email"]').blur();
    await expect(page.locator('.text-danger')).toBeVisible();
  });

  test('shows success message after submitting valid email (mocked API)', async ({ page }) => {
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Reset link sent to your email.' }),
      });
    });

    await page.fill('input[formControlName="email"]', 'user@example.com');
    await page.click('button:has-text("Send Reset Link")');

    await expect(page.locator('.text-success')).toBeVisible({ timeout: 5000 });
  });

  test('shows error message when email is not registered (mocked API)', async ({ page }) => {
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email not found' }),
      });
    });

    await page.fill('input[formControlName="email"]', 'unknown@example.com');
    await page.click('button:has-text("Send Reset Link")');

    await expect(page.locator('.text-danger')).toBeVisible({ timeout: 5000 });
  });

  test('Back to Login link navigates to /login', async ({ page }) => {
    await page.click('a:has-text("Back to Login")');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────
// Reset password page (reached via email link with token)
// ─────────────────────────────────────────────────────────────
test.describe('Reset password page', () => {
  const RESET_URL = '/reset-password?token=fake-reset-token-123';

  test.beforeEach(async ({ page }) => {
    await page.goto(RESET_URL);
    await page.waitForSelector('input[formControlName="password"]', { state: 'visible' });
  });

  test('renders new password and confirm password fields', async ({ page }) => {
    await expect(page.locator('input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('input[formControlName="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button:has-text("Reset Password")')).toBeVisible();
  });

  test('password strength checklist appears when typing', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'weak');
    await expect(page.locator('.pw-checklist')).toBeVisible();
  });

  test('all checklist items pass with a strong password', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'Strong@1234');
    const items = page.locator('.pw-checklist li');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveClass(/passed/);
    }
  });

  test('shows mismatch error when passwords differ', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'Strong@1234');
    await page.fill('input[formControlName="confirmPassword"]', 'Different@9');
    await page.locator('input[formControlName="confirmPassword"]').blur();
    await expect(page.locator('.text-danger')).toBeVisible();
  });

  test('password toggle works on both fields', async ({ page }) => {
    const pwInput = page.locator('input[formControlName="password"]');
    const cpInput = page.locator('input[formControlName="confirmPassword"]');

    // First toggle (password field)
    await page.locator('.password-toggle').first().click();
    await expect(pwInput).toHaveAttribute('type', 'text');
    await page.locator('.password-toggle').first().click();
    await expect(pwInput).toHaveAttribute('type', 'password');

    // Second toggle (confirm password field)
    await page.locator('.password-toggle').nth(1).click();
    await expect(cpInput).toHaveAttribute('type', 'text');
  });

  test('shows success message after valid reset (mocked API)', async ({ page }) => {
    await page.route('**/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password reset successfully.' }),
      });
    });

    await page.fill('input[formControlName="password"]', 'NewPass@1234');
    await page.fill('input[formControlName="confirmPassword"]', 'NewPass@1234');
    await page.click('button:has-text("Reset Password")');

    await expect(page.locator('.text-success')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when token is invalid (mocked API)', async ({ page }) => {
    await page.route('**/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      });
    });

    await page.fill('input[formControlName="password"]', 'NewPass@1234');
    await page.fill('input[formControlName="confirmPassword"]', 'NewPass@1234');
    await page.click('button:has-text("Reset Password")');

    await expect(page.locator('.text-danger')).toBeVisible({ timeout: 5000 });
  });
});
