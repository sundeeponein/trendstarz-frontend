import { test, expect, Page } from '@playwright/test';

async function setAuthToken(page: Page, role: 'influencer') {
  const fakeJwt = (() => {
    const header = { alg: 'none', typ: 'JWT' };
    const payload: any = { role, name: 'Test Influencer' };
    payload.userId = role === 'influencer' ? 'inf_e2e' : '';
    payload.exp = Math.floor(Date.now() / 1000) + 60 * 60;
    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64(header)}.${b64(payload)}.`;
  })();
  await page.addInitScript(({ jwt, role }) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('userRole', role);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role, _id: 'inf_e2e', name: 'Test Influencer' }));
  }, { jwt: fakeJwt, role });
}

test('Open campaign preview shows only qualifying platform for tier_filtered_open', async ({ page }) => {
  await setAuthToken(page, 'influencer');

  // Mock influencer profile with Instagram (Micro) and YouTube (Mid-Tier)
  await page.route('**/users/influencer-profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'inf_e2e', name: 'E2E Inf', socialMedia: [ { platform: 'Instagram', tier: 'Micro' }, { platform: 'YouTube', tier: 'Mid-Tier' } ] } }) });
  });

  // Mock auth/me
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { _id: 'inf_e2e', role: 'influencer', name: 'E2E Inf' } }) });
  });

  // Mock campaigns list with tier_filtered_open campaign requiring Mid-Tier
  const campaign = {
    _id: 'camp_e2e',
    title: 'Qualify Campaign',
    status: 'active',
    timelineStart: '2026-05-01',
    timelineEnd: '2026-05-31',
    platforms: ['Instagram', 'YouTube'],
    campaignMode: 'tier_filtered_open',
    minInfluencerTier: 'Mid-Tier',
    socialMedia: [
      { platform: 'Instagram', contentTypes: [{ name: 'Reel', enabled: true }] },
      { platform: 'YouTube', contentTypes: [{ name: 'Shorts', enabled: true }] },
    ],
  };

  await page.route('**/api/campaigns**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [campaign] }) });
  });

  // Minimal mocks for config endpoints used on page
  await page.route('**/config/platforms', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ name: 'Instagram' }, { name: 'YouTube' }] }) });
  });
  await page.route('**/categories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.goto('/campaigns');
  // wait for campaigns to load
  await page.waitForSelector('.campaign-card', { timeout: 5000 });

  // Open campaign preview by clicking the campaign main area
  const firstCardMain = page.locator('.campaign-card').first().locator('.ccard-main');
  await firstCardMain.click();

  // Wait for modal and check relevant outputs
  await page.waitForSelector('.ocp-modal', { timeout: 5000 });
  const outputs = page.locator('.ocp-deliverables .ocp-tag');
  const texts = await outputs.allTextContents();

  // Should include YouTube · Shorts and not Instagram · Reel
  expect(texts.some(t => t.includes('YouTube') && t.includes('Shorts'))).toBeTruthy();
  expect(texts.some(t => t.includes('Instagram') && t.includes('Reel'))).toBeFalsy();
});
