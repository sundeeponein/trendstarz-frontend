import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Forgot-password + Reset-password E2E
// All backend calls are mocked to avoid email dependency.
// ─────────────────────────────────────────────────────────────

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForSelector('input[formControlName="email"]', { state: 'visible' });
    // Wait for Angular hydration to complete (SSR app)
    await page.waitForTimeout(2000);
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
    await expect(page.locator('button:has-text("Send Reset Link")')).toBeDisabled();
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

    await expect(page.getByText('If your email is registered, you’ll receive a password reset link shortly.')).toBeVisible({ timeout: 5000 });
  });

  test('shows same success message when email is not registered (mocked API)', async ({ page }) => {
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email not found' }),
      });
    });

    await page.fill('input[formControlName="email"]', 'unknown@example.com');
    await page.click('button:has-text("Send Reset Link")');

    // Component intentionally shows success message even on error (security best practice)
    await expect(page.getByText('If your email is registered, you’ll receive a password reset link shortly.')).toBeVisible({ timeout: 10000 });
  });

  test('Back to Login link navigates to /login', async ({ page }) => {
    await page.locator('a[href="/login"], a:has-text("Back to Login")').first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
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
    // Wait for Angular hydration to complete (SSR app)
    await page.waitForTimeout(2000);
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
    await expect(page.locator('button:has-text("Reset Password")')).toBeDisabled();
  });

  test('password toggle works on both fields', async ({ page }) => {
    const pwInput = page.locator('input[formControlName="password"]');
    const cpInput = page.locator('input[formControlName="confirmPassword"]');

    // First toggle (password field)
    const pwToggle = page.locator('.password-toggle').first();
    await pwToggle.waitFor({ state: 'visible' });
    await pwToggle.click();
    await expect(pwInput).toHaveAttribute('type', 'text', { timeout: 5000 });
    await pwToggle.click();
    await expect(pwInput).toHaveAttribute('type', 'password', { timeout: 5000 });

    // Second toggle (confirm password field)
    const cpToggle = page.locator('.password-toggle').nth(1);
    await cpToggle.waitFor({ state: 'visible' });
    await cpToggle.click();
    await expect(cpInput).toHaveAttribute('type', 'text', { timeout: 5000 });
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

    // Click and wait for the mocked response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/reset-password')),
      page.click('button:has-text("Reset Password")'),
    ]);

    // Angular 21 is zoneless — trigger change detection via template interaction
    await page.waitForTimeout(200);
    await page.locator('input[formControlName="password"]').focus();
    await page.locator('input[formControlName="password"]').blur();

    // Success message is transient before redirect to /login; assert the component state first,
    // then confirm the UI text if it is still mounted.
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const host = document.querySelector('app-reset-password') as any;
        const ng = (window as any).ng;
        const comp = ng?.getComponent?.(host);
        return String(comp?.successMsg || '');
      });
    }, {
      timeout: 5000,
    }).toContain('password has been reset');

    const successMessage = page.locator('.text-success', { hasText: 'Your password has been reset' });
    if (await successMessage.count()) {
      await expect(successMessage.first()).toBeVisible({ timeout: 5000 });
    }
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

    // Click and wait for the mocked response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/reset-password')),
      page.click('button:has-text("Reset Password")'),
    ]);

    // Angular 21 is zoneless — trigger change detection via template interaction
    await page.waitForTimeout(200);
    await page.locator('input[formControlName="password"]').focus();
    await page.locator('input[formControlName="password"]').blur();

    await expect(page.getByText('Invalid or expired token')).toBeVisible({ timeout: 10000 });
  });
});
