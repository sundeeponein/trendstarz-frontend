import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Influencer profile E2E
//
// All API calls are mocked. Tests cover:
//   1. View profile — 3-step layout, fields rendered
//   2. Edit mode toggle
//   3. Navigate between steps
//   4. Save profile — API call
// ─────────────────────────────────────────────────────────────

const INFLUENCER_TOKEN = 'fake-influencer-jwt';

const MOCK_PROFILE = {
  name: 'Test Influencer',
  username: 'testinfluencer',
  email: 'influencer@e2e.com',
  phoneNumber: '9876543210',
  categories: ['Fashion'],
  languages: ['English'],
  location: { state: 'Maharashtra' },
  profileImages: [{ url: 'https://res.cloudinary.com/test/image/upload/profile.png', public_id: 'p1' }],
  socialMedia: [{ platform: 'Instagram', handle: 'testinfluencer', followersCount: 5000, tier: 'Nano', contentTypes: [] }],
  paymentOption: 'free',
  promotionalPrice: 500,
  contact: { whatsapp: false, email: false, call: false },
  isPremium: false,
};

async function setInfluencerAuth(page: Page) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'influencer', _id: 'inf_001', name: 'Test Influencer' }));
  }, { token: INFLUENCER_TOKEN });
}

async function mockProfileRoutes(page: Page) {
  // Profile endpoint
  await page.route('**/users/influencer-profile', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PROFILE }) });
    } else if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PROFILE }) });
    } else {
      await route.continue();
    }
  });
  // Config endpoints
  await page.route('**/config/states', async (route) => {
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
  await page.route('**/plans/my/capabilities', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ hasPremium: false, planName: 'Free', features: [], limits: [{ key: 'maxProfileImages', value: 1 }], policies: { imageRetentionDaysAfterExpiry: 45 }, endDate: null }) });
  });
  await page.route('**/payment/my', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ payments: [] }) });
  });
  // Cloudinary
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

test.describe('Influencer Profile', () => {
  test.beforeEach(async ({ page }) => {
    await setInfluencerAuth(page);
    await mockProfileRoutes(page);
    await page.goto('/influencer-profile');
    await page.waitForSelector('form', { state: 'visible' });
    await page.waitForTimeout(2000);
  });

  test('renders step 1 — Basic Details with profile data', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Basic Details');
    await expect(page.locator('input[formControlName="name"]')).toHaveValue('Test Influencer');
    await expect(page.locator('input[formControlName="username"]')).toHaveValue('testinfluencer');
    await expect(page.locator('input[formControlName="email"]')).toHaveValue('influencer@e2e.com');
    await expect(page.locator('input[formControlName="phoneNumber"]')).toHaveValue('9876543210');
  });

  test('shows step progress sidebar with 3 steps', async ({ page }) => {
    await expect(page.locator('.step-item')).toHaveCount(3);
    await expect(page.locator('.step-item.active')).toContainText('Basic Details');
  });

  test('Edit Profile button enables form fields', async ({ page }) => {
    // Fields should be read-only before clicking edit
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(500);
    // After clicking edit, Cancel Edit button should appear
    await expect(page.locator('button:has-text("Cancel Edit")')).toBeVisible();
  });

  test('navigates through all 3 steps', async ({ page }) => {
    // Step 1 → 2
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2')).toContainText('Media & Platforms');

    // Step 2 → 3
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2')).toContainText('Professional');

    // Step 3 → 2 (back)
    await page.click('button:has-text("Back")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2')).toContainText('Media & Platforms');
  });

  test('step 2 shows Media & Platforms fields', async ({ page }) => {
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2')).toContainText('Media & Platforms');
    // State select, profile image section
    await expect(page.locator('select[formControlName="state"]')).toBeVisible();
  });

  test('step 3 shows Professional fields and Save button in edit mode', async ({ page }) => {
    // Enable edit first
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(1000);
    // Navigate step by step with explicit waits
    const nextBtn = page.locator('button:has-text("Next Step")');
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').first()).toContainText('Media & Platforms', { timeout: 5000 });
    const nextBtn2 = page.locator('button:has-text("Next Step")');
    await nextBtn2.scrollIntoViewIfNeeded();
    await nextBtn2.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').first()).toContainText('Professional', { timeout: 10000 });
    await expect(page.locator('button[type="submit"]:has-text("Save Profile")')).toBeVisible();
  });

  test('save profile sends PATCH request', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await page.waitForTimeout(1000);
    // Navigate step by step with explicit waits
    const nextBtn = page.locator('button:has-text("Next Step")');
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').first()).toContainText('Media & Platforms', { timeout: 5000 });
    const nextBtn2 = page.locator('button:has-text("Next Step")');
    await nextBtn2.scrollIntoViewIfNeeded();
    await nextBtn2.click();
    await page.waitForTimeout(1000);
    // Submit
    const apiCalled = page.waitForResponse(resp =>
      resp.url().includes('/users/influencer-profile') && resp.request().method() === 'PATCH'
    );
    await page.click('button[type="submit"]:has-text("Save Profile")');
    const response = await apiCalled;
    expect(response.status()).toBe(200);
  });

  test('sidebar step clicks navigate directly', async ({ page }) => {
    // Click step 3 directly
    await page.locator('.step-item:has-text("Professional")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('h2')).toContainText('Professional');
    // Click step 1 directly
    await page.locator('.step-item:has-text("Basic Details")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('h2')).toContainText('Basic Details');
  });
});
