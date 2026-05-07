import { test, expect, Page } from '@playwright/test';

async function setAuthToken(page: Page) {
  const fakeJwt = (() => {
    const header = { alg: 'none', typ: 'JWT' };
    const payload: any = { role: 'influencer', name: 'E2E Inf' };
    payload.userId = 'inf_e2e';
    payload.exp = Math.floor(Date.now() / 1000) + 60 * 60;
    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64(header)}.${b64(payload)}.`;
  })();
  await page.addInitScript(({ jwt }) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('userRole', 'influencer');
    localStorage.setItem('user', JSON.stringify({ role: 'influencer', _id: 'inf_e2e', name: 'E2E Inf' }));
  }, { jwt: fakeJwt });
}

test('Submission page prefers accepted platform/content only', async ({ page }) => {
  await setAuthToken(page);

  // Mock invite+campaign indicating accepted platform YouTube Shorts
  const invite = {
    _id: 'inv_accept_123',
    selectedPlatform: 'YouTube',
    selectedContentType: 'Shorts',
    selectedPostDate: '2026-05-08',
    status: 'accepted',
    campaign: {
      _id: 'camp_e2e',
      title: 'Qualify Campaign',
      campaignType: 'paid_collab',
      socialMedia: [
        { platform: 'Instagram', contentTypes: [{ name: 'Reel', enabled: true }] },
        { platform: 'YouTube', contentTypes: [{ name: 'Shorts', enabled: true }] },
      ],
      platforms: ['Instagram', 'YouTube'],
    }
  };

  await page.route('**/campaign-invites/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { invite: invite, campaign: invite.campaign } }) });
  });

  // Existing submission none
  await page.route('**/campaign-invites/*/submission', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
  });

  // Minimal config endpoints
  await page.route('**/config/platforms', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ name: 'Instagram' }, { name: 'YouTube' }] }) });
  });
  await page.route('**/categories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.goto('/campaign-submission/inv_accept_123');
  await page.waitForSelector('.form-header', { timeout: 5000 });

  // Campaign platforms hint should show only the accepted platform
  const platformHint = page.locator('.alert-info--platform');
  await expect(platformHint).toHaveText(/youtube/i);
  await expect(platformHint).not.toHaveText(/instagram/i);

  // Post type pills should include only Shorts (mapped from accepted content type)
  const pills = page.locator('.pill-group .pill');
  const pillTexts = await pills.allTextContents();
  expect(pillTexts.some(t => /Short/i.test(t))).toBeTruthy();
  expect(pillTexts.some(t => /Reel/i.test(t))).toBeFalsy();
});
