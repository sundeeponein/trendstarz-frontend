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
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem('user', JSON.stringify({ role, _id: role === 'brand' ? 'brand_001' : 'inf_001', name: role === 'brand' ? 'Test Brand' : 'Test Influencer' }));
  }, { token, role });
}

// ── mock common API routes ────────────────────────────────────
async function mockCommonRoutes(page: Page) {
  // States & categories config
  await page.route('**/config/states', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'state_mh', name: 'Maharashtra' }] }) });
  });
  await page.route('**/categories', async (route) => {
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
  // Brand profile (needed by campaign-management for brandId)
  await page.route('**/users/brand-profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { brand: { _id: 'brand_001', brandName: 'TestBrand', brandUsername: 'testbrand' } } }) });
  });
  // Social media platforms
  await page.route('**/social-media', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'sm_ig', name: 'Instagram', icon: 'bi bi-instagram', color: '#E1306C', contentTypes: [{ key: 'post', label: 'Post', price: 0 }] }] }) });
  });
  // Languages
  await page.route('**/languages', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ _id: 'lang1', name: 'English' }] }) });
  });
}

// ─────────────────────────────────────────────────────────────
// TEST SUITE 1: Brand creates a campaign
// ─────────────────────────────────────────────────────────────
test.describe('Brand — create campaign', () => {
  test('opens campaign form modal and creates a campaign (mocked API)', async ({ page }) => {
    await setAuthToken(page, BRAND_TOKEN, 'brand');
    await mockCommonRoutes(page);

    // Brand campaigns list (brand fetches by name "TestBrand")
    await page.route('**/campaigns/brand-name/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }) });
    });

    // Create campaign POST
    await page.route('**/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_CAMPAIGN }) });
      } else {
        await route.continue();
      }
    });

    // Mock influencers for step 3
    await page.route('**/users/influencers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('/campaigns');
    // Wait for hydration and brand profile to load (sets brandId)
    await page.waitForTimeout(3000);

    // Click "New Campaign" button
    const createBtn = page.locator('button.btn-create').first();
    await createBtn.waitFor({ state: 'visible', timeout: 8000 });
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
    await createBtn.click();

    // ── Step 1: Campaign details ──────────────────────────
    await page.waitForSelector('.form-modal', { state: 'visible', timeout: 5000 });
    await page.fill('input[formControlName="title"]', 'E2E Test Campaign');
    await page.fill('textarea[formControlName="description"]', 'Created via automated E2E test');
    await page.fill('input[formControlName="timelineStart"]', '2026-05-01');
    await page.fill('input[formControlName="timelineEnd"]', '2026-05-31');

    const nextReqBtn = page.locator('button:has-text("Next — Requirements")').first();
    await nextReqBtn.scrollIntoViewIfNeeded();
    await nextReqBtn.click({ force: true });

    // ── Step 2: Requirements ────────────────────────────
    // Wait for step 2 content
    await page.waitForTimeout(500);

    // Select a category chip (required for campaign creation)
    const fashionChip = page.locator('.chip:has-text("Fashion")').first();
    if (await fashionChip.count() > 0) {
      await fashionChip.click();
    }

    // Select a platform chip (Instagram)
    const instagramChip = page.locator('.chip--platform:has-text("Instagram"), .chip:has-text("Instagram")').first();
    if (await instagramChip.count() > 0) {
      await instagramChip.click();
    }

    const nextInvBtn = page.locator('button:has-text("Next — Invite influencers")').first();
    await nextInvBtn.scrollIntoViewIfNeeded();
    await nextInvBtn.click({ force: true });

    // ── Step 3: Invite / Skip ─────────────────────────
    await page.waitForTimeout(500);

    // Click "Skip & create" to create without inviting
    const skipBtn = page.locator('button:has-text("Skip")').first();
    await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipBtn.scrollIntoViewIfNeeded();
    await skipBtn.click({ force: true });

    // Wait for form to process and close
    await page.waitForTimeout(2000);
    await page.locator('body').click(); // trigger CD

    // Modal should close
    await expect(page.locator('.form-modal')).not.toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 2: Brand invites an influencer
// ─────────────────────────────────────────────────────────────
test.describe('Brand — invite influencer', () => {
  test('opens invite drawer and sends invite (mocked API)', async ({ page }) => {
    await setAuthToken(page, BRAND_TOKEN, 'brand');
    await mockCommonRoutes(page);

    // Provide a campaign already in the list (brand fetches by name)
    await page.route('**/campaigns/brand-name/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_CAMPAIGN] }) });
    });

    // Track whether an invite has been sent (for dynamic mock responses)
    let inviteSent = false;

    // Invites & submissions for this campaign (single handler)
    await page.route('**/campaign-invites/campaign/camp_001**', async (route) => {
      const url = route.request().url();
      if (url.includes('/submissions')) {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }) });
      } else {
        // After invite is sent, return the invite in the list
        const invites = inviteSent ? [MOCK_INVITE] : [];
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: invites }) });
      }
    });

    // Influencer search (all influencers for invite panel)
    await page.route('**/users/influencers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [
          { _id: 'inf_001', name: 'Test Influencer', username: 'testinfluencer', fullName: 'Test Influencer',
            profileImages: [], socialMedia: [{ platform: 'Instagram', followersCount: 5000 }] }
        ] }) });
    });

    // Send invite
    await page.route('**/campaign-invites', async (route) => {
      if (route.request().method() === 'POST') {
        inviteSent = true;
        await route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ success: true, invite: MOCK_INVITE }) });
      } else {
        await route.continue();
      }
    });

    await page.goto('/campaigns');
    // Wait for hydration and brand profile to load
    await page.waitForTimeout(3000);

    // Click "Invite" button directly (no need to expand first)
    const inviteBtn = page.locator('.btn-invite').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 8000 });
    await inviteBtn.click();

    // Drawer should open
    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });

    // Switch to "Find & Invite" tab
    const findTab = page.locator('.drawer-tab:has-text("Find")').first();
    await findTab.waitFor({ state: 'visible', timeout: 5000 });
    await findTab.click();
    await page.waitForTimeout(1000);

    // Search for influencer
    const searchInput = page.locator('.drawer-search-input').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('Test Influencer');
      await page.waitForTimeout(500);
    }

    // Select influencer via checkbox
    const infCheckbox = page.locator('.inf-checkbox').first();
    await infCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    await infCheckbox.check({ force: true });

    // Send invites
    const sendBtn = page.locator('.btn-send-selected').first();
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.scrollIntoViewIfNeeded();
    await sendBtn.click({ force: true });

    // Wait for the invite to be processed and refresh
    await page.waitForTimeout(3000);

    // The drawer should still be open — verify by checking drawer is visible
    await expect(page.locator('.invite-drawer')).toBeVisible({ timeout: 5000 });

    // After sending, the invited tab should update (the invite was sent)
    // The influencer should now show "Invited" badge in the search list
    await expect(page.locator('.already-invited')).toBeVisible({ timeout: 5000 });
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

    // Cloudinary upload (already in mockCommonRoutes but also here for the screenshot upload)
    await page.route('**/api.cloudinary.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/test/image/upload/screenshot.png' }) });
    });

    // Submit endpoint
    await page.route('**/campaign-invites/invite_001/submit', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: MOCK_SUBMISSION }) });
    });

    // Navigate with query params for campaign title
    await page.goto('/campaign-submission/invite_001?campaignTitle=E2E+Test+Campaign&brandName=TestBrand&inviteStatus=working');
    // Wait for page hydration
    await page.waitForTimeout(2000);

    // Fill post URL (placeholder is "https://www.instagram.com/p/...")
    const postUrlInput = page.locator('input[placeholder*="instagram"]').first();
    await postUrlInput.waitFor({ state: 'visible', timeout: 8000 });
    await postUrlInput.fill('https://www.instagram.com/p/abc123');

    // Trigger CD after typing URL
    await page.waitForTimeout(300);
    await postUrlInput.blur();

    // Select post type (Reel pill)
    const reelPill = page.locator('.pill:has-text("Reel")').first();
    if (await reelPill.count() > 0) await reelPill.click();

    // Upload screenshot (required for canSubmit())
    const screenshotInput = page.locator('input[type="file"][accept*="image"]').first();
    await screenshotInput.setInputFiles({
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });
    // Wait for Cloudinary mock upload to complete and set postScreenshotUrl
    await page.waitForTimeout(2000);
    // Trigger CD (zoneless)
    await postUrlInput.focus();
    await postUrlInput.blur();
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = page.locator('.btn-submit').first();
    await submitBtn.waitFor({ state: 'visible' });
    // Wait until enabled (canSubmit needs postUrl + postScreenshotUrl)
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // Wait for submit API response (mocked).
    // In zoneless Angular, the HTTP callback sets this.submitted=true
    // but Angular won't detect the change until a template event fires.
    // Focus/blur on the post URL input (has ngModel) to trigger CD.
    await page.waitForTimeout(2000);
    await postUrlInput.focus({ timeout: 2000 }).catch(() => {});
    await postUrlInput.blur({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Should show success screen
    await expect(page.locator('.success-screen')).toBeVisible({ timeout: 10000 });
  });

  test('shows error when postUrl is missing and submit is clicked', async ({ page }) => {
    await setAuthToken(page, INFLUENCER_TOKEN, 'influencer');

    await page.route('**/campaign-invites/invite_001/submission', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: null }) });
    });

    await page.goto('/campaign-submission/invite_001?campaignTitle=Test&inviteStatus=working');
    await page.waitForTimeout(2000);

    // Submit without filling anything — button should be disabled (canSubmit() = false)
    const submitBtn = page.locator('.btn-submit').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
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

    // Brand campaigns list (has one campaign)
    await page.route('**/campaigns/brand-name/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_CAMPAIGN] }) });
    });

    // Track review state for dynamic mock responses
    let reviewDone = false;

    // Campaign invites & submissions (single handler to avoid route conflicts)
    await page.route('**/campaign-invites/campaign/camp_001**', async (route) => {
      const url = route.request().url();
      if (url.includes('/submissions')) {
        // getCampaignSubmissions returns raw response (no extractData)
        // After review, return approved status so the review area disappears
        const sub = { ...MOCK_SUBMISSION, status: reviewDone ? 'approved' : 'submitted' };
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify([sub]) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [MOCK_INVITE] }) });
      }
    });

    // Review endpoint — return updated submission with approved status
    await page.route('**/campaign-invites/invite_001/review', async (route) => {
      reviewDone = true;
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Submission approved' }) });
    });

    await page.goto('/campaigns');
    // Wait for hydration and brand profile to load
    await page.waitForTimeout(3000);

    // Click "Manage" button to expand campaign
    const manageBtn = page.locator('.btn-cmanage').first();
    await manageBtn.waitFor({ state: 'visible', timeout: 8000 });
    await manageBtn.click();

    // Wait for expand panel to load invites and submissions
    await page.waitForTimeout(2000);
    await page.locator('body').click(); // Trigger CD

    // Submission section should show
    await expect(page.locator('.submissions-section')).toBeVisible({ timeout: 10000 });

    // Approve the submission
    const approveBtn = page.locator('.btn-sub-approve').first();
    await approveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await approveBtn.click();

    // Wait for the review API call and re-fetch
    await page.waitForTimeout(2000);
    await page.locator('body').click(); // Trigger CD

    // After approval, the sub-status-chip should show "approved" 
    // OR the review area disappears (since status !== 'submitted' means no review buttons)
    await expect(page.locator('.btn-sub-approve')).not.toBeVisible({ timeout: 10000 });
  });
});
