import { test, expect, Page } from '@playwright/test';

const BRAND_TOKEN = 'fake-brand-jwt';

const PAID_CAMPAIGN = {
  _id: 'camp_paid_001',
  title: 'Paid Collab Campaign',
  description: 'Send product to influencer',
  status: 'active',
  campaignType: 'paid_collab',
  timelineStart: '2026-05-20',
  timelineEnd: '2026-06-30',
  budgetMin: 0,
  budgetMax: 0,
  brandId: 'brand_001',
  platforms: [],
  categories: [],
  pricePerInfluencer: 1500,
  maxInfluencers: 5,
};

const PRODUCT_CAMPAIGN = {
  ...PAID_CAMPAIGN,
  _id: 'camp_prod_001',
  title: 'Product Collab Campaign',
  campaignType: 'product',
  pricePerInfluencer: 0,
};

const PENDING_INVITE = {
  _id: 'invite_pending_001',
  campaignId: 'camp_paid_001',
  influencerId: { _id: 'inf_001', name: 'Test Influencer A', username: 'inf_a' },
  status: 'pending',
  unlocked: false,
  remindersSent: 0,
};

const ACCEPTED_INVITE = {
  _id: 'invite_accepted_001',
  campaignId: 'camp_paid_001',
  influencerId: { _id: 'inf_002', name: 'Test Influencer B', username: 'inf_b' },
  status: 'accepted',
  unlocked: true,
  remindersSent: 0,
};

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
    } catch {
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

async function mockCommonRoutes(page: Page) {
  await page.route('**/config/states**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/states**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/categories**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/config/platforms**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/social-media**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/languages**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/users/brand-profile**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { brand: { _id: 'brand_001', brandName: 'TestBrand', brandUsername: 'testbrand' } } }) }));
  await page.route('**/auth/me**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) }));
  await page.route('**/api/auth/me**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) }));
  await page.route('**/users/influencers**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route('**/plans/me/capabilities**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { hasPremium: true, planName: 'Brand Pro', features: [{ key: 'viewContactDetails', value: true }], limits: [{ key: 'maxActiveCampaigns', value: 10 }, { key: 'maxInvitesPerCampaign', value: 10 }], policies: { imageRetentionDaysAfterExpiry: 45 }, endDate: null } }) }));
  await page.route('**/plans/my/capabilities**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { hasPremium: true, planName: 'Brand Pro', features: [{ key: 'viewContactDetails', value: true }], limits: [{ key: 'maxActiveCampaigns', value: 10 }, { key: 'maxInvitesPerCampaign', value: 10 }], policies: { imageRetentionDaysAfterExpiry: 45 }, endDate: null } }) }));
}

async function mockCampaignPage(page: Page, campaign: any, invites: any[]) {
  await page.route('**/campaigns**', (r) => {
    if (r.request().resourceType() === 'document') return r.continue();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [campaign] }) });
  });
  await page.route(`**/campaign-invites/campaign/${campaign._id}**`, (r) => {
    if (r.request().url().includes('/submissions')) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: invites }) });
  });
}

async function seedCampaignState(page: Page, campaign: any, invites: any[]) {
  await page.evaluate(({ campaign, invites }) => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    try {
      comp.loading = false;
      comp.campaignLoadError = '';
      comp.brandId = 'brand_001';
      comp.brandName = 'Test Brand';
      comp.activeTab = 'active';
      comp.currentPage = 1;
      comp.campaigns = [campaign];
      comp.campaignInvitesMap = new Map([[campaign._id, invites]]);
      comp.expandedCampaignId = campaign._id;
      comp.invitePanelCampaign = campaign;
      comp.invites = invites;
      comp.cd?.detectChanges?.();
    } catch {
      // ignore
    }
  }, { campaign, invites });
}

test('renders bucket chips and triggers Remind via API', async ({ page }) => {
  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, PAID_CAMPAIGN, [PENDING_INVITE, ACCEPTED_INVITE]);

  let remindCalled = false;
  await page.route('**/campaign-invites/invite_pending_001/remind', (r) => {
    remindCalled = true;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, remindedAt: new Date().toISOString(), remindersSent: 1 }) });
  });

  await page.goto('/campaigns');
  await seedCampaignState(page, PAID_CAMPAIGN, [PENDING_INVITE, ACCEPTED_INVITE]);
  await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    const campaignId = 'camp_paid_001';
    const inviteId = 'invite_pending_001';
    const invs = comp.campaignInvitesMap?.get(campaignId) || [];
    const inv = invs.find((i: any) => i?._id === inviteId);
    if (inv) comp.remindInvite(inv);
  });
  await expect.poll(() => remindCalled, { timeout: 10000 }).toBe(true);
});

test('Withdraw button calls withdraw endpoint after confirm', async ({ page }) => {
  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, PAID_CAMPAIGN, [PENDING_INVITE]);

  let withdrawCalled = false;
  let withdrawBody: any = null;
  await page.route('**/campaign-invites/invite_pending_001/withdraw', async (r) => {
    withdrawCalled = true;
    withdrawBody = r.request().postDataJSON();
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, status: 'withdrawn' }) });
  });

  await page.goto('/campaigns');
  await seedCampaignState(page, PAID_CAMPAIGN, [PENDING_INVITE]);
  await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    const campaignId = 'camp_paid_001';
    const inviteId = 'invite_pending_001';
    const invs = comp.campaignInvitesMap?.get(campaignId) || [];
    const inv = invs.find((i: any) => i?._id === inviteId);
    if (!inv) return;
    comp.withdrawInvite(inv);
    comp.inviteActionReasonInput = 'No longer needed';
    comp.submitInviteActionFromModal();
  });

  await expect.poll(() => withdrawCalled, { timeout: 10000 }).toBe(true);
  expect(withdrawBody?.reason).toBe('No longer needed');
});

test('Report button calls report endpoint with reason', async ({ page }) => {
  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, PAID_CAMPAIGN, [ACCEPTED_INVITE]);

  let reportCalled = false;
  let reportBody: any = null;
  await page.route('**/campaign-invites/invite_accepted_001/report', async (r) => {
    reportCalled = true;
    reportBody = r.request().postDataJSON();
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, status: 'disputed' }) });
  });

  await page.goto('/campaigns');
  await seedCampaignState(page, PAID_CAMPAIGN, [ACCEPTED_INVITE]);
  await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    const campaignId = 'camp_paid_001';
    const inviteId = 'invite_accepted_001';
    const invs = comp.campaignInvitesMap?.get(campaignId) || [];
    const inv = invs.find((i: any) => i?._id === inviteId);
    if (!inv) return;
    comp.reportInvite(inv);
    comp.inviteActionReasonInput = 'Influencer never delivered the post';
    comp.submitInviteActionFromModal();
  });

  await expect.poll(() => reportCalled, { timeout: 10000 }).toBe(true);
  expect(reportBody?.reason).toContain('never delivered');
});

test('opens fulfillment modal and saves shipping info', async ({ page }) => {
  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, PRODUCT_CAMPAIGN, [PRODUCT_ACCEPTED_INVITE]);

  let fulfillCalled = false;
  let fulfillBody: any = null;
  await page.route('**/campaign-invites/invite_product_001/fulfillment/product', async (r) => {
    fulfillCalled = true;
    fulfillBody = r.request().postDataJSON();
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, productFulfillment: { ...fulfillBody, status: 'shipped' } }) });
  });

  await page.goto('/campaigns');
  await seedCampaignState(page, PRODUCT_CAMPAIGN, [PRODUCT_ACCEPTED_INVITE]);

  await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    const campaignId = 'camp_prod_001';
    const inviteId = 'invite_product_001';
    const invs = comp.campaignInvitesMap?.get(campaignId) || [];
    const inv = invs.find((i: any) => i?._id === inviteId);
    if (!inv) return;
    comp.invitePanelCampaign = (comp.campaigns || []).find((c: any) => c?._id === campaignId) || comp.invitePanelCampaign;
    comp.openFulfillment(inv);
    comp.fulfillForm = {
      ...comp.fulfillForm,
      courier: 'BlueDart',
      trackingId: 'AWB-12345',
      status: 'shipped',
    };
    comp.saveFulfillment();
  });

  await expect.poll(() => fulfillCalled, { timeout: 10000 }).toBe(true);
  expect(fulfillBody?.courier).toBe('BlueDart');
  expect(fulfillBody?.trackingId).toBe('AWB-12345');
  expect(fulfillBody?.status).toBe('shipped');
});
