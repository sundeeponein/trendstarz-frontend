import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Photographer registration E2E
// Covers the 3-step photographer registration flow:
//   Step 1 — Basics (credentials + profile photo)
//   Step 2 — Skills & Social Media (equipment, skills, pricing)
//   Step 3 — Plan Selection
// API calls are mocked so no backend is required.
// ─────────────────────────────────────────────────────────────

test('Photographer registration — full 3-step flow (mocked API)', async ({ page }) => {
  const unique = Date.now();
  const email = `testphoto${unique}@example.com`;
  const username = `testphoto${unique}`;
  const phone = `7${String(unique).slice(-9)}`;

  // ── Mock Cloudinary ──────────────────────────────────────
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secure_url: 'https://res.cloudinary.com/test/image/upload/photographer-profile.png',
        public_id: 'e2e_photographer_profile',
      }),
    });
  });

  // ── Mock backend image upload ────────────────────────────
  await page.route('**/auth/upload-image', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://res.cloudinary.com/test/image/upload/photographer-profile.png',
        public_id: 'e2e_photographer_profile',
      }),
    });
  });

  // ── Mock states list ─────────────────────────────────────
  await page.route('**/states', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ _id: 'state_mh', name: 'Maharashtra' }],
      }),
    });
  });

  // ── Mock districts for selected state ─────────────────────
  await page.route('**/districts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { _id: 'dist_mumbai', name: 'Mumbai' },
          { _id: 'dist_pune', name: 'Pune' },
        ],
      }),
    });
  });

  // ── Mock equipment options ───────────────────────────────
  await page.route('**/equipment-options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { name: 'Sony', visible: true },
          { name: 'Canon', visible: true },
          { name: 'DJI', visible: true },
          { name: 'iPhone Creator', visible: true },
        ],
      }),
    });
  });

  // ── Mock pricing options ─────────────────────────────────
  await page.route('**/pricing-options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { key: 'Starting Price', label: 'Starting Price', visible: true },
          { key: 'Per Reel', label: 'Per Reel', visible: true },
          { key: 'Per Shoot', label: 'Per Shoot', visible: true },
          { key: 'Hourly', label: 'Hourly', visible: true },
          { key: 'Equipment', label: 'Equipment Rental', visible: true },
        ],
      }),
    });
  });

  // ── Mock languages ──────────────────────────────────────
  await page.route('**/languages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ _id: 'lang1', name: 'English' }],
      }),
    });
  });

  // ── Mock social media platforms ──────────────────────────
  await page.route('**/social-media', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: 'sm_ig',
            name: 'Instagram',
            icon: 'bi bi-instagram',
            color: '#E1306C',
            contentTypes: [{ key: 'reel', label: 'Reel', price: 0 }],
          },
        ],
      }),
    });
  });

  // ── Mock duplicate username check ────────────────────────
  await page.route('**/photographers/check-username**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true }),
    });
  });

  // ── Mock photographer registration submit ────────────────
  let photoSubmitCalled = false;
  await page.route('**/auth/register-photographer', async (route) => {
    photoSubmitCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Photographer registered successfully',
      }),
    });
  });

  // ── Go to registration page ──────────────────────────────
  await page.goto('/register-photographer');
  await page.waitForSelector('input[formControlName="name"]', {
    state: 'visible',
    timeout: 30000,
  });
  await page.waitForTimeout(2000); // Wait for Angular hydration (SSR, zoneless)

  // ════════════════════════ STEP 1 ════════════════════════
  // Set profile image preview directly to avoid image compression flakiness
  await page.evaluate(() => {
    const el = document.querySelector('app-photographer-registration');
    const ng = (window as any).ng;
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAusB9Y1p0XAAAAAASUVORK5CYII=';
    if (el && ng) {
      const comp = ng.getComponent(el);
      if (comp) {
        comp.profileImagePreview = tiny;
        comp.profileImageFile = new File(
          [new Uint8Array([137, 80, 78, 71])],
          'profile.png',
          { type: 'image/png' },
        );
        try {
          comp.refreshStepCompletion?.();
        } catch {}
        try {
          comp.cd?.detectChanges?.();
        } catch {}
      }
    }
  });

  // Fill Step 1 basics
  await page.fill('input[formControlName="name"]', `TestPhotographer${unique}`);
  await page.fill('input[formControlName="username"]', username);
  await page.fill('input[formControlName="phoneNumber"]', phone);
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Photo@1234');
  await page.fill('input[formControlName="confirmPassword"]', 'Photo@1234');

  // Click Continue to Step 2
  const nextBtn = page
    .locator('button:has-text("Continue"), .actions-row button.btn-primary')
    .first();
  await nextBtn.waitFor({ state: 'visible', timeout: 15000 });
  await nextBtn.scrollIntoViewIfNeeded();
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();

  // Wait for Step 2 content
  await page.waitForSelector('input[formControlName="skills"], label:has-text("Skills")', {
    state: 'visible',
    timeout: 10000,
  });

  // ════════════════════════ STEP 2 ════════════════════════
  // Set skills and equipment on form directly for validation
  await page.evaluate(() => {
    const el = document.querySelector('app-photographer-registration');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    try {
      comp.form?.get('skills')?.setValue(['Videography']);
      comp.form?.get('equipment')?.setValue(['Sony']);
      comp.refreshStepCompletion?.();
      comp.cd?.detectChanges?.();
    } catch (e) {}
  });

  // Click Continue to Step 3
  const nextBtn2 = page
    .locator('button:has-text("Continue"), .actions-row button.btn-primary')
    .first();
  await nextBtn2.waitFor({ state: 'visible', timeout: 15000 });
  await expect(nextBtn2).toBeEnabled();
  await nextBtn2.click();

  // Wait for Step 3 (plan selection)
  await page.waitForSelector('label:has-text("Free Plan"), button:has-text("Register")', {
    state: 'visible',
    timeout: 10000,
  });

  // ════════════════════════ STEP 3 ════════════════════════
  // Select Free Plan (default)
  const freeRadio = page.locator('input[value="free"], label:has-text("Free Plan") input');
  await freeRadio.first().check({ force: true }).catch(() => {});

  // Submit registration
  const submitBtn = page
    .locator('button:has-text("Register"), .actions-row button.btn-primary')
    .first();
  await submitBtn.waitFor({ state: 'visible', timeout: 15000 });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // Wait for success message
  await page.waitForSelector('text=registered|success', {
    timeout: 10000,
  });

  // Verify registration API was called
  await expect(photoSubmitCalled).toBeTruthy();
});
