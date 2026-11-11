import { test, expect, Page } from '@playwright/test';

type InviteState = 'accepted' | 'payment_confirmed' | 'submitted';

async function setInfluencerAuth(page: Page) {
  const fakeJwt = (() => {
    const header = { alg: 'none', typ: 'JWT' };
    const payload: any = { role: 'influencer', name: 'E2E Influencer' };
    payload.userId = 'inf_e2e';
    payload.exp = Math.floor(Date.now() / 1000) + 60 * 60;
    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64(header)}.${b64(payload)}.`;
  })();

  await page.addInitScript(({ jwt }) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('userRole', 'influencer');
    localStorage.setItem('user', JSON.stringify({ role: 'influencer', _id: 'inf_e2e', name: 'E2E Influencer' }));
  }, { jwt: fakeJwt });
}

async function mockSubmissionState(page: Page, state: InviteState) {
  const inviteId = 'inv_state_001';
  const campaign = {
    _id: 'camp_state_001',
    title: 'State Gating Campaign',
    campaignType: 'paid_collab',
    socialMedia: [
      { platform: 'Instagram', contentTypes: [{ name: 'Reel', enabled: true }] },
    ],
    platforms: ['Instagram'],
  };
  const invite = {
    _id: inviteId,
    status: state,
    selectedPlatform: 'Instagram',
    selectedContentType: 'Reel',
    selectedPostDate: '2026-05-20',
  };

  await page.route('**/campaign-invites/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST' && url.includes('/submit')) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: { postUrl: 'https://www.instagram.com/p/ok123' } }),
      });
      return;
    }

    if (method === 'GET' && url.includes('/submission')) {
      if (state === 'submitted') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            submission: {
              postUrl: 'https://www.instagram.com/p/submitted123',
              postType: 'reel',
              captionUsed: 'Submitted content proof',
              postScreenshotUrl: 'https://example.com/proof.png',
              viewsCount: 1000,
              likesCount: 120,
              commentsCount: 20,
              sharesCount: 10,
              reachCount: 900,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, submission: null }),
        });
      }
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          invite,
          campaign,
          data: { invite, campaign },
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false }) });
  });

  await page.route('**/config/platforms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ name: 'Instagram' }] }),
    });
  });

  await page.route('**/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

test.describe('Campaign submission state gating', () => {
  test('accepted paid_collab blocks submission until payment confirmation', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockSubmissionState(page, 'accepted');

    await page.goto('/campaign-submission/inv_state_001');
    await page.waitForSelector('.form-header', { timeout: 15000 });

    await expect(page.locator('text=Payment verification is in progress')).toBeVisible();
    await expect(page.locator('.btn-submit')).toHaveCount(0);
    await expect(page.locator('.form-section')).toHaveCount(0);
  });

  test('payment_confirmed allows entering and submitting post URL', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockSubmissionState(page, 'payment_confirmed');

    await page.goto('/campaign-submission/inv_state_001');
    await page.waitForSelector('.form-header', { timeout: 15000 });

    const submitBtn = page.locator('.btn-submit').first();
    await expect(submitBtn).toBeVisible();
    await expect(page.locator('text=Payment verification is in progress')).toHaveCount(0);

    const postUrlInput = page.locator('input[type="url"]').first();
    await postUrlInput.fill('https://www.instagram.com/p/live123');
    await postUrlInput.blur();

    await expect(submitBtn).toBeEnabled();
  });

  test('submitted state is read-only and shows submitted details', async ({ page }) => {
    await setInfluencerAuth(page);
    await mockSubmissionState(page, 'submitted');

    await page.goto('/campaign-submission/inv_state_001');
    await page.waitForSelector('.form-header', { timeout: 15000 });

    await expect(page.locator('text=Your submission is locked and cannot be edited')).toBeVisible();
    await expect(page.locator('.summary-title')).toHaveText(/Submitted details/i);
    await expect(page.locator('.summary-link')).toHaveText(/instagram.com\/p\/submitted123/i);
    await expect(page.locator('.btn-submit')).toHaveCount(0);
  });
});
