import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────
// Influencer registration E2E
// Covers the 3-step influencer registration flow:
//   Step 1 — Basic Information (name, username, phone, email, passwords)
//   Step 2 — Social Media & Media (image, state, languages, categories, platform)
//   Step 3 — Professional Details (contact method, starting price)
// API calls are mocked so no backend is required.
// ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_IMAGE = path.resolve(__dirname, 'test-profile.png');

test('Influencer registration — full 3-step flow (mocked API)', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));

  const unique = Date.now();
  const email = `testinfluencer${unique}@example.com`;
  const username = `testinfluencer${unique}`;
  const phone = `9${String(unique).slice(-9)}`;

  // ── Mock Cloudinary ──────────────────────────────────────
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secure_url: 'https://res.cloudinary.com/test/image/upload/influencer-img.png',
        public_id: 'e2e_influencer_img',
      }),
    });
  });

  // ── Mock states ──────────────────────────────────────────
  await page.route('**/states', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }),
    });
  });

  // ── Mock tiers ───────────────────────────────────────────
  await page.route('**/tiers', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'tier_nano', name: 'Nano' }, { _id: 'tier_micro', name: 'Micro' }] }),
    });
  });

  // ── Mock categories ──────────────────────────────────────
  await page.route('**/categories', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }] }),
    });
  });

  // ── Mock languages ──────────────────────────────────────
  await page.route('**/languages', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'lang1', name: 'English' }] }),
    });
  });

  // ── Mock social media platforms ──────────────────────────
  await page.route('**/social-media', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { _id: 'sm_ig', name: 'Instagram', icon: 'bi bi-instagram', color: '#E1306C',
            handleLabel: 'Handle', followersLabel: 'Followers',
            contentTypes: [{ name: 'Post', price: 0 }, { name: 'Reel', price: 0 }] },
        ],
      }),
    });
  });

  // ── Mock app settings ────────────────────────────────────
  await page.route('**/auth/app-settings', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ preApproveInfluencers: false }),
    });
  });

  // ── Mock username check ──────────────────────────────────
  await page.route('**/users/check-username/**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ exists: false }),
    });
  });

  // ── Mock registration submit ─────────────────────────────
  await page.route('**/auth/register-influencer', async (route) => {
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Influencer registered successfully' }),
    });
  });

  // ── Go to registration page ──────────────────────────────
  await page.goto('/register-influencer');
  await page.waitForSelector('input[formControlName="name"]', { state: 'visible' });
  // Wait for Angular hydration to complete (SSR app, zoneless)
  await page.waitForTimeout(2000);

  // ════════════════════════ STEP 1 ════════════════════════
  await page.fill('input[formControlName="name"]', 'Test Influencer');
  await page.fill('input[formControlName="username"]', username);
  // Wait for async username validator to resolve
  await page.waitForTimeout(500);
  await page.fill('input[formControlName="phoneNumber"]', phone);
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Test@1234');
  await page.fill('input[formControlName="confirmPassword"]', 'Test@1234');

  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(500);
  await page.locator('body').click(); // trigger CD

  // Confirm step 2 is visible
  await page.waitForSelector('h2:has-text("Social Media & Media")', { timeout: 10000 });

  // ════════════════════════ STEP 2 ════════════════════════
  // Upload profile image
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(TEST_IMAGE);
  // Wait for imageCompression + FileReader.onload (uses ngZone.run + cdr.detectChanges)
  await page.waitForTimeout(2000);
  // Trigger CD by clicking body (name input is in step 1, not visible here)
  await page.locator('body').click();
  // Wait for preview image
  await expect(page.locator('img.preview-image').first()).toBeVisible({ timeout: 8000 });

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

  // Select language via ng-select (keyboard interaction for [appendTo]="'body'")
  const langSelect = page.locator('ng-select[formControlName="languages"]').first();
  await langSelect.scrollIntoViewIfNeeded();
  await langSelect.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('English');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
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

  // Select social media platform (platform card)
  const platformCard = page.locator('.platform-card').first();
  await platformCard.waitFor({ state: 'visible', timeout: 5000 });
  await platformCard.click();
  await page.waitForTimeout(500);

  // Fill platform details (uses ngModel, not formControlName)
  const handleInput = page.locator('input[placeholder="yourhandle"]').first();
  await handleInput.waitFor({ state: 'visible', timeout: 5000 });
  await handleInput.fill('testinfluencer');

  const followersInput = page.locator('input[placeholder="e.g. 12000"]').first();
  await followersInput.fill('5000');

  // Select tier from dropdown
  const tierSelect = page.locator('select').filter({ has: page.locator('option:has-text("Nano")') }).first();
  await tierSelect.selectOption('Nano');

  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(500);
  await page.locator('body').click(); // trigger CD

  // Confirm step 3 is visible
  await page.waitForSelector('h2:has-text("Professional Details")', { timeout: 10000 });

  // ════════════════════════ STEP 3 ════════════════════════
  // Select at least one contact method (hidden checkbox, click the card label)
  const contactCard = page.locator('.contact-card').first();
  await contactCard.waitFor({ state: 'visible', timeout: 5000 });
  await contactCard.click();

  // Fill starting price
  await page.fill('input[formControlName="promotionalPrice"]', '5000');

  // ── Submit ────────────────────────────────────────────────
  await page.click('button[type="submit"]');

  // Wait for Cloudinary upload mock + registration API mock + success modal
  await page.waitForTimeout(3000);
  await page.locator('body').click(); // trigger CD

  // Expect success modal
  await expect(page.locator('text=Successfully Registered'))
    .toBeVisible({ timeout: 15000 });
});

// ── Validation tests ──────────────────────────────────────────
test.describe('Influencer registration — step 1 validation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock config endpoints to prevent real API calls
    await page.route('**/states', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await page.route('**/tiers', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await page.route('**/categories', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await page.route('**/languages', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await page.route('**/social-media', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await page.route('**/auth/app-settings', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));
    await page.route('**/users/check-username/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exists: false }) }));

    await page.goto('/register-influencer');
    await page.waitForSelector('input[formControlName="name"]', { state: 'visible' });
    await page.waitForTimeout(2000);
  });

  test('Next Step is blocked when required fields are empty', async ({ page }) => {
    await page.click('button:has-text("Next Step")');
    // Should still be on step 1
    await expect(page.locator('h2:has-text("Basic Information")')).toBeVisible();
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'Test@1234');
    await page.fill('input[formControlName="confirmPassword"]', 'Different@9999');
    await page.locator('input[formControlName="confirmPassword"]').blur();
    await expect(page.locator('text=Passwords do not match')).toBeVisible({ timeout: 5000 });
  });
});

