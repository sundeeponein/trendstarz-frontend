import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Brand profile E2E
//
// All API calls are mocked. Tests cover:
//   1. View profile — 3-step layout, fields rendered
//   2. Edit mode toggle
//   3. Navigate between steps
//   4. Save profile — API call
// ─────────────────────────────────────────────────────────────

const BRAND_TOKEN = 'fake-brand-jwt';

const MOCK_BRAND_PROFILE = {
  brandName: 'Test Brand',
  brandUsername: 'testbrand',
  email: 'brand@e2e.com',
  phoneNumber: '9876543220',
  categories: ['Fashion'],
  languages: ['English'],
  location: { state: 'Maharashtra', district: 'Mumbai' },
  brandLogo: [{ url: 'https://res.cloudinary.com/test/image/upload/logo.png', public_id: 'l1' }],
  website: 'https://testbrand.com',
  googleMapAddress: 'Mumbai, Maharashtra',
  socialMedia: [],
  products: [],
  paymentOption: 'free',
  promotionalPrice: 1000,
  contact: { whatsapp: false, email: false, call: false },
  isPremium: false,
};

async function setBrandAuth(page: Page) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'brand', _id: 'brand_001', name: 'Test Brand' }));
  }, { token: BRAND_TOKEN });
}

async function mockBrandProfileRoutes(page: Page) {
  await page.route('**/users/brand-profile', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_BRAND_PROFILE }) });
    } else if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_BRAND_PROFILE }) });
    } else {
      await route.continue();
    }
  });
  await page.route('**/states', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }) });
  });
  await page.route('**/tiers', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'tier1', name: 'Nano' }] }) });
  });
  await page.route('**/social-media', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'sm_ig', name: 'Instagram', icon: 'bi bi-instagram', color: '#E1306C', contentTypes: [{ key: 'post', label: 'Post', name: 'Post', price: 0, visible: true }] }] }) });
  });
  await page.route('**/languages', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'lang1', name: 'English' }] }) });
  });
  await page.route('**/categories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }] }) });
  });
  await page.route('**/districts**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'dist_mumbai', name: 'Mumbai' }, { _id: 'dist_pune', name: 'Pune' }] }) });
  });
  await page.route('**/plans/my/capabilities', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ hasPremium: false, planName: 'Free', features: [], limits: [{ key: 'maxProfileImages', value: 1 }], policies: { imageRetentionDaysAfterExpiry: 45 }, endDate: null }) });
  });
  await page.route('**/payment/my', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ payments: [] }) });
  });
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/test/image/upload/img.png', public_id: 'e2e_id' }) });
  });
  // Username uniqueness check
  await page.route('**/users/check-username/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ exists: false }) });
  });
}

test.describe('Brand Profile', () => {
  test.beforeEach(async ({ page }) => {
    await setBrandAuth(page);
    await mockBrandProfileRoutes(page);
    await page.goto('/brand-profile');
    await page.waitForSelector('form', { state: 'visible' });
    await page.waitForTimeout(2000);
    // Trigger CD so mock data is rendered in zoneless Angular
    await page.locator('body').click();
    await page.waitForTimeout(500);
  });

  test('renders step 1 — Brand Basics with profile data', async ({ page }) => {
    await expect(page.locator('h2').first()).toContainText('Brand Info');
    await expect(page.locator('input[formControlName="brandName"]')).toHaveValue('Test Brand');
    await expect(page.locator('input[formControlName="brandUsername"]')).toHaveValue('testbrand');
    await expect(page.locator('input[formControlName="email"]')).toHaveValue('brand@e2e.com');
    await expect(page.locator('input[formControlName="phoneNumber"]')).toHaveValue('9876543220');
  });

  test('shows step progress sidebar with 3 steps', async ({ page }) => {
    await expect(page.locator('.reg-tab')).toHaveCount(3);
    await expect(page.locator('.reg-tab.reg-tab--active')).toContainText('Brand Info');
  });

  test('Edit Profile button enables form fields', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("Cancel Edit")')).toBeVisible();
  });

  test('navigates through all 3 steps', async ({ page }) => {
    // Step 1 → 2
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Location & Media');

    // Step 2 → 3
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Plan');

    // Step 3 → 2 (back)
    await page.click('button:has-text("Back")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Location & Media');
  });

  test('step 2 shows Media & Discovery fields', async ({ page }) => {
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Location & Media');
    await expect(page.locator('select[formControlName="state"]')).toBeVisible();
  });

  test('step 3 shows Professional fields and Save button in edit mode', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(1000);
    // Navigate step by step with explicit waits
    const nextBtn = page.locator('button:has-text("Next Step")');
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').first()).toContainText('Location & Media', { timeout: 5000 });
    const nextBtn2 = page.locator('button:has-text("Next Step")');
    await nextBtn2.scrollIntoViewIfNeeded();
    await nextBtn2.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').first()).toContainText('Plan', { timeout: 10000 });
    await expect(page.locator('button[type="submit"]:has-text("Save Profile")')).toBeVisible();
  });

  test('save profile sends PATCH request', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(1000);
    const nextBtn = page.locator('button:has-text("Next Step")');
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').first()).toContainText('Location & Media', { timeout: 5000 });
    const nextBtn2 = page.locator('button:has-text("Next Step")');
    await nextBtn2.scrollIntoViewIfNeeded();
    await nextBtn2.click();
    await page.waitForTimeout(1000);
    const apiCalled = page.waitForResponse(resp =>
      resp.url().includes('/users/brand-profile') && resp.request().method() === 'PATCH'
    );
    await page.click('button[type="submit"]:has-text("Save Profile")');
    const response = await apiCalled;
    expect(response.status()).toBe(200);
  });

  test('sidebar step clicks navigate directly', async ({ page }) => {
    await page.locator('.reg-tab:has-text("Plan")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Plan');
    await page.locator('.reg-tab:has-text("Brand Info")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Brand Info');
  });
});
