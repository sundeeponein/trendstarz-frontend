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
  // page console forwarding removed for cleaner CI output

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

  // ── Mock districts ───────────────────────────────────────
  await page.route('**/districts**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'dist_mumbai', name: 'Mumbai' }] }),
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

  // ── Mock profile image upload (current submit flow) ─────
  await page.route('**/auth/upload-image', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          url: 'https://res.cloudinary.com/test/image/upload/influencer-img.png',
          public_id: 'e2e_influencer_img',
        },
      }),
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

  // Upload profile image (required for step 1 completion)
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(TEST_IMAGE);
  // Wait for imageCompression + FileReader.onload (uses ngZone.run + cdr.detectChanges)
  await page.waitForTimeout(2000);
  await page.locator('body').click();
  await expect(page.locator('img.profile-upload-preview').first()).toBeVisible({ timeout: 8000 });

  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(500);
  await page.locator('body').click(); // trigger CD

  // Confirm step 2 is visible — state select is specific to step 2
  await page.waitForSelector('select[formcontrolname="state"]', { state: 'visible', timeout: 10000 });

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

  // Wait for districts to load after state change, then select district
  await page.waitForTimeout(500);
  const districtSelect = page.locator('[formgroupname="location"] select[formcontrolname="district"], select[formcontrolname="district"]').first();
  await districtSelect.waitFor({ state: 'visible' });
  const districtOptions = await districtSelect.locator('option').all();
  for (const opt of districtOptions) {
    const val = await opt.getAttribute('value');
    if (val && val !== '') {
      await districtSelect.selectOption(val);
      break;
    }
  }

  // Select language via chip click
  const langChip = page.locator('.chip:has-text("English")').first();
  await langChip.scrollIntoViewIfNeeded();
  await langChip.click();
  await page.waitForTimeout(200);

  // Select category via chip click
  const catChip = page.locator('.chip:has-text("Fashion")').first();
  await catChip.scrollIntoViewIfNeeded();
  await catChip.click();
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

  // Select tier from dropdown
  const tierSelect = page.locator('select').filter({ has: page.locator('option:has-text("Nano")') }).first();
  await tierSelect.selectOption('Nano');

  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(500);
  await page.locator('body').click(); // trigger CD

  // Confirm step 3 is visible
  await page.waitForSelector('h2:has-text("Plan")', { timeout: 10000 });

  // ════════════════════════ STEP 3 ════════════════════════
  // Give Angular time to hydrate step 3 fully before interacting
  await page.waitForTimeout(2000);

  // Select WhatsApp contact method — click first contact-card
  const waCard = page.locator('.contact-card').nth(0);
  await waCard.scrollIntoViewIfNeeded();
  await waCard.click();
  await page.waitForTimeout(500);

  // Fill starting price
  const priceInput = page.locator('input[placeholder="Enter your starting price"]');
  await priceInput.scrollIntoViewIfNeeded();
  await priceInput.click();
  await priceInput.pressSequentially('5000', { delay: 50 });
  await page.waitForTimeout(500);

  // Verify form values in the browser context before submit
  await page.waitForTimeout(200);

  // ── Submit ────────────────────────────────────────────────
  const submitPromise = page.waitForResponse(
    (resp) => resp.url().includes('/auth/register-influencer') && resp.status() === 201,
    { timeout: 15000 },
  );
  await page.click('button[type="submit"]');
  await submitPromise;

  // Success response arrived — poll for modal DOM, nudging zoneless CD
  const successModal = page.locator('.reg-success-modal, .reg-success-modal-overlay');
  let modalVisible = false;
  for (let i = 0; i < 30 && !modalVisible; i++) {
    await page.waitForTimeout(500);
    await page.mouse.move(5 + i, 5 + i);
    try { modalVisible = await successModal.first().isVisible(); } catch { modalVisible = false; }
  }

  // Expect success modal
  await expect(successModal.first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Successfully Registered')).toBeVisible();
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
    await expect(page.locator('h2:has-text("Profile")')).toBeVisible();
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.fill('input[formControlName="password"]', 'Test@1234');
    await page.fill('input[formControlName="confirmPassword"]', 'Different@9999');
    await page.locator('input[formControlName="confirmPassword"]').blur();
    await expect(page.locator('text=Passwords do not match')).toBeVisible({ timeout: 5000 });
  });
});

