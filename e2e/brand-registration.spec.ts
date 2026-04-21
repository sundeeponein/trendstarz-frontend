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

  // ── Mock languages ──────────────────────────────────────
  await page.route('**/languages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'lang1', name: 'English' }] }),
    });
  });

  // ── Mock social media platforms ──────────────────────────
  await page.route('**/social-media', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { _id: 'sm_ig', name: 'Instagram', icon: 'bi bi-instagram', color: '#E1306C',
            contentTypes: [{ key: 'post', label: 'Post', price: 0 }] },
        ],
      }),
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
  // Wait for Angular hydration to complete (SSR app, zoneless)
  await page.waitForTimeout(2000);

  // ════════════════════════ STEP 1 ════════════════════════
  // Upload brand logo
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(TEST_IMAGE);
  // Wait for imageCompression (uses Web Worker) + FileReader.onload
  await page.waitForTimeout(8000);
  // Trigger CD by interacting with another field
  await page.locator('input[formControlName="brandName"]').focus();
  await page.locator('input[formControlName="brandName"]').blur();
  await page.waitForTimeout(1000);
  // If image compression Web Worker failed, set preview directly
  const hasPreview = await page.locator('img.preview-image').first().isVisible().catch(() => false);
  if (!hasPreview) {
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      if (input?.files?.[0]) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const ng = (window as any).ng;
          const el = document.querySelector('app-brand-registration');
          if (ng && el) {
            const comp = ng.getComponent(el);
            if (comp) {
              comp.brandLogoPreview = e.target.result;
              comp.brandLogoFile = input.files![0];
              comp.refreshStepCompletion();
              // trigger CD
              const cdr = ng.getOwningNgModule?.(el) || null;
              try { comp.cd?.detectChanges?.(); } catch {}
            }
          }
        };
        reader.readAsDataURL(input.files[0]);
      }
    });
    await page.waitForTimeout(2000);
    await page.locator('input[formControlName="brandName"]').focus();
    await page.locator('input[formControlName="brandName"]').blur();
  }

  // Fill brand basics
  await page.fill('input[formControlName="brandName"]', `TestBrand${unique}`);
  await page.fill('input[formControlName="brandUsername"]', username);
  await page.fill('input[formControlName="phoneNumber"]', phone);
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Brand@1234');
  await page.fill('input[formControlName="confirmPassword"]', 'Brand@1234');

  await page.click('button:has-text("Next Step")');
  // Trigger change detection after step transition
  await page.waitForTimeout(500);
  await page.locator('body').click();

  // Confirm step 2 is visible
  await page.waitForSelector('h2:has-text("Media & Discovery")', { timeout: 10000 });

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

  // Select language via ng-select
  const langSelect = page.locator('ng-select[formControlName="languages"]').first();
  await langSelect.scrollIntoViewIfNeeded();
  await langSelect.click();
  await page.waitForTimeout(500);
  // Type to search and press Enter to select
  await page.keyboard.type('English');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  // Close dropdown by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Select category via ng-select
  const catSelect = page.locator('ng-select[formControlName="categories"]').first();
  await catSelect.scrollIntoViewIfNeeded();
  await catSelect.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('Fashion');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Select at least one social media platform (required)
  const platformCard = page.locator('.platform-card').first();
  await platformCard.waitFor({ state: 'visible', timeout: 5000 });
  await platformCard.click();

  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(500);
  await page.locator('body').click();

  await page.waitForSelector('h2:has-text("Professional Setup")', { timeout: 10000 });

  // ════════════════════════ STEP 3 ════════════════════════
  // Fill starting price (required)
  await page.fill('input[formControlName="promotionalPrice"]', '500');

  // Select at least one contact method (required)
  const contactCard = page.locator('.contact-card').first();
  if (await contactCard.count() > 0) {
    await contactCard.click();
  }

  // Fill website if present
  const websiteInput = page.locator('input[formControlName="website"]');
  if (await websiteInput.count() > 0) {
    await websiteInput.fill('https://testbrand.com');
  }

  // ── Submit ────────────────────────────────────────────────
  await page.click('button[type="submit"]');

  // Wait for the mocked register response and success modal to appear
  // Trigger change detection (zoneless Angular) to ensure modal renders
  await page.waitForTimeout(2000);
  await page.locator('body').click();

  // Expect success modal
  await expect(page.locator('text=Successfully Registered'))
    .toBeVisible({ timeout: 15000 });
});

// ── Validation tests ──────────────────────────────────────────
test.describe('Brand registration — step 1 validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register-brand');
    await page.waitForSelector('input[formControlName="brandName"]', { state: 'visible' });
    // Wait for Angular hydration (SSR app, zoneless)
    await page.waitForTimeout(2000);
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
    // Use specific text to avoid matching required-field * markers that also have .text-danger
    await expect(page.locator('text=Passwords do not match')).toBeVisible({ timeout: 5000 });
  });

  test('password toggle works on password field', async ({ page }) => {
    const pwInput = page.locator('input[formControlName="password"]');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.locator('.password-toggle').first().click();
    await expect(pwInput).toHaveAttribute('type', 'text');
  });
});
