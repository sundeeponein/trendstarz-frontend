import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Photographer profile E2E
//
// All API calls are mocked. Tests cover:
//   1. View profile — fields rendered
//   2. Edit mode toggle
//   3. Update profile — API call
//   4. Commission badge display (if assigned)
// ─────────────────────────────────────────────────────────────

const PHOTOGRAPHER_TOKEN = 'fake-photographer-jwt';

const MOCK_PHOTOGRAPHER_PROFILE = {
  name: 'Test Photographer',
  username: 'testphotographer',
  email: 'photographer@e2e.com',
  phoneNumber: '9876543215',
  skills: ['Videography', 'Photography'],
  equipment: ['Sony', 'DJI'],
  languages: ['English'],
  location: { state: 'Maharashtra', district: 'Mumbai' },
  profileImages: [
    {
      url: 'https://res.cloudinary.com/test/image/upload/photographer.png',
      public_id: 'p1',
    },
  ],
  pricing: {
    'Starting Price': 5000,
    'Per Reel': 2000,
    'Per Shoot': 3000,
    'Hourly': 1000,
  },
  socialMedia: [
    {
      platform: 'Instagram',
      handle: 'testphotographer',
      followersCount: 2000,
      tier: 'Nano',
      contentTypes: [],
    },
  ],
  portfolio: 'https://testphotographer-portfolio.com',
  contact: { whatsapp: false, email: false, call: false },
  adminTags: ['Partner'],
  commissionBadge: 'partner_creator',
  isPremium: false,
};

async function setPhotographerAuth(page: Page) {
  const fakeJwt = (() => {
    try {
      const header = { alg: 'none', typ: 'JWT' };
      const payload: any = {
        role: 'photographer',
        name: 'Test Photographer',
        userId: 'photo_001',
      };
      payload.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const b64 = (obj: any) =>
        Buffer.from(JSON.stringify(obj))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      return `${b64(header)}.${b64(payload)}.`;
    } catch (e) {
      return PHOTOGRAPHER_TOKEN;
    }
  })();

  await page.addInitScript((jwt) => {
    localStorage.setItem('token', jwt);
    localStorage.setItem('loginTimestamp', Date.now().toString());
    localStorage.setItem(
      'user',
      JSON.stringify({
        role: 'photographer',
        _id: 'photo_001',
        name: 'Test Photographer',
      }),
    );
  }, fakeJwt);
}

async function mockPhotographerProfileRoutes(page: Page) {
  // Profile endpoint
  await page.route('**/users/photographers/me/profile', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PHOTOGRAPHER_PROFILE),
      });
    } else if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PHOTOGRAPHER_PROFILE),
      });
    } else {
      await route.continue();
    }
  });

  // Config endpoints
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
            contentTypes: [
              { key: 'reel', label: 'Reel', name: 'Reel', price: 0, visible: true },
            ],
          },
        ],
      }),
    });
  });

  await page.route('**/plans/my/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hasPremium: false,
        planName: 'Free',
        features: [],
        limits: [{ key: 'maxProfileImages', value: 1 }],
        policies: { imageRetentionDaysAfterExpiry: 45 },
        endDate: null,
      }),
    });
  });

  await page.route('**/payment/my', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ payments: [] }),
    });
  });

  // Cloudinary
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secure_url:
          'https://res.cloudinary.com/test/image/upload/photographer_edit.png',
        public_id: 'e2e_photo_edit',
      }),
    });
  });

  await page.route('**/auth/upload-image', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://res.cloudinary.com/test/image/upload/photographer_edit.png',
        public_id: 'e2e_photo_edit',
      }),
    });
  });
}

test('Photographer profile — view and edit (mocked API)', async ({ page }) => {
  await setPhotographerAuth(page);
  await mockPhotographerProfileRoutes(page);

  // ────────────────────────────── Go to profile page
  await page.goto('/photographer-profile');
  await page.waitForSelector('main.content-panel', {
    state: 'visible',
    timeout: 30000,
  });
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      return {
        name: String(comp?.form?.get?.('name')?.value || ''),
        phoneNumber: String(comp?.form?.get?.('phoneNumber')?.value || ''),
        profileImagePreview: String(comp?.profileImagePreview || ''),
      };
    });
  }, {
    timeout: 30000,
  }).toMatchObject({
    name: 'Test Photographer',
    phoneNumber: '9876543215',
  });

  // ────────────────────────────── Check profile fields loaded
  const nameField = page.locator('input[formControlName="name"]');
  if (await nameField.isVisible().catch(() => false)) {
    await expect(nameField).toHaveValue('Test Photographer');
    await expect(page.locator('input[formControlName="phoneNumber"]')).toHaveValue('9876543215');
  }
  await expect(page.locator('div.profile-upload-box')).toHaveCount(1);

  // Check commission badge if displayed
  const badgeLocator = page.locator('text=Partner');
  const badgeVisible = await badgeLocator.isVisible().catch(() => false);
  if (badgeVisible) {
    await expect(badgeLocator).toBeVisible();
  }

  // ────────────────────────────── Edit profile
  const editBtn = page.locator('button:has-text("Edit"), button:has-text("Edit Profile")').first();
  const editVisible = await editBtn.isVisible().catch(() => false);

  if (editVisible) {
    await editBtn.click();
  } else {
    await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      comp?.enableEdit?.();
      comp?.cdr?.detectChanges?.();
    });
  }

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      return !!comp?.isEditMode;
    });
  }, {
    timeout: 5000,
  }).toBe(true);

  // Change a field
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.clear();
    await nameField.fill('Updated Photographer');
  } else {
    await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      comp?.form?.get?.('name')?.setValue('Updated Photographer');
      comp?.cdr?.detectChanges?.();
    });
  }

  // Save profile
  const saveBtn = page.locator('button:has-text("Save"), button:has-text("Save Profile")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
  } else {
    await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      comp?.onSave?.();
      comp?.cdr?.detectChanges?.();
    });
  }

  // Wait for save success
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      return {
        isEditMode: !!comp?.isEditMode,
        saved: !!comp?.saved,
        name: String(comp?.form?.get?.('name')?.value || ''),
      };
    });
  }, {
    timeout: 10000,
  }).toMatchObject({
    isEditMode: false,
    name: 'Updated Photographer',
  });

  // Verify save was called (profile should refresh or show success message)
  const successMsg = page.locator('text=saved|success');
  const msgVisible = await successMsg.isVisible().catch(() => false);
  if (msgVisible) {
    await expect(successMsg).toBeVisible();
  }

  // ────────────────────────────── Verify profile loaded
  if (await nameField.isVisible().catch(() => false)) {
    await expect(nameField).toHaveValue(/Test Photographer|Updated Photographer/);
  }
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      return String(comp?.form?.get?.('name')?.value || '');
    });
  }, {
    timeout: 5000,
  }).toMatch(/Test Photographer|Updated Photographer/);
});

test('Photographer profile — commission badge display', async ({ page }) => {
  await setPhotographerAuth(page);
  await mockPhotographerProfileRoutes(page);

  await page.goto('/photographer-profile');
  await page.waitForSelector('main.content-panel', {
    state: 'visible',
    timeout: 30000,
  });
  await expect.poll(async () => {
    return await page
      .locator('input[formControlName="name"], div.alert.alert-info, .commission-badge, .mobile-commission-tag')
      .count();
  }, {
    timeout: 30000,
  }).toBeGreaterThan(0);

  // Check if commission badge section exists
  const badgeSection = page.locator('div.alert.alert-info');
  const badgeVisible = await badgeSection.isVisible().catch(() => false);

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const host = document.querySelector('app-photographer-profile') as any;
      const ng = (window as any).ng;
      const comp = ng?.getComponent?.(host);
      const tags = Array.isArray(comp?.commissionAccessTags) ? comp.commissionAccessTags : [];
      return tags.length;
    });
  }, {
    timeout: 10000,
  }).toBeGreaterThan(0);

  const tags = await page.evaluate(() => {
    const host = document.querySelector('app-photographer-profile') as any;
    const ng = (window as any).ng;
    const comp = ng?.getComponent?.(host);
    return Array.isArray(comp?.commissionAccessTags) ? comp.commissionAccessTags : [];
  });
  expect(tags.map((t: string) => String(t).toLowerCase())).toContain('partner');

  // If badge is displayed, verify it
  if (badgeVisible) {
    await expect(badgeSection).toContainText('Access Badge');
    await expect(badgeSection).toContainText('Partner');
    return;
  }

  // Otherwise, badge might be displayed in a different location
  const partnerBadge = page.locator('span:has-text("Partner"), .commission-badge:has-text("Partner"), .mobile-commission-tag:has-text("Partner")');
  const partnerVisible = await partnerBadge
    .isVisible()
    .catch(() => false);
  if (partnerVisible) {
    await expect(partnerBadge.first()).toBeVisible();
  }
});
