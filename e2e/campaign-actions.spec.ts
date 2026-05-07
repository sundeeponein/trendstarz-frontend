import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Slice D + E: Brand-side fulfillment + remind/withdraw/report
//
// All API calls are mocked. Tests cover:
//   1. Bucket chips render counts from invite list
//   2. Remind button → POST /campaign-invites/:id/remind
//   3. Withdraw button → POST /campaign-invites/:id/withdraw
//   4. Report button → POST /campaign-invites/:id/report
//   5. Fulfillment modal (product) → PATCH /campaign-invites/:id/fulfillment/product
// ─────────────────────────────────────────────────────────────

const BRAND_TOKEN = 'fake-brand-jwt';

const PRODUCT_CAMPAIGN = {
  _id: 'camp_prod_001',
  title: 'Product Collab Campaign',
  description: 'Send product to influencer',
  status: 'active',
  campaignType: 'product',
  timelineStart: '2026-04-15',
  timelineEnd: '2026-05-15',
  budgetMin: 0,
  budgetMax: 0,
  brandId: 'brand_001',
  platforms: [],
  categories: [],
  pricePerInfluencer: 0,
  maxInfluencers: 5,
};

const PAID_CAMPAIGN = {
  ...PRODUCT_CAMPAIGN,
  _id: 'camp_paid_001',
  title: 'Paid Collab Campaign',
  campaignType: 'paid',
  pricePerInfluencer: 1500,
};

// Pending invite — eligible for Remind + Withdraw
const PENDING_INVITE = {
  _id: 'invite_pending_001',
  campaignId: 'camp_paid_001',
  influencerId: { _id: 'inf_001', name: 'Test Influencer A', username: 'inf_a' },
  status: 'pending',
  unlocked: false,
  remindersSent: 0,
};

// Accepted invite — eligible for Report (and Fulfillment if product)
const ACCEPTED_INVITE = {
  _id: 'invite_accepted_001',
  campaignId: 'camp_paid_001',
  influencerId: { _id: 'inf_002', name: 'Test Influencer B', username: 'inf_b' },
  status: 'accepted',
  unlocked: true,
  remindersSent: 0,
};

// Accepted invite for the PRODUCT campaign — eligible for Shipping fulfillment
const PRODUCT_ACCEPTED_INVITE = {
  _id: 'invite_product_001',
  campaignId: 'camp_prod_001',
  influencerId: { _id: 'inf_003', name: 'Test Influencer C', username: 'inf_c' },
  status: 'accepted',
  unlocked: true,
  remindersSent: 0,
  productFulfillment: { status: 'pending' },
};

async function setBrandAuth(page: Page) {
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = { role: 'brand', name: 'Test Brand', userId: 'brand_001' };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60;
      const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${b64(header)}.${b64(payload)}.`;
    } catch (e) {
      return BRAND_TOKEN;
    }
  })();

  await page.addInitScript((jwt) => {
    localStorage.setItem('token', jwt as any);
    localStorage.setItem('userRole', 'brand');
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'brand', _id: 'brand_001', name: 'Test Brand' }));
  }, fakeJwt);
}

async function mockBaseRoutes(page: Page) {
  await page.route('**/config/states', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }) }));
  await page.route('**/categories', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }] }) }));
  await page.route('**/config/platforms', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ name: 'Instagram' }] }) }));
  await page.route('**/social-media', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'sm_ig', name: 'Instagram', icon: 'bi bi-instagram', color: '#E1306C', contentTypes: [] }] }) }));
  await page.route('**/languages', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'lang1', name: 'English' }] }) }));
  await page.route('**/users/brand-profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { brand: { _id: 'brand_001', brandName: 'TestBrand', brandUsername: 'testbrand' } } }) }));
  // Auth / me - brand user
  await page.route('**/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) }));
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) }));
  await page.route('**/users/influencers', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/plans/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          hasPremium: true,
          planName: 'Brand Pro',
          features: [{ key: 'viewContactDetails', value: true }],
          limits: [
            { key: 'maxActiveCampaigns', value: 10 },
            { key: 'maxInvitesPerCampaign', value: 10 },
          ],
          policies: { imageRetentionDaysAfterExpiry: 45 },
          endDate: null,
        },
      }) }));
}

// ─────────────────────────────────────────────────────────────

test.describe('Brand — Slice E actions (Remind / Withdraw / Report)', () => {
  test('renders bucket chips and triggers Remind via API', async ({ page }) => {
    await setBrandAuth(page);
    await mockBaseRoutes(page);

    await page.route(/\/api\/campaigns(\?|$)/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PAID_CAMPAIGN] }) }));
    await page.route('**/campaigns/brand-name/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PAID_CAMPAIGN] }) }));

    await page.route('**/campaign-invites/campaign/camp_paid_001**', (r) => {
      const url = r.request().url();
      if (url.includes('/submissions')) {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PENDING_INVITE, ACCEPTED_INVITE] }) });
    });

    let remindCalled = false;
    await page.route('**/campaign-invites/invite_pending_001/remind', (r) => {
      remindCalled = true;
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, remindedAt: new Date().toISOString(), remindersSent: 1 }) });
    });

    await page.goto('/campaigns');
    // Trigger change detection and allow the list to render
    await page.waitForTimeout(500);
    await page.locator('body').click();
    await page.waitForTimeout(1500);

    const inviteBtn = page.locator('.btn-invite').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 15000 });
    await inviteBtn.click();

    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // Bucket chips: at least one each (pending=PENDING_INVITE, accepted=ACCEPTED_INVITE which is unlocked)
    await expect(page.locator('.bucket-chip.bucket-pending')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.bucket-chip.bucket-accepted')).toBeVisible();

    // Remind button only shown for the pending row
    const remindBtn = page.locator('.btn-action.btn-remind').first();
    await expect(remindBtn).toBeVisible();
    await remindBtn.click({ force: true });

    await page.waitForTimeout(500);
    expect(remindCalled).toBe(true);
  });

  test('Withdraw button calls withdraw endpoint after confirm', async ({ page }) => {
    await setBrandAuth(page);
    await mockBaseRoutes(page);

    // Auto-accept native confirm/prompt dialogs.
    page.on('dialog', (d) => d.accept('No longer needed'));

    await page.route(/\/api\/campaigns(\?|$)/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PAID_CAMPAIGN] }) }));
    await page.route('**/campaigns/brand-name/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PAID_CAMPAIGN] }) }));
    await page.route('**/campaign-invites/campaign/camp_paid_001**', (r) => {
      if (r.request().url().includes('/submissions')) {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PENDING_INVITE] }) });
    });

    let withdrawCalled = false;
    let withdrawBody: any = null;
    await page.route('**/campaign-invites/invite_pending_001/withdraw', async (r) => {
      withdrawCalled = true;
      withdrawBody = r.request().postDataJSON();
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'withdrawn' }) });
    });

    await page.goto('/campaigns');
    await page.waitForTimeout(3000);
    const inviteBtn = page.locator('.btn-invite').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 15000 });
    await inviteBtn.click();
    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);

    const withdrawBtn = page.locator('.btn-action.btn-withdraw').first();
    await expect(withdrawBtn).toBeVisible({ timeout: 5000 });
    await withdrawBtn.click({ force: true });

    await page.waitForTimeout(500);
    expect(withdrawCalled).toBe(true);
    expect(withdrawBody?.reason).toBe('No longer needed');
  });

  test('Report button calls report endpoint with reason', async ({ page }) => {
    await setBrandAuth(page);
    await mockBaseRoutes(page);

    page.on('dialog', (d) => d.accept('Influencer never delivered the post'));

    await page.route(/\/api\/campaigns(\?|$)/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PAID_CAMPAIGN] }) }));
    await page.route('**/campaigns/brand-name/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PAID_CAMPAIGN] }) }));
    await page.route('**/campaign-invites/campaign/camp_paid_001**', (r) => {
      if (r.request().url().includes('/submissions')) {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [ACCEPTED_INVITE] }) });
    });

    let reportCalled = false;
    let reportBody: any = null;
    await page.route('**/campaign-invites/invite_accepted_001/report', async (r) => {
      reportCalled = true;
      reportBody = r.request().postDataJSON();
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'disputed' }) });
    });

    await page.goto('/campaigns');
    const inviteBtn = page.locator('.btn-invite').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 15000 });
    await inviteBtn.click();
    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });
    await page.waitForSelector('.btn-action.btn-report', { state: 'visible', timeout: 5000 });

    const reportBtn = page.locator('.btn-action.btn-report').first();
    await expect(reportBtn).toBeVisible({ timeout: 5000 });
    await reportBtn.scrollIntoViewIfNeeded();
    await reportBtn.click({ force: true });
    await expect.poll(() => reportCalled, { timeout: 10000 }).toBe(true);
    expect(reportCalled).toBe(true);
    expect(reportBody?.reason).toContain('never delivered');
  });
});

test.describe('Brand — Slice D fulfillment (product shipping)', () => {
  test('opens fulfillment modal and saves shipping info', async ({ page }) => {
    await setBrandAuth(page);
    await mockBaseRoutes(page);

    await page.route(/\/api\/campaigns(\?|$)/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PRODUCT_CAMPAIGN] }) }));
    await page.route('**/campaigns/brand-name/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PRODUCT_CAMPAIGN] }) }));
    await page.route('**/campaign-invites/campaign/camp_prod_001**', (r) => {
      if (r.request().url().includes('/submissions')) {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [PRODUCT_ACCEPTED_INVITE] }) });
    });

    let fulfillCalled = false;
    let fulfillBody: any = null;
    await page.route('**/campaign-invites/invite_product_001/fulfillment/product', async (r) => {
      fulfillCalled = true;
      fulfillBody = r.request().postDataJSON();
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, productFulfillment: { ...fulfillBody, status: 'shipped' } }) });
    });

    await page.goto('/campaigns');
    await page.waitForTimeout(3000);
    const inviteBtn = page.locator('.btn-invite').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 15000 });
    await inviteBtn.click();
    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // Fulfillment button is labeled differently for product campaigns.
    const fulfillBtn = page.locator('.btn-action.btn-fulfill').first();
    await expect(fulfillBtn).toBeVisible({ timeout: 5000 });
    await fulfillBtn.click({ force: true });

    await expect(page.locator('.fulfill-modal')).toBeVisible({ timeout: 5000 });

    await page.fill('.fulfill-modal input[placeholder*="BlueDart"]', 'BlueDart');
    await page.fill('.fulfill-modal input[placeholder*="AWB"]', 'AWB-12345');
    await page.selectOption('.fulfill-modal select', 'shipped');

    const saveBtn = page.locator('.fulfill-footer .btn-primary');
    await saveBtn.click({ force: true });

    await page.waitForTimeout(800);
    expect(fulfillCalled).toBe(true);
    expect(fulfillBody?.courier).toBe('BlueDart');
    expect(fulfillBody?.trackingId).toBe('AWB-12345');
    expect(fulfillBody?.status).toBe('shipped');
  });
});
