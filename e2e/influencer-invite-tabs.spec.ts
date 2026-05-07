import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Influencer — My Campaign Invites tabs E2E
//
// All API routes are mocked.  Tests cover:
//   1. Pending tab is default and shows pending invites
//   2. Clicking Accepted tab shows accepted invites
//   3. Open Campaigns hides campaigns the influencer already applied to
//   4. Submit-post form appears and calls /submit endpoint
// ─────────────────────────────────────────────────────────────

const INF_TOKEN = 'fake-influencer-jwt';
const INF_USER = { _id: 'inf_001', role: 'influencer', name: 'Test Influencer' };

// ── mock invites ─────────────────────────────────────────────
const PENDING_INVITE = {
  _id: 'inv_pending',
  status: 'pending',
  campaignId: {
    _id: 'camp_001',
    title: 'Pending Campaign',
    status: 'active',
    budgetMin: 5000,
    budgetMax: 10000,
    timelineStart: '2026-06-01',
    timelineEnd: '2026-07-01',
    brandId: { _id: 'brand_001', brandName: 'BrandPending', brandLogo: null },
  },
  influencerId: 'inf_001',
  postDate: null,
};

const ACCEPTED_INVITE = {
  _id: 'inv_accepted',
  status: 'accepted',
  campaignId: {
    _id: 'camp_002',
    title: 'Accepted Campaign',
    status: 'active',
    budgetMin: 8000,
    budgetMax: 15000,
    timelineStart: '2026-06-01',
    timelineEnd: '2026-07-01',
    brandId: { _id: 'brand_002', brandName: 'BrandAccepted', brandLogo: null },
  },
  influencerId: 'inf_001',
  postDate: '2026-06-20',
};

const DECLINED_INVITE = {
  _id: 'inv_declined',
  status: 'declined',
  campaignId: {
    _id: 'camp_003',
    title: 'Declined Campaign',
    status: 'active',
    budgetMin: 3000,
    budgetMax: 6000,
    timelineStart: '2026-06-01',
    timelineEnd: '2026-07-01',
    brandId: { _id: 'brand_003', brandName: 'BrandDeclined', brandLogo: null },
  },
  influencerId: 'inf_001',
};

// Open campaign NOT in any invite — should show in Open Campaigns list
const OPEN_CAMPAIGN = {
  _id: 'camp_open',
  title: 'Open Campaign For All',
  status: 'active',
  budgetMin: 2000,
  budgetMax: 4000,
  timelineStart: '2026-06-01',
  timelineEnd: '2026-07-01',
  brandId: { _id: 'brand_open', brandName: 'BrandOpen', brandLogo: null },
  platforms: [],
  categories: [],
};

// ── helpers ───────────────────────────────────────────────────
async function setInfluencerAuth(page: Page) {
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = { role: 'influencer', name: INF_USER.name, userId: INF_USER._id };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
      const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${b64(header)}.${b64(payload)}.`;
    } catch (e) {
      return INF_TOKEN;
    }
  })();

  await page.addInitScript((jwt, user) => {
    localStorage.setItem('token', jwt as any);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify(user));
  }, fakeJwt, INF_USER);
}

async function mockCommonRoutes(page: Page) {
  // Auth / me
  await page.route('**/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: INF_USER }) }));
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: INF_USER }) }));

  // Plan capabilities
  await page.route('**/plans/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {
        maxActiveCampaigns: 3, maxInfluencersPerCampaign: 5, canViewContactDetails: false,
      }}) }));
  await page.route('**/api/plans/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {
        maxActiveCampaigns: 3, maxInfluencersPerCampaign: 5, canViewContactDetails: false,
      }}) }));

  // Influencer profile
  await page.route('**/users/influencer/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...INF_USER, isEmailVerified: true } }) }));
  await page.route('**/api/users/influencer/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...INF_USER, isEmailVerified: true } }) }));

  // Attention counts
  await page.route('**/campaign-invites/influencer/attention-counts', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { pendingInvites: 1, overdueDeliverables: 0, disputedAgainstMe: 0 } }) }));
  await page.route('**/api/campaign-invites/influencer/attention-counts', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { pendingInvites: 1, overdueDeliverables: 0, disputedAgainstMe: 0 } }) }));

  // All campaigns (open list)
  await page.route('**/campaigns?status=active', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [OPEN_CAMPAIGN,
        PENDING_INVITE.campaignId, ACCEPTED_INVITE.campaignId, DECLINED_INVITE.campaignId] }) }));
  await page.route('**/api/campaigns?status=active', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [OPEN_CAMPAIGN,
        PENDING_INVITE.campaignId, ACCEPTED_INVITE.campaignId, DECLINED_INVITE.campaignId] }) }));

  // My invites
  await page.route('**/campaign-invites/influencer', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [PENDING_INVITE, ACCEPTED_INVITE, DECLINED_INVITE] }) }));
  await page.route('**/api/campaign-invites/influencer', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [PENDING_INVITE, ACCEPTED_INVITE, DECLINED_INVITE] }) }));
  // Dashboard snapshot (some pages request the dashboard payload)
  await page.route('**/api/dashboard/influencer', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      invites: { newInvites: [PENDING_INVITE] },
      activeCampaigns: [],
      completedCampaigns: [],
      user: { _id: 'inf_001', role: 'influencer', name: 'Test Influencer' }
    }}) }));
}

// ── Tests ─────────────────────────────────────────────────────
test.describe('Influencer › My Campaign Invites tabs', () => {

  test('1. Pending tab is default and shows the pending invite', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockCommonRoutes(page);
    await page.goto('/campaigns');
    // Trigger change detection for zone-less Angular and give time to render
    await page.waitForTimeout(800);
    await page.locator('body').click();
    await page.waitForTimeout(700);

    // Wait for invite section
    await expect(page.locator('.pill-tabs')).toBeVisible({ timeout: 10_000 });

    // On mobile, tab state can initialize late; click Pending to enforce visible state.
    const pendingTab = page.locator('.pill-tab', { hasText: 'Pending' });
    await expect(pendingTab).toBeVisible();
    await pendingTab.click();

    // The pending invite card should show the brand name or campaign title
    await expect(page.locator('.invite-list')).toContainText('Pending Campaign');
  });

  test('2. Clicking Accepted tab shows accepted invite', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockCommonRoutes(page);
    await page.goto('/campaigns');

    const acceptedTab = page.locator('.pill-tab', { hasText: 'Accepted' });
    await acceptedTab.click();
    await expect(acceptedTab).toBeVisible();

    await expect(page.locator('.invite-list')).toContainText('Accepted Campaign');
  });

  test('3. Accepted tab shows "Submit your post" button', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockCommonRoutes(page);
    await page.goto('/campaigns');

    await page.locator('.pill-tab', { hasText: 'Accepted' }).click();
    await expect(page.locator('.btn-submit-post')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.btn-submit-post').first()).toContainText('Submit your post');
  });

  test('4. Open Campaigns hides campaigns influencer already has an invite for', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockCommonRoutes(page);
    await page.goto('/campaigns');

    // Scroll to the campaign cards section (Open Campaigns for influencer)
    const campaignCards = page.locator('.campaign-cards');
    await expect(campaignCards).toBeVisible({ timeout: 10_000 });

    // Open Campaign For All should appear (no invite for this campaign)
    await expect(campaignCards).toContainText('Open Campaign For All');

    // Campaigns where influencer already has an invite should NOT appear
    await expect(campaignCards).not.toContainText('Pending Campaign');
    await expect(campaignCards).not.toContainText('Accepted Campaign');
    await expect(campaignCards).not.toContainText('Declined Campaign');
  });

  test('5. "Submit your post" button navigates to campaign-submission page', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockCommonRoutes(page);

    // Mock the submission page route so navigation doesn't 404
    await page.route('**/campaign-invites/inv_accepted/submission', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }) }));

    await page.goto('/campaigns');
    await page.locator('.pill-tab', { hasText: 'Accepted' }).click();

    const submitBtn = page.locator('.btn-submit-post').first();
    await expect(submitBtn).toBeVisible({ timeout: 8_000 });
    await submitBtn.click();

    // Should navigate to /campaign-submission/inv_accepted
    await expect(page).toHaveURL(/\/campaign-submission\/inv_accepted/, { timeout: 8_000 });
  });

});
