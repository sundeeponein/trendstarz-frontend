import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Campaign management + submission E2E
//
// All API calls are mocked. Tests cover:
//   1. Brand creates a campaign (3-step wizard)
//   2. Brand opens the invite drawer and invites an influencer
//   3. Influencer submits a post (campaign-submission page)
//   4. Brand reviews (approves) a submission
// ─────────────────────────────────────────────────────────────

// ── shared mock data ──────────────────────────────────────────
const BRAND_TOKEN = 'fake-brand-jwt';
const INFLUENCER_TOKEN = 'fake-influencer-jwt';

const MOCK_CAMPAIGN = {
  _id: 'camp_001',
  title: 'E2E Test Campaign',
  description: 'Auto-generated for e2e testing',
  status: 'active',
  timelineStart: '2026-04-15',
  timelineEnd: '2026-05-15',
  budgetMin: 5000,
  budgetMax: 20000,
  brandId: 'brand_001',
  platforms: [],
  categories: [],
};

const MOCK_INVITE = {
  _id: 'invite_001',
  campaignId: 'camp_001',
  influencerId: { _id: 'inf_001', name: 'Test Influencer', username: 'testinfluencer' },
  status: 'pending',
};

const MOCK_SUBMISSION = {
  _id: 'sub_001',
  inviteId: 'invite_001',
  campaignId: 'camp_001',
  influencerId: { _id: 'inf_001', name: 'Test Influencer', username: 'testinfluencer' },
  postUrl: 'https://www.instagram.com/p/testpost123',
  postType: 'reel',
  postPlatform: 'instagram',
  reachCount: 5000,
  viewsCount: 8000,
  likesCount: 300,
  commentsCount: 45,
  sharesCount: 20,
  status: 'submitted',
  postScreenshotUrl: 'https://res.cloudinary.com/test/image/upload/screenshot.png',
};

// ── helper: inject auth token into localStorage ───────────────
async function setAuthToken(page: Page, token: string, role: 'brand' | 'influencer') {
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', role);
  }, { token, role });
}

// ── mock common API routes ────────────────────────────────────
async function mockCommonRoutes(page: Page) {
  // States & categories config
  await page.route('**/config/states', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }) });
  });
  await page.route('**/config/categories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'cat1', name: 'Fashion' }, { _id: 'cat2', name: 'Tech' }] }) });
  });
  await page.route('**/config/platforms', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ name: 'Instagram' }, { name: 'YouTube' }] }) });
  });
  // Cloudinary
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/test/image/upload/img.png', public_id: 'e2e_id' }) });
  });
}

// ─────────────────────────────────────────────────────────────
// TEST SUITE 1: Brand creates a campaign
// ─────────────────────────────────────────────────────────────
test.describe('Brand — create campaign', () => {
  test('opens campaign form modal and creates a campaign (mocked API)', async ({ page }) => {
    await setAuthToken(page, BRAND_TOKEN, 'brand');
    await mockCommonRoutes(page);

    // Brand campaigns list
    await page.route('**/campaigns**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, campaigns: [] }) });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ success: true, campaign: MOCK_CAMPAIGN }) });
      } else {
        await route.continue();
      }
    });

    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Click "Create Campaign" or any "+" / new campaign button
    const createBtn = page.locator(
      'button:has-text("Create Campaign"), button:has-text("New Campaign"), button[aria-label*="create"], button.btn-create'
    ).first();
    await createBtn.waitFor({ state: 'visible', timeout: 8000 });
    await createBtn.click();

    // ── Step 1: Campaign details ──────────────────────────
    await page.waitForSelector('.form-modal', { state: 'visible', timeout: 5000 });
    await page.fill('input[formControlName="title"]', 'E2E Test Campaign');
    await page.fill('textarea[formControlName="description"]', 'Created via automated E2E test');

    // Dates
    await page.fill('input[formControlName="timelineStart"]', '2026-05-01');
    await page.fill('input[formControlName="timelineEnd"]', '2026-05-31');

    await page.click('button:has-text("Next"), button:has-text("Next — Requirements")');

    // ── Step 2: Requirements ────────────────────────────
    // Select a platform chip
    const instagramChip = page.locator('.chip--platform:has-text("Instagram"), .chip:has-text("Instagram")').first();
    if (await instagramChip.count() > 0) {
      await instagramChip.click();
    }

    await page.click('button:has-text("Next"), button:has-text("Next — Review")');

    // ── Step 3: Invite / Review ─────────────────────────
    // Submit / Save the campaign
    const saveBtn = page.locator('button:has-text("Launch"), button:has-text("Save"), button:has-text("Create")').last();
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveBtn.click();

    // Modal should close
    await expect(page.locator('.form-modal')).not.toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 2: Brand invites an influencer
// ─────────────────────────────────────────────────────────────
test.describe('Brand — invite influencer', () => {
  test('opens invite drawer and sends invite (mocked API)', async ({ page }) => {
    await setAuthToken(page, BRAND_TOKEN, 'brand');
    await mockCommonRoutes(page);

    // Provide a campaign already in the list
    await page.route('**/campaigns**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, campaigns: [MOCK_CAMPAIGN] }) });
      } else {
        await route.continue();
      }
    });

    // Influencer search
    await page.route('**/users/influencers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [
          { _id: 'inf_001', name: 'Test Influencer', username: 'testinfluencer',
            profileImages: [], socialMedia: [{ platform: 'Instagram', followersCount: 5000 }] }
        ] }) });
    });

    // Existing invites list
    await page.route('**/campaign-invites/campaign/**/invites**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, invites: [] }) });
    });

    // Send invite
    await page.route('**/campaign-invites/invite', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ success: true, invite: MOCK_INVITE }) });
    });

    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Expand campaign card
    const campaignCard = page.locator('.campaign-card, .c-card').first();
    await campaignCard.waitFor({ state: 'visible', timeout: 8000 });
    await campaignCard.click();

    // Open invite panel
    const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add Influencer"), button[aria-label*="invite"]').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await inviteBtn.click();

    // Drawer should open
    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });

    // Switch to Find & Invite tab
    await page.click('.drawer-tab:has-text("Find")');

    // Search for influencer
    const searchInput = page.locator('.drawer-search-input, input[placeholder*="Search"]').first();
    await searchInput.fill('testinfluencer');

    // Select influencer checkbox
    const infCheckbox = page.locator('.inf-checkbox, input[type="checkbox"]').first();
    await infCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    await infCheckbox.check();

    // Send invites
    const sendBtn = page.locator('button:has-text("Send Invite"), button:has-text("Invite Selected")').first();
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();

    // Success indicator — the invite should appear in the Invited tab
    await page.click('.drawer-tab:has-text("Invited")');
    await expect(page.locator('.invited-row, .invited-list')).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 3: Influencer submits a post
// ─────────────────────────────────────────────────────────────
test.describe('Influencer — submit campaign post', () => {
  test('fills submission form and submits (mocked API)', async ({ page }) => {
    await setAuthToken(page, INFLUENCER_TOKEN, 'influencer');
    await mockCommonRoutes(page);

    // Pre-existing submission: none
    await page.route('**/campaign-invites/invite_001/submission', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: null }) });
    });

    // Invite details for the status bar
    await page.route('**/campaign-invites/invite_001', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, invite: MOCK_INVITE }) });
    });

    // Campaign details
    await page.route('**/campaigns/camp_001', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, campaign: MOCK_CAMPAIGN }) });
    });

    // Cloudinary upload
    await page.route('**/api.cloudinary.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/test/image/upload/screenshot.png' }) });
    });

    // Submit endpoint
    await page.route('**/campaign-invites/invite_001/submit', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: MOCK_SUBMISSION }) });
    });

    await page.goto('/campaign-submission/invite_001');
    await page.waitForSelector('input[placeholder*="instagram"]', { state: 'visible', timeout: 8000 });

    // Fill post URL
    await page.fill('input[placeholder*="instagram"], input[placeholder*="https://"]', 'https://www.instagram.com/p/abc123');

    // Select post type
    const reelPill = page.locator('.pill:has-text("Reel"), .pill:has-text("reel")').first();
    if (await reelPill.count() > 0) await reelPill.click();

    // Fill caption
    await page.fill('textarea', 'This is my campaign post caption #ad');

    // Upload screenshot (required)
    const screenshotInput = page.locator('input[type="file"][accept*="image"]').first();
    await screenshotInput.setInputFiles({
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-content'),
    });
    await page.waitForTimeout(1000);

    // Open stats section and fill metrics
    const statsToggle = page.locator('.stats-toggle, button:has-text("Add performance stats")').first();
    if (await statsToggle.count() > 0) {
      await statsToggle.click();
      await page.fill('input[type="number"]', '8000');  // Views (first number input in stats)
    }

    // Submit
    const submitBtn = page.locator('.btn-submit, button:has-text("Submit Post"), button[type="submit"]').first();
    await submitBtn.waitFor({ state: 'visible' });
    await submitBtn.click();

    // Should show success screen
    await expect(page.locator('.success-screen, h2:has-text("Report Submitted")')).toBeVisible({ timeout: 8000 });
  });

  test('shows error when postUrl is missing and submit is clicked', async ({ page }) => {
    await setAuthToken(page, INFLUENCER_TOKEN, 'influencer');

    await page.route('**/campaign-invites/invite_001/submission', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: null }) });
    });
    await page.route('**/campaign-invites/invite_001', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, invite: MOCK_INVITE }) });
    });
    await page.route('**/campaigns/camp_001', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, campaign: MOCK_CAMPAIGN }) });
    });

    await page.goto('/campaign-submission/invite_001');
    await page.waitForSelector('.btn-submit, button[type="submit"]', { state: 'visible', timeout: 8000 });

    // Submit without filling anything — button should be disabled (canSubmit() = false)
    const submitBtn = page.locator('.btn-submit, button[type="submit"]').first();
    await expect(submitBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 4: Brand reviews (approves) a submission
// ─────────────────────────────────────────────────────────────
test.describe('Brand — review submission', () => {
  test('approves a submitted post (mocked API)', async ({ page }) => {
    await setAuthToken(page, BRAND_TOKEN, 'brand');
    await mockCommonRoutes(page);

    const campaignWithSubmission = { ...MOCK_CAMPAIGN };

    await page.route('**/campaigns**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, campaigns: [campaignWithSubmission] }) });
    });

    // Submissions for this campaign
    await page.route('**/campaign-invites/campaign/**/submissions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, submissions: [MOCK_SUBMISSION] }) });
    });

    // Existing invites
    await page.route('**/campaign-invites/campaign/**/invites**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, invites: [MOCK_INVITE] }) });
    });

    // Review endpoint
    await page.route('**/campaign-invites/**/review', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submission approved' }) });
    });

    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Expand campaign
    const campaignCard = page.locator('.campaign-card, .c-card').first();
    await campaignCard.waitFor({ state: 'visible', timeout: 8000 });
    await campaignCard.click();

    // Submission section should show
    await expect(page.locator('.submissions-section, .submission-card')).toBeVisible({ timeout: 5000 });

    // Approve the submission
    const approveBtn = page.locator('button:has-text("Mark Completed"), button.btn-sub-approve').first();
    await approveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await approveBtn.click();

    // Status chip should update to approved
    await expect(
      page.locator('.sub-status-chip:has-text("approved"), .sub-status-chip:has-text("APPROVED")')
    ).toBeVisible({ timeout: 5000 });
  });
});
