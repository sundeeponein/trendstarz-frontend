import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────
// Brand registration E2E
// Covers the 3-step brand registration flow:
//   Step 1 — Brand Basics (credentials + logo)
//   Step 2 — Media & Discovery (state, categories, social media)
//   Step 3 — Professional Setup (industry, website, contact)
// API calls are mocked so no backend is required.
// ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_IMAGE = path.resolve(__dirname, 'test-profile.png');

test('Brand registration — full 3-step flow (mocked API)', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));

  const unique = Date.now();
  const email = `testbrand${unique}@example.com`;
  const username = `testbrand${unique}`;
  const phone = `8${String(unique).slice(-9)}`;

  // ── Mock Cloudinary ──────────────────────────────────────
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secure_url: 'https://res.cloudinary.com/test/image/upload/brand-logo.png',
        public_id: 'e2e_brand_logo',
      }),
    });
  });

  // ── Mock states list ─────────────────────────────────────
  await page.route('**/config/states', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ _id: 'state_mh', name: 'Maharashtra' }],
      }),
    });
  });

  // ── Mock categories ──────────────────────────────────────
  await page.route('**/config/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }] }),
    });
  });

  // ── Mock duplicate checks ────────────────────────────────
  await page.route('**/brands/check-username**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });

  // ── Mock registration submit ─────────────────────────────
  await page.route('**/brands/register', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Brand registered successfully' }),
    });
  });

  // ── Go to registration page ──────────────────────────────
  await page.goto('/register-brand');
  await page.waitForSelector('input[formControlName="brandName"]', { state: 'visible' });

  // ════════════════════════ STEP 1 ════════════════════════
  // Upload brand logo
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(TEST_IMAGE);
  await page.waitForTimeout(800);

  // Fill brand basics
  await page.fill('input[formControlName="brandName"]', `TestBrand${unique}`);
  await page.fill('input[formControlName="brandUsername"]', username);
  await page.fill('input[formControlName="phoneNumber"]', phone);
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Brand@1234');
  await page.fill('input[formControlName="confirmPassword"]', 'Brand@1234');

  await page.click('button:has-text("Next Step")');
  await page.screenshot({ path: 'brand-reg-after-step1.png', fullPage: true });

  // Confirm step 2 is visible
  await page.waitForSelector('h2:has-text("Media & Discovery")', { timeout: 6000 });

  // ════════════════════════ STEP 2 ════════════════════════
  // Select state
  const stateSelect = page.locator('[formgroupname="location"] select[formcontrolname="state"], select[formcontrolname="state"]').first();
  await stateSelect.waitFor({ state: 'visible' });
  const stateOptions = await stateSelect.locator('option').all();
  for (const opt of stateOptions) {
    const val = await opt.getAttribute('value');
    if (val && val !== '') {
      await stateSelect.selectOption(val);
      break;
    }
  }

  // Select categories if available
  const categoryChips = page.locator('.chip, .chip-item, button:has-text("Fashion")');
  if (await categoryChips.count() > 0) {
    await categoryChips.first().click();
  }

  await page.click('button:has-text("Next Step")');
  await page.screenshot({ path: 'brand-reg-after-step2.png', fullPage: true });

  await page.waitForSelector('h2:has-text("Professional Setup")', { timeout: 6000 });

  // ════════════════════════ STEP 3 ════════════════════════
  // Fill website if present
  const websiteInput = page.locator('input[formControlName="website"]');
  if (await websiteInput.count() > 0) {
    await websiteInput.fill('https://testbrand.com');
  }

  // ── Submit ────────────────────────────────────────────────
  await page.click('button[type="submit"]');
  await page.screenshot({ path: 'brand-reg-after-submit.png', fullPage: true });

  // Expect success modal
  await expect(page.locator('.reg-success-modal-overlay, .alert-success, text=Successfully Registered').first())
    .toBeVisible({ timeout: 15000 });
});

// ── Validation tests ──────────────────────────────────────────
test.describe('Brand registration — step 1 validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register-brand');
    await page.waitForSelector('input[formControlName="brandName"]', { state: 'visible' });
  });

  test('Next Step is blocked when required fields are empty', async ({ page }) => {
    await page.click('button:has-text("Next Step")');
    // Should still be on step 1 — h2 "Brand Basics" still visible
    await expect(page.locator('h2:has-text("Brand Basics")')).toBeVisible();
  });

  test('password strength checklist appears when typing password', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'weak');
    await expect(page.locator('.pw-checklist')).toBeVisible();
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'Brand@1234');
    await page.fill('input[formControlName="confirmPassword"]', 'Different@9999');
    await page.locator('input[formControlName="confirmPassword"]').blur();
    await expect(page.locator('.text-danger')).toBeVisible();
  });

  test('password toggle works on password field', async ({ page }) => {
    const pwInput = page.locator('input[formControlName="password"]');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.locator('.password-toggle').first().click();
    await expect(pwInput).toHaveAttribute('type', 'text');
  });
});
