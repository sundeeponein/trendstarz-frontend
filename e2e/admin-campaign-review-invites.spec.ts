import { test, expect, Page } from '@playwright/test';

type InviteRole = 'influencer' | 'photographer';
type CampaignStatus = 'pending_review' | 'active';

type ParticipantProfile = {
  _id: string;
  name: string;
  username: string;
  email: string;
  profileImages?: Array<{ url: string }>;
};

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJuYW1lIjoiQWRtaW4iLCJfaWQiOiJhZG1pbl8wMDEifQ.fake';
const BRAND = {
  _id: 'brand_001',
  brandName: 'Carol\'s Cosmetics',
  email: 'carol@trendstarz.test',
};

const PHOTOGRAPHER_PROFILES: ParticipantProfile[] = [
  {
    _id: 'photo_001',
    name: 'Riya Lenscraft',
    username: 'riya-lenscraft',
    email: 'riya@trendstarz.test',
    profileImages: [{ url: 'https://images.test/riya.png' }],
  },
  {
    _id: 'photo_002',
    name: 'Arjun Frame Works',
    username: 'arjunframeworks',
    email: 'arjun@trendstarz.test',
  },
];

const INFLUENCER_PROFILES: ParticipantProfile[] = [
  {
    _id: 'inf_001',
    name: 'Sundeep',
    username: 'sundeep',
    email: 'sundeep@trendstarz.test',
    profileImages: [{ url: 'https://images.test/sundeep.png' }],
  },
  {
    _id: 'inf_002',
    name: 'Nisha Reels',
    username: 'nishareels',
    email: 'nisha@trendstarz.test',
  },
];

function makeCampaign(status: CampaignStatus, role: InviteRole) {
  const suffix = `${status}_${role}`;
  return {
    _id: `camp_${suffix}`,
    title: `Trendstarz ${status === 'pending_review' ? 'Pending' : 'Active'} ${role}`,
    description: `Admin review preview for ${role}`,
    status,
    campaignType: 'paid_collab',
    inviteRecipientRole: role,
    requestKind: role === 'photographer' ? 'creative_requirement' : 'brand_campaign',
    ownerType: 'brand',
    brand: BRAND,
    brandId: BRAND,
    budgetMin: 2500,
    maxInfluencers: role === 'photographer' ? 3 : 2,
    inviteCount: role === 'photographer' ? 2 : 2,
    updatedAt: '2026-05-29T10:00:00.000Z',
    createdAt: '2026-05-29T09:00:00.000Z',
    inviteProgress: [
      {
        inviteId: `placeholder_${suffix}`,
        participantId: `${role}_placeholder`,
        participantRole: role === 'photographer' ? 'influencer' : 'influencer',
        participantName: role === 'photographer' ? 'Photographer' : 'Influencer',
        participantAvatar: '',
        participantUsername: '',
        participantEmail: '',
        status: 'pending',
        updatedAt: '2026-05-29T09:30:00.000Z',
      },
    ],
  };
}

function makeInvites(role: InviteRole) {
  const ids = role === 'photographer'
    ? PHOTOGRAPHER_PROFILES.map((profile) => profile._id)
    : INFLUENCER_PROFILES.map((profile) => profile._id);

  return ids.map((id, index) => ({
    _id: `invite_${role}_${index + 1}`,
    recipientRole: role,
    status: index === 0 ? 'pending' : 'working',
    updatedAt: `2026-05-29T10:0${index + 1}:00.000Z`,
    createdAt: `2026-05-29T09:5${index}:00.000Z`,
    influencerId: role === 'influencer' ? id : undefined,
    photographerId: role === 'photographer' ? id : undefined,
  }));
}

async function setAdminAuth(page: Page) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role: 'admin', _id: 'admin_001', name: 'Admin' }));
  }, { token: ADMIN_TOKEN });
}

async function mockCampaignReviewRoutes(page: Page) {
  const campaigns = [
    makeCampaign('pending_review', 'photographer'),
    makeCampaign('pending_review', 'influencer'),
    makeCampaign('active', 'photographer'),
    makeCampaign('active', 'influencer'),
  ];

  const allProfiles = new Map<string, ParticipantProfile>([
    ...PHOTOGRAPHER_PROFILES.map((profile) => [profile._id, profile]),
    ...INFLUENCER_PROFILES.map((profile) => [profile._id, profile]),
  ]);

  await page.route('**/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { _id: 'admin_001', role: 'admin', name: 'Admin' } }),
    });
  });

  await page.route('**/admin/settings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { campaignApprovalMode: 'manual', collaborationApprovalMode: 'manual' } }),
    });
  });

  await page.route(/.*\/admin\/campaigns\?.*ownerType=brand.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: campaigns }),
    });
  });

  await page.route('**/campaign-invites/campaign/**', async (route) => {
    const url = route.request().url();
    const campaignId = url.split('/campaign/')[1]?.split('?')[0] || '';
    const matching = campaigns.find((campaign) => campaign._id === campaignId);
    const role = matching?.inviteRecipientRole === 'photographer' ? 'photographer' : 'influencer';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: makeInvites(role) }),
    });
  });

  await page.route('**/users/photographers/**', async (route) => {
    const id = route.request().url().split('/users/photographers/')[1]?.split('?')[0] || '';
    const profile = allProfiles.get(id);
    await route.fulfill({
      status: profile ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(profile ? { success: true, data: { photographer: profile } } : { success: false }),
    });
  });

  await page.route('**/users/influencers/**', async (route) => {
    const id = route.request().url().split('/users/influencers/')[1]?.split('?')[0] || '';
    const profile = allProfiles.get(id);
    await route.fulfill({
      status: profile ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(profile ? { success: true, data: { influencer: profile } } : { success: false }),
    });
  });
}

async function openCampaignPreview(page: Page, title: string) {
  const row = page.locator('table.campaign-review-table tbody tr').filter({ has: page.locator('button.review-campaign-link', { hasText: title }) }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  const clicked = await row.locator('button.review-campaign-link').click({ force: true }).then(() => true).catch(() => false);
  if (!clicked) {
    await page.evaluate((campaignTitle) => {
      const buttons = Array.from(document.querySelectorAll('button.review-campaign-link')) as HTMLButtonElement[];
      const target = buttons.find((btn) => (btn.textContent || '').includes(campaignTitle));
      target?.click();
    }, title);
  }
  await expect(page.locator('.ts-modal--wizard')).toBeVisible({ timeout: 10000 });
}

async function clickStatusTab(page: Page, label: string) {
  const clicked = await page.locator('.tab-btn', { hasText: label }).first().click({ force: true }).then(() => true).catch(() => false);
  if (!clicked) {
    await page.evaluate((tabLabel) => {
      const buttons = Array.from(document.querySelectorAll('.tab-btn')) as HTMLButtonElement[];
      const target = buttons.find((btn) => (btn.textContent || '').includes(tabLabel));
      target?.click();
    }, label);
  }
}

async function closePreviewModal(page: Page) {
  const clicked = await page.locator('.cdm-btn', { hasText: 'Close' }).first().click({ force: true }).then(() => true).catch(() => false);
  if (!clicked) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.cdm-btn')) as HTMLButtonElement[];
      const closeButton = buttons.find((btn) => (btn.textContent || '').trim() === 'Close');
      closeButton?.click();
    });
  }
  await expect(page.locator('.ts-modal--wizard')).toBeHidden({ timeout: 10000 });
}

async function expectParticipantsLoaded(page: Page, role: InviteRole) {
  const loading = page.locator('.cdm-invite-progress-empty', { hasText: 'Loading invited participants...' });

  const primaryName = role === 'photographer' ? 'Riya Lenscraft' : 'Sundeep';
  const primaryUsername = role === 'photographer' ? '@riya-lenscraft' : '@sundeep';
  const secondaryName = role === 'photographer' ? 'Arjun Frame Works' : 'Nisha Reels';
  const roleLabel = role === 'photographer' ? 'Photographer' : 'Influencer';

  await expect(page.locator('.cdm-invite-progress-name', { hasText: primaryName })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.cdm-invite-progress-meta', { hasText: primaryUsername })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.cdm-invite-progress-name', { hasText: secondaryName })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.cdm-invite-progress-meta', { hasText: roleLabel }).first()).toBeVisible({ timeout: 10000 });
  await expect(loading).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('.cdm-pill--invite-summary', { hasText: 'Pending: 1' })).toBeVisible();
  await expect(page.locator('.cdm-pill--invite-summary', { hasText: 'Working: 1' })).toBeVisible();
}

test.describe('Admin campaign review invited participants', () => {
  test.beforeEach(async ({ page }) => {
    await setAdminAuth(page);
    await mockCampaignReviewRoutes(page);
  });

  test('pending review reuses invited participants block for photographer and influencer campaigns', async ({ page }) => {
    await page.goto('/admin/campaign-review');
    await expect(page.locator('h2')).toContainText('Campaign Review');
    await expect(page.locator('.tab-btn.active')).toContainText('Pending Review');

    await openCampaignPreview(page, 'Trendstarz Pending photographer');
    await expect(page.locator('.cdm-section-label', { hasText: 'INVITED PARTICIPANTS & PROGRESS' })).toBeVisible();
    await expectParticipantsLoaded(page, 'photographer');
    await closePreviewModal(page);

    await openCampaignPreview(page, 'Trendstarz Pending influencer');
    await expectParticipantsLoaded(page, 'influencer');
  });

  test('approved live reuses invited participants block for photographer and influencer campaigns', async ({ page }) => {
    await page.goto('/admin/campaign-review');
    await expect(page.locator('h2')).toContainText('Campaign Review');
    await clickStatusTab(page, 'Approved / Live');
    await expect(page.locator('.tab-btn.active')).toContainText('Approved / Live');

    await openCampaignPreview(page, 'Trendstarz Active photographer');
    await expect(page.locator('.cdm-section-label', { hasText: 'INVITED PARTICIPANTS & PROGRESS' })).toBeVisible();
    await expectParticipantsLoaded(page, 'photographer');
    await closePreviewModal(page);

    await openCampaignPreview(page, 'Trendstarz Active influencer');
    await expectParticipantsLoaded(page, 'influencer');
  });
});
