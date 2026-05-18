import { expect, Page, test } from '@playwright/test';

const ADMIN_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJuYW1lIjoiQWRtaW4iLCJfaWQiOiJhZG1pbl8wMDEifQ.fake';

async function setAdminAuth(page: Page) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem(
      'user',
      JSON.stringify({ role: 'admin', _id: 'admin_001', name: 'Admin' }),
    );
  }, { token: ADMIN_TOKEN });
}

async function mockAdminCommonRoutes(page: Page) {
  await page.route('**/campaign-invites/admin/disputes/count', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { count: 0 } }),
    });
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { _id: 'admin_001', role: 'admin' } }),
    });
  });
}

test.describe('Admin Photographer Parity Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await setAdminAuth(page);
    await mockAdminCommonRoutes(page);
  });

  test('admin user table shows Photographers tab and photographer row', async ({ page }) => {
    await page.route('**/admin/influencers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/brands**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/photographers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'photo_001',
            name: 'Photo One',
            email: 'photo1@e2e.com',
            phoneNumber: '9876543299',
            status: 'pending',
            skills: ['Fashion'],
            location: { state: 'Karnataka', district: 'Bengaluru' },
            profileImages: [],
          },
        ]),
      });
    });
    await page.route('**/users/influencer-profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.goto('/admin/admin-user-table');
    await expect(page.locator('h2')).toContainText('Admin Users');
    await expect(page.locator('button.tab-btn', { hasText: 'Photographers' })).toBeVisible();

    await page.locator('button.tab-btn', { hasText: 'Photographers' }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator('table.admin-table tbody tr')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('table.admin-table tbody tr').first()).toContainText('Photo One');
  });

  test('photographer tab filters and actions match user-management parity', async ({ page }) => {
    await page.route('**/admin/influencers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/brands**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/photographers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'photo_free_pending',
            name: 'Riya Lenscraft',
            username: 'riya_lens',
            email: 'riya.photo@e2e.com',
            phoneNumber: '9000000001',
            status: 'pending',
            isPremium: false,
            isEmailVerified: false,
            isMobileVerified: false,
            skills: ['Fashion'],
            signupAttribution: { source: 'organic' },
            location: { state: 'Karnataka', district: 'Bengaluru' },
            profileImages: [],
          },
          {
            _id: 'photo_premium_accepted',
            name: 'Arjun Frame Works',
            username: 'arjun_frames',
            email: 'arjun.video@e2e.com',
            phoneNumber: '9000000002',
            status: 'accepted',
            isPremium: true,
            isEmailVerified: true,
            isMobileVerified: true,
            skills: ['Product'],
            signupAttribution: { source: 'referral' },
            location: { state: 'Maharashtra', district: 'Mumbai' },
            profileImages: [],
          },
        ]),
      });
    });
    await page.route('**/users/influencer-profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.goto('/admin/admin-user-table');
    await page.locator('button.tab-btn', { hasText: 'Photographers' }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });

    const rows = page.locator('table.admin-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 10000 });

    const filterToggle = page.locator('button.filter-toggle-btn');
    if (await filterToggle.isVisible() && ((await filterToggle.textContent()) || '').includes('Expand Filters')) {
      await filterToggle.click();
      await expect(page.locator('#status-filter')).toBeVisible();
    }

    await expect(rows.first().locator('button:has-text("Set Premium")')).toBeVisible();
    await expect(rows.nth(1).locator('button:has-text("Set Free")')).toBeVisible();
    await expect(rows.first().locator('button:has-text("Edit Tags")')).toBeVisible();

    await page.selectOption('#status-filter', 'accepted');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Arjun Frame Works');

    await page.selectOption('#premium-filter', 'free');
    await expect(rows).toHaveCount(0);

    await page.click('button:has-text("Reset Filters")');
    await expect(rows).toHaveCount(2);

    await page.selectOption('#category-filter', 'Fashion');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Riya Lenscraft');

    await page.selectOption('#state-filter', 'Karnataka');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Riya Lenscraft');

    await page.selectOption('#signup-source-filter', 'organic');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Riya Lenscraft');

    await page.selectOption('#email-verified-filter', 'not_verified');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Riya Lenscraft');

    await page.selectOption('#mobile-verified-filter', 'not_verified');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Riya Lenscraft');
  });

  test('photographer Edit Tags modal saves tags successfully', async ({ page }) => {
    await page.route('**/admin/influencers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/brands**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/photographers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'photo_tags_1',
            name: 'Taggable Photographer',
            username: 'taggable_photo',
            email: 'tags.photo@e2e.com',
            phoneNumber: '9000000003',
            status: 'accepted',
            isPremium: false,
            isEmailVerified: true,
            isMobileVerified: true,
            skills: ['Fashion'],
            adminTags: ['Founder'],
            signupAttribution: { source: 'organic' },
            location: { state: 'Karnataka', district: 'Bengaluru' },
            profileImages: [],
          },
        ]),
      });
    });
    let capturedTags: string[] = [];
    await page.route('**/admin/users/photographer/photo_tags_1/tags', async (route) => {
      const body = route.request().postDataJSON() as { adminTags?: string[] };
      capturedTags = body?.adminTags || [];
      if (!body?.adminTags?.includes('Verified Creator')) {
        throw new Error(`Unexpected tag payload: ${JSON.stringify(body)}`);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'User tags updated',
          user: { _id: 'photo_tags_1', adminTags: body.adminTags },
        }),
      });
    });
    await page.route('**/users/influencer-profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.goto('/admin/admin-user-table');
    await page.locator('button.tab-btn', { hasText: 'Photographers' }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });

    const filterToggle = page.locator('button.filter-toggle-btn');
    if (await filterToggle.isVisible() && ((await filterToggle.textContent()) || '').includes('Expand Filters')) {
      await filterToggle.click();
    }

    await page.locator('button:has-text("Edit Tags")').click();
    await expect(page.locator('h4')).toContainText('Edit Badge / Tag');

    await page.locator('button:has-text("Verified Creator")').click();
    await page.locator('button:has-text("Save")').click();

    await expect(capturedTags).toContain('Verified Creator');
  });

  test('deleted users page shows photographer deleted tab data', async ({ page }) => {
    await page.route('**/admin/influencers?status=deleted', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/brands?status=deleted', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/admin/photographers?status=deleted', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'photo_deleted_1',
            name: 'Deleted Photographer',
            email: 'deleted.photo@e2e.com',
            phoneNumber: '9000000000',
            skills: ['Product'],
            location: { state: 'Tamil Nadu' },
            profileImages: [],
          },
        ]),
      });
    });

    await page.goto('/admin/deleted-users');
    await expect(page.locator('h2')).toContainText('Deleted Users');

    await page.locator('button.tab-btn', { hasText: 'Photographers' }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator('table.admin-table tbody tr')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('table.admin-table tbody tr').first()).toContainText('Deleted Photographer');
  });

  test('collaboration review route renders collaboration-scoped copy', async ({ page }) => {
    await page.route('**/admin/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            campaignApprovalMode: 'manual',
            collaborationApprovalMode: 'manual',
          },
        }),
      });
    });

    await page.route('**/admin/campaigns?**', async (route) => {
      const url = new URL(route.request().url());
      const ownerType = url.searchParams.get('ownerType');
      if (ownerType === 'photographer') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('/admin/collaboration-review');
    await expect(page.locator('h2')).toContainText('Collaboration Review');
    await expect(page.locator('.campaign-queue-title-row strong')).toContainText('Collaboration Approval Queue');
  });
});
