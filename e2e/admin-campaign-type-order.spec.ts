import { test, expect, Page } from '@playwright/test';

type CampaignTypeConfigItem = {
  key: string;
  label: string;
  ownerType: 'brand' | 'photographer';
  enabled: boolean;
  premiumOnly: boolean;
  sortOrder: number;
};

const DEFAULT_CAMPAIGN_TYPE_CONFIGS: CampaignTypeConfigItem[] = [
  { key: 'paid_collab', label: 'Paid Collab', ownerType: 'brand', enabled: true, premiumOnly: false, sortOrder: 10 },
  { key: 'product', label: 'Product Collab', ownerType: 'brand', enabled: true, premiumOnly: true, sortOrder: 20 },
  { key: 'invite_location', label: 'Invite to Location', ownerType: 'brand', enabled: true, premiumOnly: true, sortOrder: 30 },
  { key: 'paid_collab', label: 'Paid Shoot', ownerType: 'photographer', enabled: true, premiumOnly: false, sortOrder: 10 },
  { key: 'product', label: 'Barter / Product Shoot', ownerType: 'photographer', enabled: true, premiumOnly: true, sortOrder: 20 },
  { key: 'invite_location', label: 'Event Coverage', ownerType: 'photographer', enabled: true, premiumOnly: true, sortOrder: 30 },
  { key: 'portfolio_collab', label: 'Portfolio Collaboration', ownerType: 'photographer', enabled: true, premiumOnly: false, sortOrder: 40 },
  { key: 'reel_collab', label: 'Reel Collaboration', ownerType: 'photographer', enabled: true, premiumOnly: false, sortOrder: 50 },
  { key: 'creative_project', label: 'Creative Project', ownerType: 'photographer', enabled: true, premiumOnly: false, sortOrder: 60 },
];

function buildToken(role: 'admin' | 'brand', user: Record<string, unknown>): string {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    role,
    name: String(user['name'] || role),
    userId: String(user['_id'] || `${role}_001`),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  return `${encode(header)}.${encode(payload)}.`;
}

async function setSession(page: Page, role: 'admin' | 'brand', user: Record<string, unknown>) {
  const token = buildToken(role, user);
  await page.addInitScript(({ jwt, roleValue, userValue }) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('userRole', roleValue);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify(userValue));
  }, { jwt: token, roleValue: role, userValue: user });
}

async function openCreateCampaignForm(page: Page) {
  const createBtn = page.locator('button.btn-create').first();
  const canUseButton = await createBtn.isVisible().catch(() => false);

  if (canUseButton) {
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
    await createBtn.click();
    return;
  }

  await page.evaluate(() => {
    const el = document.querySelector('app-campaign-management');
    const ng = (window as any).ng;
    if (!el || !ng?.getComponent) return;
    const comp = ng.getComponent(el);
    try {
      comp.formMode = 'create';
      comp.editingCampaign = null;
      comp.showForm = true;
      comp.cd?.detectChanges?.();
    } catch {
      // ignore fallback failures; the subsequent visibility assertion will fail if the form did not open
    }
  });
}

test.describe('Admin campaign type ordering', () => {
  test('reordered admin settings drive brand campaign type dropdown order', async ({ page }) => {
    let currentRole: 'admin' | 'brand' = 'admin';
    let savedCampaignTypeConfigs = DEFAULT_CAMPAIGN_TYPE_CONFIGS.map((item) => ({ ...item }));
    let lastPatchedSettings: any = null;

    await setSession(page, 'admin', { role: 'admin', _id: 'admin_001', name: 'Admin User' });

    await page.route('**/auth/me**', async (route) => {
      const user = currentRole === 'admin'
        ? { _id: 'admin_001', role: 'admin', name: 'Admin User' }
        : { _id: 'brand_001', role: 'brand', name: 'Brand User' };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: user }),
      });
    });

    await page.route('**/plans/me/capabilities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            hasPremium: true,
            maxActiveCampaigns: 5,
            maxInfluencersPerCampaign: 10,
            limits: [
              { key: 'maxActiveCampaigns', value: 5 },
              { key: 'maxInvitesPerCampaign', value: 10 },
            ],
            features: [{ key: 'viewContactDetails', value: true }],
          },
        }),
      });
    });

    await page.route('**/admin/settings**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        lastPatchedSettings = body;
        savedCampaignTypeConfigs = Array.isArray(body?.campaignTypeConfigs)
          ? body.campaignTypeConfigs.map((item: any) => ({ ...item }))
          : savedCampaignTypeConfigs;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            settings: {
              ...body,
              supportContactEmail: 'support@trendstarz.in',
              supportContactPhone: '',
              supportContactWhatsapp: '',
              supportContactMessage: '',
              supportContactEnabled: true,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            preApproveInfluencers: false,
            influencerRequireEmailVerified: true,
            influencerRequireMobileVerified: false,
            preApproveBrands: false,
            brandRequireEmailVerified: true,
            brandRequireMobileVerified: false,
            pendingUserAutoDeleteEnabled: false,
            pendingUserAutoDeleteDays: 45,
            campaignApprovalMode: 'manual',
            collaborationApprovalMode: 'manual',
            supportContactEnabled: true,
            supportContactEmail: 'support@trendstarz.in',
            supportContactPhone: '',
            supportContactWhatsapp: '',
            supportContactMessage: '',
            verificationCallNumber: '',
            showSearchLink: true,
            showRegisterInfluencerLink: true,
            showRegisterBrandLink: true,
            showRegisterPhotographerLink: true,
            campaignTypeConfigs: savedCampaignTypeConfigs,
            campaignTypeConfigDefaults: DEFAULT_CAMPAIGN_TYPE_CONFIGS,
          },
        }),
      });
    });

    await page.route('**/admin/user-tags-config**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { influencer: [], brand: [], photographer: [], commission: [] } }),
      });
    });

    await page.route('**/admin/users-by-commission-badge/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { count: 0 } }),
      });
    });

    await page.route('**/admin/social-media**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/categories**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/equipment-options**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/pricing-options**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/states**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/languages**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/tiers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/districts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/users/brand-profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { brand: { _id: 'brand_001', brandName: 'TestBrand', brandUsername: 'testbrand' } },
        }),
      });
    });

    await page.route('**/campaigns/brand-name/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route(/\/api\/campaigns(\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { _id: 'camp_001' } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/users/influencers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }] }),
      });
    });

    await page.route('**/social-media**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ _id: 'sm_ig', name: 'Instagram' }] }),
      });
    });

    await page.route('**/states**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }),
      });
    });

    await page.route('**/districts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/public/support-contact**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { enabled: true, email: 'support@trendstarz.in' } }),
      });
    });

    await page.route('**/public/campaign-type-configs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: savedCampaignTypeConfigs } }),
      });
    });

    await page.goto('/admin/admin-management');
    await page.waitForSelector('strong:has-text("Requirement Types (Brand → Influencer/Photographer)")', { timeout: 10000 });

    const brandTable = page.locator('table').nth(0);
    const getBrandOrder = async () => {
      return await brandTable.locator('tbody tr td:first-child').evaluateAll((cells) =>
        cells.map((cell) => (cell.textContent || '').trim()).filter(Boolean),
      );
    };

    await expect.poll(getBrandOrder).toEqual([
      'Paid Collab',
      'Product Collab',
      'Invite to Location',
    ]);

    const paidCollabRow = brandTable.locator('tbody tr').filter({ hasText: 'Paid Collab' }).first();
    await paidCollabRow.getByRole('button', { name: 'Down' }).click();

    await expect.poll(getBrandOrder).toEqual([
      'Product Collab',
      'Paid Collab',
      'Invite to Location',
    ]);

    const patchResponse = page.waitForResponse((response) =>
      response.url().includes('/admin/settings') && response.request().method() === 'PATCH',
    );

    await page.getByRole('button', { name: 'Save Settings' }).click();
    await patchResponse;

    expect(lastPatchedSettings?.campaignTypeConfigs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerType: 'brand', key: 'product', sortOrder: 10 }),
        expect.objectContaining({ ownerType: 'brand', key: 'paid_collab', sortOrder: 20 }),
        expect.objectContaining({ ownerType: 'brand', key: 'invite_location', sortOrder: 30 }),
      ]),
    );

    const brandPage = await page.context().newPage();
    await setSession(brandPage, 'brand', { role: 'brand', _id: 'brand_001', name: 'Brand User' });

    await brandPage.route('**/auth/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { _id: 'brand_001', role: 'brand', name: 'Brand User' } }),
      });
    });

    await brandPage.route('**/plans/me/capabilities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            hasPremium: true,
            maxActiveCampaigns: 5,
            maxInfluencersPerCampaign: 10,
            limits: [
              { key: 'maxActiveCampaigns', value: 5 },
              { key: 'maxInvitesPerCampaign', value: 10 },
            ],
            features: [{ key: 'viewContactDetails', value: true }],
          },
        }),
      });
    });

    await brandPage.route('**/users/brand-profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { brand: { _id: 'brand_001', brandName: 'TestBrand', brandUsername: 'testbrand' } },
        }),
      });
    });

    await brandPage.route('**/campaigns/brand-name/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await brandPage.route(/\/api\/campaigns(\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { _id: 'camp_001' } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await brandPage.route('**/users/influencers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await brandPage.route('**/categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }] }),
      });
    });

    await brandPage.route('**/social-media**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ _id: 'sm_ig', name: 'Instagram' }] }),
      });
    });

    await brandPage.route('**/states**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }),
      });
    });

    await brandPage.route('**/districts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await brandPage.route('**/public/support-contact**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { enabled: true, email: 'support@trendstarz.in' } }),
      });
    });

    await brandPage.route('**/public/campaign-type-configs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: savedCampaignTypeConfigs } }),
      });
    });

    await brandPage.goto('/campaigns');
    await brandPage.waitForTimeout(2000);
    await openCreateCampaignForm(brandPage);
    const campaignTypeSelect = brandPage.locator('select[formControlName="campaignType"]').last();
    await expect(campaignTypeSelect).toBeVisible({ timeout: 10000 });

    const campaignTypeValues = await campaignTypeSelect
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));

    expect(campaignTypeValues.slice(0, 3)).toEqual([
      'product',
      'paid_collab',
      'invite_location',
    ]);
  });
});