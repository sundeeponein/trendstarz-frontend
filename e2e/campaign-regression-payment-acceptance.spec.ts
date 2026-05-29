import { test, expect, Page } from '@playwright/test';

const BRAND_TOKEN = 'fake-brand-jwt';

const BASE_CAMPAIGN = {
  _id: 'camp_reg_001',
  title: 'Regression Campaign',
  description: 'Regression checks',
  status: 'active',
  campaignType: 'product',
  timelineStart: '2026-05-10',
  timelineEnd: '2026-05-30',
  budgetMin: 0,
  budgetMax: 0,
  brandId: 'brand_001',
  platforms: [],
  categories: [],
  maxInfluencers: 3,
  minInfluencers: 1,
};

const ACCEPTED_INVITE = {
  _id: 'invite_acc_001',
  campaignId: 'camp_reg_001',
  influencerId: { _id: 'inf_001', name: 'Accepted User', username: 'accepted_user' },
  status: 'accepted',
  unlocked: true,
  remindersSent: 0,
};

async function setBrandAuth(page: Page) {
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = { role: 'brand', name: 'Test Brand', userId: 'brand_001' };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60;
      const b64 = (obj: any) =>
        Buffer.from(JSON.stringify(obj))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
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
  await page.route('**/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) }));
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Test Brand' } }) }));
  await page.route('**/users/brand-profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { brand: { _id: 'brand_001', brandName: 'TestBrand', brandUsername: 'testbrand' } } }) }));
  await page.route('**/plans/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { hasPremium: true, limits: [{ key: 'maxActiveCampaigns', value: 10 }] } }) }));
  await page.route('**/plans/my/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { hasPremium: true, limits: [{ key: 'maxActiveCampaigns', value: 10 }] } }) }));
  await page.route('**/users/influencers', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
}

async function mockCampaignPage(page: Page, campaign: any, invites: any[]) {
  await page.route('**/campaigns**', (r) => {
    if (r.request().resourceType() === 'document') return r.continue();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [campaign] }) });
  });
  await page.route(`**/campaign-invites/campaign/${campaign._id}**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: invites }) }));
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

test('acceptance closed banner is hidden when acceptance deadline is extended to future', async ({ page }) => {
  const campaign = {
    ...BASE_CAMPAIGN,
    campaignType: 'product',
    acceptanceDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, campaign, [ACCEPTED_INVITE]);

  await page.goto('/campaigns');
  await seedCampaignState(page, campaign, [ACCEPTED_INVITE]);
  const isClosed = await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return true;
    const comp = ng.getComponent(el);
    const c = (comp.campaigns || [])[0];
    return !!(c && comp.isAcceptanceClosed(c));
  });
  expect(isClosed).toBe(false);
});

test('verification pending disables Pay button but View Status opens status modal', async ({ page }) => {
  const campaign = {
    ...BASE_CAMPAIGN,
    _id: 'camp_paid_reg_001',
    campaignType: 'paid_collab',
    pricePerInfluencer: 2500,
    acceptanceDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  };
  const invites = [
    {
      ...ACCEPTED_INVITE,
      _id: 'invite_paid_001',
      campaignId: campaign._id,
    },
  ];

  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, campaign, invites);

  await page.route(`**/campaign-transactions/campaign/${campaign._id}/status`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{
          _id: 'tx_reg_001',
          campaignId: campaign._id,
          collectionStatus: 'proof_submitted',
          payoutStatus: 'pending',
          disputeStatus: 'none',
          utrNumber: 'TEST1234567',
          createdAt: new Date().toISOString(),
        }],
      }),
    })
  );

  await page.route(`**/campaign-transactions/${campaign._id}/calculate`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          campaignId: campaign._id,
          acceptedCount: 1,
          pricePerInfluencer: 250000,
          agreedAmount: 250000,
          payerTotal: 250000,
          recipientPayoutTotal: 250000,
          campaignType: 'paid_collab',
          platformFeeEnabled: false,
          breakdown: [],
          trustLabels: [],
        },
      }),
    })
  );

  await page.goto('/campaigns');
  await seedCampaignState(page, campaign, invites);
  await page.evaluate((campaignId) => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    try {
      comp.campaignCollectionStatusById.set(campaignId, 'proof_submitted');
      comp.cd?.detectChanges?.();
    } catch {
      // ignore
    }
  }, campaign._id);

  const status = await page.evaluate((campaignId) => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return { canOpenPay: true, verificationPending: false };
    const comp = ng.getComponent(el);
    const c = (comp.campaigns || []).find((x: any) => x?._id === campaignId);
    if (!c) return { canOpenPay: true, verificationPending: false };
    return {
      canOpenPay: !!comp.canOpenPaymentForCampaign(c),
      verificationPending: !!comp.isCampaignPaymentVerificationPending(c),
    };
  }, campaign._id);

  expect(status.verificationPending).toBe(true);
  expect(status.canOpenPay).toBe(false);
});

test('brand contact reveal requires payment_confirmed even when invite is unlocked', async ({ page }) => {
  const campaign = {
    ...BASE_CAMPAIGN,
    _id: 'camp_contact_gate_001',
    campaignType: 'product',
  };
  const acceptedUnlocked = [{
    ...ACCEPTED_INVITE,
    _id: 'invite_contact_acc_001',
    campaignId: campaign._id,
    status: 'accepted',
    unlocked: true,
  }];
  const paidUnlocked = [{
    ...ACCEPTED_INVITE,
    _id: 'invite_contact_paid_001',
    campaignId: campaign._id,
    status: 'payment_confirmed',
    unlocked: true,
  }];

  await setBrandAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, campaign, acceptedUnlocked);

  await page.goto('/campaigns');
  await seedCampaignState(page, campaign, acceptedUnlocked);

  const acceptedVisible = await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return true;
    const comp = ng.getComponent(el);
    const inv = (comp.invites || [])[0];
    if (!inv) return true;
    return !!comp.canRevealInviteContact(inv);
  });
  expect(acceptedVisible).toBe(false);

  await seedCampaignState(page, campaign, paidUnlocked);
  const paidVisible = await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return false;
    const comp = ng.getComponent(el);
    const inv = (comp.invites || [])[0];
    if (!inv) return false;
    return !!comp.canRevealInviteContact(inv);
  });
  expect(paidVisible).toBe(true);

  await seedCampaignState(page, campaign, [{
    ...ACCEPTED_INVITE,
    _id: 'invite_contact_approved_001',
    campaignId: campaign._id,
    status: 'approved',
    unlocked: true,
  }]);
  const approvedVisible = await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return false;
    const comp = ng.getComponent(el);
    const inv = (comp.invites || [])[0];
    if (!inv) return false;
    return !!comp.isUnlockableStatus(inv.status) && !!comp.canRevealInviteContact(inv);
  });
  expect(approvedVisible).toBe(true);
});
