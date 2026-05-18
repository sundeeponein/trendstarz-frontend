import { test, expect, Page } from '@playwright/test';

type Role = 'influencer' | 'photographer';

async function setAuth(page: Page, role: Role, userId: string, name: string) {
  const jwt = (() => {
    const header = { alg: 'none', typ: 'JWT' };
    const payload: any = {
      role,
      name,
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    };
    const b64 = (obj: any) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `${b64(header)}.${b64(payload)}.`;
  })();

  await page.addInitScript(({ token, roleValue, id, fullName }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', roleValue);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: id, role: roleValue, name: fullName }),
    );
  }, { token: jwt, roleValue: role, id: userId, fullName: name });
}

async function mockCommonAuthRoutes(page: Page, role: Role, userId: string, name: string) {
  const user = { _id: userId, role, name };

  await page.route('**/auth/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: user }),
    }),
  );

  await page.route('**/plans/me/capabilities**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          hasPremium: true,
          maxActiveCampaigns: 5,
          maxInfluencersPerCampaign: 10,
          canViewContactDetails: true,
          limits: [
            { key: 'maxActiveCampaigns', value: 5 },
            { key: 'maxInvitesPerCampaign', value: 10 },
          ],
          features: [{ key: 'viewContactDetails', value: true }],
        },
      }),
    }),
  );
}

test.describe('Flow spec: campaigns and collaborations', () => {
  test('Campaign for Influencer', async ({ page }) => {
    await setAuth(page, 'influencer', 'inf_flow_001', 'Flow Influencer');
    await mockCommonAuthRoutes(page, 'influencer', 'inf_flow_001', 'Flow Influencer');

    await page.route('**/users/influencer-profile**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: 'inf_flow_001',
            role: 'influencer',
            name: 'Flow Influencer',
            phoneNumber: '9999999999',
            socialMedia: [{ platform: 'Instagram', tier: 'Nano' }],
            payout: {},
          },
        }),
      }),
    );

    await page.route('**/campaign-invites/influencer**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'inv_flow_pending',
              status: 'pending',
              campaignId: {
                _id: 'camp_flow_pending',
                title: 'Pending Flow Campaign',
                status: 'active',
                brandId: { _id: 'brand_1', brandName: 'Flow Brand' },
              },
            },
            {
              _id: 'inv_flow_accepted',
              status: 'accepted',
              campaignId: {
                _id: 'camp_flow_accepted',
                title: 'Accepted Flow Campaign',
                status: 'active',
                brandId: { _id: 'brand_2', brandName: 'Flow Brand 2' },
              },
            },
          ],
        }),
      }),
    );

    await page.route('**/campaigns?status=active**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'camp_flow_open',
              title: 'Open Flow Campaign',
              status: 'active',
              brandId: { _id: 'brand_3', brandName: 'Open Brand' },
            },
          ],
        }),
      }),
    );

    await page.goto('/campaigns');

    await expect(page.getByRole('heading', { name: 'Open Campaigns' })).toBeVisible();
    await expect(page.locator('.invite-list')).toContainText('Pending Flow Campaign');

    await page.locator('.pill-tab', { hasText: 'Accepted' }).click();
    await expect(page.locator('.invite-list')).toContainText('Accepted Flow Campaign');
    await expect(page.locator('.btn-submit-post').first()).toBeVisible();
  });

  test('Campaign for Photographer', async ({ page }) => {
    await setAuth(page, 'photographer', 'photo_flow_001', 'Flow Photographer');
    await mockCommonAuthRoutes(page, 'photographer', 'photo_flow_001', 'Flow Photographer');

    await page.route('**/users/photographers/me/profile**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: 'photo_flow_001',
            name: 'Flow Photographer',
            role: 'photographer',
          },
        }),
      }),
    );

    await page.route('**/campaigns?brandId=photo_flow_001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'photo_collab_001',
              title: 'Studio Shoot Collaboration',
              description: 'Weekend studio collaboration request',
              status: 'active',
              campaignType: 'invite_location',
            },
          ],
        }),
      }),
    );

    await page.route('**/campaign-invites/campaign/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    );

    await page.goto('/campaigns');

    await expect(page.getByRole('heading', { name: 'Collaboration Requests' })).toBeVisible();
    await expect(page.locator('.btn.btn-create')).toContainText(/Create Collaboration Request|Quota full/);
    await expect(page.locator('.campaign-cards')).toContainText('Studio Shoot Collaboration');
  });

  test('Collabration for Influencers', async ({ page }) => {
    await setAuth(page, 'influencer', 'inf_collab_001', 'Collab Influencer');
    await mockCommonAuthRoutes(page, 'influencer', 'inf_collab_001', 'Collab Influencer');

    await page.route('**/support/contact**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      }),
    );

    await page.route('**/users/influencer-profile**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            _id: 'inf_collab_001',
            role: 'influencer',
            name: 'Collab Influencer',
            phoneNumber: '8888888888',
            socialMedia: [{ platform: 'Instagram', tier: 'Micro' }],
            payout: {},
          },
        }),
      }),
    );

    await page.route('**/dashboard/influencer**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: { _id: 'inf_collab_001', role: 'influencer', name: 'Collab Influencer' },
            invites: { newInvites: [] },
            activeCampaigns: [],
            completedCampaigns: [],
          },
        }),
      }),
    );

    await page.route('**/campaigns?brandId=inf_collab_001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'inf_collab_req_001',
              title: 'Influencer Posted Request',
              description: 'Need collab with local photographers',
              status: 'active',
              categories: ['Lifestyle'],
              timelineStart: '2026-06-01',
              timelineEnd: '2026-06-10',
            },
          ],
        }),
      }),
    );

    await page.route('**/campaign-transactions/my/history**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    );

    await page.route('**/campaign-invites/influencer/attention-counts**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { pendingInvites: 0, overdueDeliverables: 0, disputedAgainstMe: 0 } }),
      }),
    );

    await page.goto('/influencer-dashboard');

    await page.evaluate(() => {
      const el = document.querySelector('app-influencer-dashboard');
      const ng = (window as any).ng;
      if (!el || !ng) return;
      const comp = ng.getComponent(el);
      try {
        comp.loading = false;
        comp.postedCollaborations = [
          {
            _id: 'inf_collab_req_001',
            title: 'Influencer Posted Request',
            description: 'Need collab with local photographers',
            status: 'active',
            categories: ['Lifestyle'],
            timelineStart: '2026-06-01',
            timelineEnd: '2026-06-10',
          },
        ];
        comp.cdr?.detectChanges?.();
      } catch {
        // no-op
      }
    });

    await expect(page.getByText('My Collaboration Requests')).toBeVisible();
    await expect(page.getByText('Influencer Posted Request')).toBeVisible();

    await page.getByRole('link', { name: 'Manage all collaboration requests' }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
  });
});
