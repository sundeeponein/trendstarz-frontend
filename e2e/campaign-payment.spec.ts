import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Campaign Payment Flow — Playwright E2E (mocked API)
//
// Covers:
//   1. Campaign Payment page loads with Summary + UPI tabs
//   2. Brand submits UTR proof → success state
//   3. Status tab: shows proof_submitted state
//   4. Status tab: shows verified / payment_confirmed state
//   5. Status tab: shows rejected state with resubmit option
//   6. Status tab: shows frozen (dispute open) alert
//   7. Status tab: shows paid / completed state
// ─────────────────────────────────────────────────────────────

const BRAND_TOKEN = 'fake-brand-jwt';
const CAMPAIGN_ID = 'camp_paid_001';

const BASE_CAMPAIGN = {
  _id: CAMPAIGN_ID,
  title: 'Summer Paid Collab',
  campaignType: 'paid_collab',
  status: 'active',
  pricePerInfluencer: 3000,
  maxInfluencers: 2,
  brandId: 'brand_001',
  platforms: [],
  categories: [],
};

const APP_SETTINGS = {
  platformFeeEnabled: false,
  platformFeePercent: 0,
  gstPercent: 0,
  paymentUpiId: 'trendstarzin@kotak',
};

async function loginAsBrand(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake-brand-jwt');
    localStorage.setItem('userRole', 'brand');
    localStorage.setItem('loginTimestamp', Date.now().toString());
  });
}

async function mockBaseRoutes(page: Page) {
  await page.route('**/auth/app-settings', (r) =>
    r.fulfill({ json: { data: APP_SETTINGS } })
  );
  await page.route('**/users/brand-profile', (r) =>
    r.fulfill({ json: { data: { _id: 'brand_001', businessName: 'TestBrand', email: 'brand@test.com' } } })
  );
  await page.route(`**/campaigns/${CAMPAIGN_ID}`, (r) =>
    r.fulfill({ json: { data: BASE_CAMPAIGN } })
  );
  await page.route(`**/campaigns/brand-name/${CAMPAIGN_ID}`, (r) =>
    r.fulfill({ json: { data: BASE_CAMPAIGN } })
  );
}

// ─── Test 1: Page loads with Summary and UPI tabs ────────────
test('campaign-payment: page loads with tabs and UPI ID', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({ json: { data: [] } })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);

  await expect(page.getByText('Summer Paid Collab')).toBeVisible();
  await expect(page.getByText('Summary')).toBeVisible();
  await expect(page.getByText('Pay via UPI')).toBeVisible();
  await expect(page.getByText('Status')).toBeVisible();
});

// ─── Test 2: UPI tab shows UPI ID and copy button ────────────
test('campaign-payment: UPI tab displays platform UPI ID', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({ json: { data: [] } })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /pay via upi/i }).click();

  await expect(page.getByText('trendstarzin@kotak')).toBeVisible();
  await expect(page.getByRole('button', { name: /copy/i })).toBeVisible();
});

// ─── Test 3: Brand submits UTR proof ─────────────────────────
test('campaign-payment: brand submits UTR reference successfully', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({ json: { data: [] } })
  );
  await page.route(`**/campaign-transactions/${CAMPAIGN_ID}/submit-proof`, (r) =>
    r.fulfill({ json: { data: { _id: 'tx_001', collectionStatus: 'proof_submitted', utrReference: 'UTR123456789' } } })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /pay via upi/i }).click();

  const utrInput = page.getByPlaceholder(/utr|reference|transaction id/i).first();
  await utrInput.fill('UTR123456789');
  await page.getByRole('button', { name: /submit proof|i have paid/i }).click();

  await expect(page.getByText(/submitted|received|verif/i)).toBeVisible();
});

// ─── Test 4: Status tab — proof_submitted state ───────────────
test('campaign-payment: status tab shows pending verification state', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({
      json: {
        data: [{
          _id: 'tx_001',
          campaignId: CAMPAIGN_ID,
          collectionStatus: 'proof_submitted',
          payoutStatus: 'pending',
          disputeStatus: 'none',
          amountPaise: 300000,
          utrReference: 'UTR123456789',
          gateway: 'manual_upi',
          createdAt: new Date().toISOString(),
        }],
      },
    })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /status/i }).click();

  await expect(page.getByText(/proof_submitted|verif.*progress|under review/i)).toBeVisible();
});

// ─── Test 5: Status tab — verified / payment_confirmed ────────
test('campaign-payment: status tab shows verified state', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({
      json: {
        data: [{
          _id: 'tx_002',
          campaignId: CAMPAIGN_ID,
          collectionStatus: 'verified',
          payoutStatus: 'pending',
          disputeStatus: 'none',
          amountPaise: 300000,
          utrReference: 'UTR123456789',
          gateway: 'manual_upi',
          createdAt: new Date().toISOString(),
        }],
      },
    })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /status/i }).click();

  await expect(page.getByText(/verified|confirmed|payment.*confirmed/i)).toBeVisible();
});

// ─── Test 6: Status tab — rejected state with resubmit ────────
test('campaign-payment: status tab shows rejected state and resubmit option', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({
      json: {
        data: [{
          _id: 'tx_003',
          campaignId: CAMPAIGN_ID,
          collectionStatus: 'failed',
          payoutStatus: 'pending',
          disputeStatus: 'none',
          amountPaise: 300000,
          utrReference: 'UTR_WRONG',
          gateway: 'manual_upi',
          createdAt: new Date().toISOString(),
        }],
      },
    })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /status/i }).click();

  await expect(page.getByText(/reject|fail|could not verify/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /resubmit|try again/i })).toBeVisible();
});

// ─── Test 7: Status tab — frozen dispute alert ────────────────
test('campaign-payment: status tab shows dispute-open frozen alert', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({
      json: {
        data: [{
          _id: 'tx_004',
          campaignId: CAMPAIGN_ID,
          collectionStatus: 'verified',
          payoutStatus: 'frozen',
          disputeStatus: 'open',
          disputeReason: 'Content does not match brief',
          amountPaise: 300000,
          utrReference: 'UTR123456789',
          gateway: 'manual_upi',
          createdAt: new Date().toISOString(),
        }],
      },
    })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /status/i }).click();

  await expect(page.getByText(/dispute|frozen/i)).toBeVisible();
});

// ─── Test 8: Status tab — payout paid / completed ────────────
test('campaign-payment: status tab shows payout paid completed state', async ({ page }) => {
  await loginAsBrand(page);
  await mockBaseRoutes(page);

  await page.route(`**/campaign-transactions/campaign/${CAMPAIGN_ID}/status`, (r) =>
    r.fulfill({
      json: {
        data: [{
          _id: 'tx_005',
          campaignId: CAMPAIGN_ID,
          collectionStatus: 'verified',
          payoutStatus: 'paid',
          disputeStatus: 'none',
          amountPaise: 300000,
          utrReference: 'UTR123456789',
          payoutUtr: 'POUT_UTR_001',
          gateway: 'manual_upi',
          createdAt: new Date().toISOString(),
        }],
      },
    })
  );

  await page.goto(`/campaign-payment/${CAMPAIGN_ID}`);
  await page.getByRole('button', { name: /status/i }).click();

  await expect(page.getByText(/paid|completed|payout.*sent/i)).toBeVisible();
});
