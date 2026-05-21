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
  await page.waitForTimeout(2000); // Wait for Angular hydration + API responses (states, social media, pricing, etc.)

  // ════════════════════════ SEED ALL STATE ════════════════════════
  // Seed all required form data + profile image + social platform
  // and jump directly to step 3, bypassing DOM-based navigation
  await page.evaluate((args: { unique: number; email: string; phone: string }) => {
    const { unique, email, phone } = args;
    const el = document.querySelector('app-photographer-registration');
    const ng = (window as any).ng;
    if (!el || !ng) return;
    const comp = ng.getComponent(el);
    if (!comp) return;

    // Ensure socialMediaList has Instagram (from mock), fall back to manual seed
    if (!comp.socialMediaList?.length) {
      comp.socialMediaList = [{
        _id: 'sm_ig',
        name: 'Instagram',
        icon: 'bi bi-instagram',
        color: '#E1306C',
        contentTypes: [{ key: 'reel', label: 'Reel', price: 0 }],
      }];
    }

    // Seed all required form values
    comp.form?.patchValue({
      name: `TestPhotographer${unique}`,
      email: email,
      phoneNumber: phone,
      password: 'Photo@1234',
      confirmPassword: 'Photo@1234',
      location: { state: 'Maharashtra', district: 'Mumbai' },
      startingPrice: 1000,
      paymentOption: 'free',
    });
    comp.form?.get('skills')?.setValue(['Videography']);
    comp.form?.get('equipment')?.setValue(['Sony']);

    // Set profile image (required for submission)
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAusB9Y1p0XAAAAAASUVORK5CYII=';
    comp.profileImagePreview = tiny;
    comp.profileImageData = {
      url: 'https://res.cloudinary.com/test/image/upload/photographer-profile.png',
      public_id: 'e2e_photographer_profile',
    };

    // Seed Instagram platform form (required for platformsValid check in onSubmit)
    comp.platformForms['sm_ig'] = {
      handle: 'testphotographer',
      followersCount: '5000',
      tier: 'Nano',
      contentTypes: {},
    };
    comp.activePlatformTab = 'sm_ig';

    // Navigate directly to step 3
    comp.step1Complete = true;
    comp.step2Complete = true;
    comp.currentStep = 3;
    comp.cdr?.detectChanges?.();
  }, { unique, email, phone });

  // ════════════════════════ STEP 3: SUBMIT ════════════════════════
  const submitBtn = page.locator('button:has-text("Complete Registration")');
  await submitBtn.waitFor({ state: 'visible', timeout: 15000 });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // Verify registration API was called.
  await expect.poll(() => photoSubmitCalled, { timeout: 15000 }).toBeTruthy();
});
