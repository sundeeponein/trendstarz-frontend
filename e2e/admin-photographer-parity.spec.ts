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
    await expect(page.getByRole('heading', { name: 'Admin Users' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button.role-tab', { hasText: 'Photographers' })).toBeVisible();

    await page.locator('button.role-tab', { hasText: 'Photographers' }).click();
    const rows = page.locator('table.users-table tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    await expect(rows.first()).toContainText('Photo One');
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
    await page.locator('button.role-tab', { hasText: 'Photographers' }).click();

    const rows = page.locator('table.users-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 10000 });

    await expect(rows.first()).toContainText('FREE');
    await expect(rows.nth(1)).toContainText('PREMIUM');

    const statusFilter = page.locator('.filters-grid select').nth(0);
    const premiumFilter = page.locator('.filters-grid select').nth(1);
    const categoryFilter = page.locator('.filters-grid select').nth(2);

    await statusFilter.selectOption('accepted');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Arjun Frame Works');

    await premiumFilter.selectOption('free');
    await expect(rows).toHaveCount(0);

    await page.click('button.reset-btn:has-text("Reset")');
    await expect(rows).toHaveCount(2);

    await categoryFilter.selectOption('Fashion');
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
    await page.locator('button.role-tab', { hasText: 'Photographers' }).click();

    const firstRow = page.locator('table.users-table tbody tr').first();
    await expect(firstRow).toContainText('Taggable Photographer');
    await firstRow.locator('button.btn-outline-info').click();

    await page.locator('.modal-footer.details-actions button:has-text("Edit Tags")').click();
    await expect(page.locator('.modal.show .modal-header h4', { hasText: 'Edit Badge / Tag' })).toBeVisible();

    await page.locator('button:has-text("Verified Creator")').click();
    await page.locator('.modal.show .modal-actions button:has-text("Save")').click();

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
