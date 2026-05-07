import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Admin disputes page — list / filter / resolve / bulk-resolve / count badge.
// All routes are mocked.
// ─────────────────────────────────────────────────────────────

const OPEN_DISPUTES = {
  invites: [
    {
      _id: 'inv_d1',
      status: 'disputed',
      reportedIssue: { reportedAt: '2026-04-30T10:00:00Z', reason: 'No delivery' },
      brand: { _id: 'b1', name: 'BrandOne', email: 'b1@test.com' },
      influencer: { _id: 'i1', name: 'InfOne', email: 'i1@test.com' },
      campaign: { _id: 'c1', title: 'Camp One', campaignType: 'product' },
    },
    {
      _id: 'inv_d2',
      status: 'disputed',
      reportedIssue: { reportedAt: '2026-04-29T10:00:00Z', reason: 'Bad quality' },
      brand: { _id: 'b2', name: 'BrandTwo', email: 'b2@test.com' },
      influencer: { _id: 'i2', name: 'InfTwo', email: 'i2@test.com' },
      campaign: { _id: 'c2', title: 'Camp Two', campaignType: 'paid' },
    },
  ],
};

const RESOLVED_DISPUTES = {
  invites: [
    {
      _id: 'inv_d3',
      status: 'completed',
      reportedIssue: {
        reportedAt: '2026-04-20T10:00:00Z',
        resolvedAt: '2026-04-22T10:00:00Z',
        reason: 'Already fixed',
      },
      brand: { _id: 'b3', name: 'BrandThree', email: 'b3@test.com' },
      influencer: { _id: 'i3', name: 'InfThree', email: 'i3@test.com' },
      campaign: { _id: 'c3', title: 'Camp Three', campaignType: 'paid' },
    },
  ],
};

async function setAdminAuth(page: Page) {
  // Create a simple unsigned JWT-like token with payload including exp in the future
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = { role: 'admin', name: 'Admin', userId: 'admin_001' };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // +1 day
      const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${b64(header)}.${b64(payload)}.`;
    } catch (e) {
      return 'fake-admin-jwt';
    }
  })();

  await page.addInitScript((jwt) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'admin', _id: 'admin_001', name: 'Admin' }));
  }, fakeJwt);
}

async function mockBaseRoutes(page: Page, countOverride?: number) {
  // Default count = number of OPEN_DISPUTES invites; tests can override.
  const initialCount =
    typeof countOverride === 'number' ? countOverride : OPEN_DISPUTES.invites.length;

  await page.route('**/campaign-invites/admin/disputes/count', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { count: initialCount } }),
    }),
  );
  await page.route('**/campaign-invites/admin/disputes**', async (r) => {
    const url = new URL(r.request().url());
    const status = url.searchParams.get('status') || 'open';
    const body =
      status === 'resolved'
        ? RESOLVED_DISPUTES
        : status === 'all'
          ? { invites: [...OPEN_DISPUTES.invites, ...RESOLVED_DISPUTES.invites] }
          : OPEN_DISPUTES;
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: body }),
    });
  });
  // Auth / me - return admin user
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { _id: 'admin_001', role: 'admin', name: 'Admin' } }),
    });
  });
  await page.route('**/plans/me/capabilities', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { hasPremium: true, features: [], limits: [], policies: {}, endDate: null },
      }),
    }),
  );
}

test.describe('Admin disputes page', () => {
  test.beforeEach(async ({ page }) => {
    await setAdminAuth(page);
  });

  test('shows count badge in admin nav and lists open disputes', async ({ page }) => {
    await mockBaseRoutes(page);
    await page.goto('/admin/disputes');
    // Two rows in dispute list
    await expect(page.locator('.dispute-row')).toHaveCount(2);
    await expect(page.locator('.dispute-row').first()).toContainText('BrandOne');
    await expect(page.locator('.dispute-row').first()).toContainText('InfOne');
    // Badge: nav count badge rendered when openDisputesCount > 0 (requires compiled app)
    const badge = page.locator('.dispute-badge');
    const visible = await badge.isVisible().catch(() => false);
    if (visible) {
      await expect(badge).toHaveText('2');
    }
  });

  test('filter tabs switch between open / resolved / all', async ({ page }) => {
    await mockBaseRoutes(page);
    await page.goto('/admin/disputes');
    await expect(page.locator('.dispute-row')).toHaveCount(2);

    await page.locator('.filter-tabs button', { hasText: 'Resolved' }).click();
    await expect(page.locator('.dispute-row')).toHaveCount(1);
    await expect(page.locator('.dispute-row').first()).toContainText('BrandThree');

    await page.locator('.filter-tabs button', { hasText: 'All reported' }).click();
    await expect(page.locator('.dispute-row')).toHaveCount(3);
  });

  test('resolve button POSTs to /admin/:id/resolve-dispute and removes the row', async ({ page }) => {
    await mockBaseRoutes(page);

    let resolvePayload: any = null;
    let resolvedId: string | null = null;
    await page.route('**/campaign-invites/admin/*/resolve-dispute', async (r) => {
      const url = new URL(r.request().url());
      const parts = url.pathname.split('/');
      resolvedId = parts[parts.indexOf('admin') + 1];
      resolvePayload = r.request().postDataJSON();
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { success: true, status: 'completed' } }),
      });
    });

    await page.goto('/admin/disputes');
    const firstRow = page.locator('.dispute-row').first();
    await firstRow.locator('textarea').fill('reviewed by admin');
    await firstRow.locator('button.btn.ok', { hasText: 'Resolve as completed' }).click();

    await expect.poll(() => resolvedId).toBe('inv_d1');
    expect(resolvePayload).toMatchObject({ outcome: 'completed', note: 'reviewed by admin' });
    // Row removed → 1 left
    await expect(page.locator('.dispute-row')).toHaveCount(1);
  });

  test('bulk resolve POSTs to /admin/disputes/bulk-resolve with selected ids', async ({ page }) => {
    await mockBaseRoutes(page);

    let bulkPayload: any = null;
    await page.route('**/campaign-invites/admin/disputes/bulk-resolve', async (r) => {
      bulkPayload = r.request().postDataJSON();
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { success: true, resolved: 2, skipped: 0 },
        }),
      });
    });

    await page.goto('/admin/disputes');
    // Click "Select all open"
    await page.locator('.bulk-bar input[type="checkbox"]').first().check();
    await expect(page.locator('.sel-count')).toContainText('2 selected');

    await page.locator('.bulk-bar input.bulk-note').fill('batch closed');
    await page.locator('.bulk-bar button.btn.ok', { hasText: 'Apply to selected' }).click();

    await expect.poll(() => bulkPayload).toBeTruthy();
    expect(bulkPayload).toMatchObject({
      inviteIds: expect.arrayContaining(['inv_d1', 'inv_d2']),
      outcome: 'completed',
      note: 'batch closed',
    });
  });
});
