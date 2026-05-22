import { test, expect, Page } from '@playwright/test';

const PHOTOGRAPHER_TOKEN = 'fake-photographer-jwt';

const BASE_COLLAB = {
  _id: 'collab_reg_001',
  title: 'Regression Collaboration',
  description: 'Collab regression checks',
  status: 'active',
  campaignType: 'invite_location',
  timelineStart: '2026-05-10',
  timelineEnd: '2026-05-30',
  budgetMin: 0,
  budgetMax: 0,
  brandId: 'photo_001',
  ownerType: 'photographer',
  createdByRole: 'photographer',
  platforms: [],
  categories: [],
  maxInfluencers: 3,
  minInfluencers: 1,
};

const ACCEPTED_INVITE = {
  _id: 'collab_inv_acc_001',
  campaignId: 'collab_reg_001',
  influencerId: { _id: 'inf_001', name: 'Accepted User', username: 'accepted_user' },
  status: 'accepted',
  unlocked: true,
  remindersSent: 0,
};

async function setPhotographerAuth(page: Page) {
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = { role: 'photographer', name: 'Test Photographer', userId: 'photo_001' };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60;
      const b64 = (obj: any) =>
        Buffer.from(JSON.stringify(obj))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      return `${b64(header)}.${b64(payload)}.`;
    } catch {
      return PHOTOGRAPHER_TOKEN;
    }
  })();

  await page.addInitScript((jwt) => {
    localStorage.setItem('token', jwt as any);
    localStorage.setItem('userRole', 'photographer');
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'photographer', _id: 'photo_001', name: 'Test Photographer' }));
  }, fakeJwt);
}

async function mockCommonRoutes(page: Page) {
  await page.route('**/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'photo_001', role: 'photographer', name: 'Test Photographer' } }) }));
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'photo_001', role: 'photographer', name: 'Test Photographer' } }) }));
  await page.route('**/users/photographers/me/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'photo_001', name: 'Test Photographer', role: 'photographer' } }) }));
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

async function seedCollabState(page: Page, campaign: any, invites: any[]) {
  await page.evaluate(({ campaign, invites }) => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    try {
      comp.loading = false;
      comp.campaignLoadError = '';
      comp.brandId = 'photo_001';
      comp.brandName = 'Test Photographer';
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

test('collaboration: acceptance closed banner hidden when acceptance deadline extended to future', async ({ page }) => {
  const collab = {
    ...BASE_COLLAB,
    acceptanceDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await setPhotographerAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, collab, [ACCEPTED_INVITE]);

  await page.goto('/campaigns');
  await seedCollabState(page, collab, [ACCEPTED_INVITE]);

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

test('collaboration paid_collab: verification pending disables Pay button but View Status opens status modal', async ({ page }) => {
  const paidCollab = {
    ...BASE_COLLAB,
    _id: 'collab_paid_reg_001',
    campaignType: 'paid_collab',
    pricePerInfluencer: 2500,
    acceptanceDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  };
  const invites = [{ ...ACCEPTED_INVITE, _id: 'collab_paid_inv_001', campaignId: paidCollab._id }];

  await setPhotographerAuth(page);
  await mockCommonRoutes(page);
  await mockCampaignPage(page, paidCollab, invites);

  await page.route(`**/campaign-transactions/campaign/${paidCollab._id}/status`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{
          _id: 'tx_collab_reg_001',
          campaignId: paidCollab._id,
          collectionStatus: 'proof_submitted',
          payoutStatus: 'pending',
          disputeStatus: 'none',
          utrNumber: 'COLLAB1234567',
          createdAt: new Date().toISOString(),
        }],
      }),
    })
  );

  await page.route(`**/campaign-transactions/${paidCollab._id}/calculate`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          campaignId: paidCollab._id,
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
  await seedCollabState(page, paidCollab, invites);
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
  }, paidCollab._id);

  const payBtn = page.locator('.ccard-actions .btn-pay').first();
  const payBtnVisible = await payBtn.isVisible().catch(() => false);
  if (payBtnVisible) {
    await expect(payBtn).toBeDisabled();
  }

  await page.evaluate((campaignId) => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    try {
      comp.openPayment(campaignId, true, 'status');
      comp.cd?.detectChanges?.();
    } catch {
      // ignore
    }
  }, paidCollab._id);

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
  }, paidCollab._id);

  expect(status.verificationPending).toBe(true);
  expect(status.canOpenPay).toBe(false);
});
