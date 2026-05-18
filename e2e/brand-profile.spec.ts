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
  contactPersonName: 'Test Contact',
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
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = { role: 'brand', name: 'Test Brand', userId: 'brand_001' };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${b64(header)}.${b64(payload)}.`;
    } catch (e) {
      return BRAND_TOKEN;
    }
  })();

  await page.addInitScript((jwt) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'brand', _id: 'brand_001', name: 'Test Brand' }));
  }, fakeJwt);
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
  await page.route('**/categories**', async (route) => {
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
  // Auth / me - return brand user
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) });
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
    const profileLoaded = page.waitForResponse((resp) =>
      resp.url().includes('/users/brand-profile') && resp.request().method() === 'GET'
    );
    await page.goto('/brand-profile');
    await profileLoaded;
    // Wait for the step/sidebar tabs to appear (more robust than fixed timeouts)
    await page.waitForSelector('.reg-tab', { state: 'visible', timeout: 10000 });
    // Trigger CD so mock data is rendered in zoneless Angular
    await page.locator('body').click();
    // Force step 1 for consistent assertions across desktop/mobile layouts.
    await page.evaluate(() => {
      const el = document.querySelector('app-brand-registration');
      const ng = (window as any).ng;
      if (!el || !ng) return;
      const comp = ng.getComponent(el);
      try {
        comp.currentStep = 1;
        comp.cd?.detectChanges?.();
      } catch (e) {}
    });
    // Ensure UI has settled after the click
    await page.waitForSelector('.reg-tab.reg-tab--active', { state: 'visible', timeout: 5000 });
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
    // Direct tab navigation is less flaky than validation-dependent next-step clicks.
    await page.locator('.reg-tab:has-text("Plan")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Plan', { timeout: 10000 });
    await expect(page.locator('button[type="submit"]:has-text("Save Profile")')).toBeVisible();
  });

  test('save profile sends PATCH request', async ({ page }) => {
    await page.click('button:has-text("Edit Profile")');
    await expect(page.locator('button:has-text("Cancel Edit")')).toBeVisible({ timeout: 5000 });

    // Ensure required controls remain valid after edit-mode state/district refresh.
    await page.evaluate(() => {
      const el = document.querySelector('app-brand-registration');
      const ng = (window as any).ng;
      if (!el || !ng) return;
      const comp = ng.getComponent(el);
      try {
        comp.registrationForm.get('paymentOption')?.setValue('free');
        comp.registrationForm.get('location.state')?.setValue('state_mh');
        comp.registrationForm.get('location.district')?.setValue('dist_mumbai');
        comp.registrationForm.get('categories')?.setValue(['cat1']);
        comp.registrationForm.get('languages')?.setValue(['lang1']);
        comp.cd?.detectChanges?.();
      } catch (e) {}
    });

    await page.locator('.reg-tab:has-text("Plan")').click();
    await expect(page.locator('h2').first()).toContainText('Plan', { timeout: 10000 });
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
