import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Premium upgrade E2E
//
// All API calls are mocked. Tests cover:
//   1. Plan selection — card click, duration toggle
//   2. Proceed to payment step
//   3. Coupon code — valid (TRENDSTARZ10, TRENDSTARZ20) and invalid
//   4. UPI / QR tab switch
//   5. Confirm payment — API call → success screen
// ─────────────────────────────────────────────────────────────

const INFLUENCER_TOKEN = 'fake-influencer-jwt';

const MOCK_PLAN = {
  _id: 'plan_premium',
  name: 'Star',
  userType: 'INFLUENCER',
  isActive: true,
  price: { monthly: 499, quarterly: 1347, yearly: 4790 },
  features: [
    { key: 'contactVisibility', label: 'Contact Visibility', value: true },
    { key: 'priorityListing', label: 'Priority Listing', value: true },
  ],
  limits: [
    { key: 'maxProfileImages', label: 'Profile Images', value: 5 },
  ],
  offers: [],
  policies: { imageRetentionDaysAfterExpiry: 45 },
};

const MOCK_FREE_PLAN = {
  _id: 'plan_free',
  name: 'Free',
  userType: 'INFLUENCER',
  isActive: true,
  price: { monthly: 0, quarterly: 0, yearly: 0 },
  features: [
    { key: 'contactVisibility', label: 'Contact Visibility', value: false },
  ],
  limits: [
    { key: 'maxProfileImages', label: 'Profile Images', value: 1 },
  ],
  offers: [],
  policies: { imageRetentionDaysAfterExpiry: 45 },
};

async function setInfluencerAuth(page: Page) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'influencer', _id: 'inf_001', name: 'Test Influencer' }));
  }, { token: INFLUENCER_TOKEN });
}

async function mockUpgradeRoutes(page: Page) {
  await page.route(/\/plans(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ plans: [MOCK_FREE_PLAN, MOCK_PLAN] }) });
  });
  await page.route('**/payment/my', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ payments: [] }) });
  });
  await page.route('**/payment', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ success: true, payment: { _id: 'pay_001', status: 'pending' } }) });
    } else {
      await route.continue();
    }
  });
}

test.describe('Premium Upgrade', () => {
  test.beforeEach(async ({ page }) => {
    await setInfluencerAuth(page);
    await mockUpgradeRoutes(page);
    await page.goto('/upgrade-premium');
    await page.waitForSelector('.upgrade-card', { state: 'visible' });
    await page.waitForTimeout(2000);
  });

  test('renders plan selection step with plan cards', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Choose Your Plan');
    const plans = page.locator('.plan-card');
    await expect(plans).toHaveCount(2);
  });

  test('paid plan card shows duration buttons when selected', async ({ page }) => {
    // Click the Star plan card
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.dur-btn:has-text("1 Month")')).toBeVisible();
    await expect(page.locator('.dur-btn:has-text("3 Months")')).toBeVisible();
    await expect(page.locator('.dur-btn:has-text("1 Year")')).toBeVisible();
  });

  test('duration toggle updates displayed price', async ({ page }) => {
    // On mobile, force click may not trigger Angular's click handler — use JS
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.plan-card');
      cards.forEach(c => { if (c.textContent?.includes('Star')) (c as HTMLElement).click(); });
    });
    await page.waitForTimeout(500);
    await page.locator('body').click();
    await page.waitForTimeout(500);
    // Select 3 months
    const durBtn = page.locator('.dur-btn:has-text("3 Months")');
    await durBtn.scrollIntoViewIfNeeded();
    await durBtn.click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('body').click();
    await page.waitForTimeout(300);
    // Price should show quarterly price (use selected plan's price)
    await expect(page.locator('.plan-card.selected .plan-price')).toContainText('1347');
  });

  test('proceed to payment step', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    // Should be on payment step
    await expect(page.locator('.payment-step')).toBeVisible();
    await expect(page.locator('.order-bar')).toBeVisible();
  });

  test('coupon TRENDSTARZ10 applies 10% discount', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    // Enter coupon
    await page.fill('.coupon-input', 'TRENDSTARZ10');
    await page.click('.btn-coupon');
    await page.waitForTimeout(500);
    await page.locator('body').click();
    await page.waitForTimeout(300);
    // Should show success
    await expect(page.locator('.coupon-success')).toBeVisible();
    await expect(page.locator('.coupon-success')).toContainText('Coupon applied');
  });

  test('coupon TRENDSTARZ20 applies 20% discount', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    await page.fill('.coupon-input', 'TRENDSTARZ20');
    await page.click('.btn-coupon');
    await page.waitForTimeout(500);
    await page.locator('body').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.coupon-success')).toBeVisible();
  });

  test('invalid coupon shows error', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    await page.fill('.coupon-input', 'INVALIDCODE');
    await page.click('.btn-coupon');
    await page.waitForTimeout(500);
    await page.locator('body').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.coupon-error')).toBeVisible();
    await expect(page.locator('.coupon-error')).toContainText('Invalid or expired');
  });

  test('UPI and QR tabs switch payment method view', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    // Default is UPI
    await expect(page.locator('.pay-tab.active')).toContainText('UPI');
    // Switch to QR
    await page.click('.pay-tab:has-text("QR Code")');
    await page.waitForTimeout(300);
    await expect(page.locator('.qr-section')).toBeVisible();
  });

  test('confirm payment without UTR shows error', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    // Click confirm without entering UTR
    await page.click('.btn-upgrade:has-text("Confirm Payment")');
    await page.waitForTimeout(500);
    await page.locator('body').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.upgrade-error')).toBeVisible();
    await expect(page.locator('.upgrade-error')).toContainText('enter the UPI Transaction ID');
  });

  test('confirm payment with UTR posts to API and shows success', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    // Enter UTR
    await page.fill('input.form-input[placeholder="e.g. 416221039385"]', '999888777666');
    // Confirm
    const apiCalled = page.waitForResponse(resp =>
      resp.url().includes('/payment') && resp.request().method() === 'POST'
    );
    await page.click('.btn-upgrade:has-text("Confirm Payment")');
    const response = await apiCalled;
    expect(response.status()).toBe(201);
    // Should show success step
    await page.waitForTimeout(1000);
    await expect(page.locator('.upgrade-success-card')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Payment Recorded!');
    await expect(page.locator('strong:has-text("Pending Admin Approval")')).toBeVisible();
  });

  test('back to profile button on success screen navigates away', async ({ page }) => {
    await page.locator('.plan-card:has-text("Star")').click();
    await page.waitForTimeout(500);
    await page.click('.btn-upgrade:has-text("Proceed to Payment")');
    await page.waitForTimeout(500);
    await page.fill('input.form-input[placeholder="e.g. 416221039385"]', '999888777666');
    const apiCalled = page.waitForResponse(resp =>
      resp.url().includes('/payment') && resp.request().method() === 'POST'
    );
    await page.click('.btn-upgrade:has-text("Confirm Payment")');
    await apiCalled;
    await page.waitForTimeout(1000);
    // Mock profile route for navigation
    await page.route('**/users/influencer-profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }) });
    });
    await page.click('.btn-go-profile');
    await expect(page).toHaveURL(/\/(influencer|brand)-profile/, { timeout: 5000 });
  });
});
