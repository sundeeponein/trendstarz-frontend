import { test, expect } from '@playwright/test';

// Influencer registration and campaign discovery E2E
test('Influencer registration and campaign discovery', async ({ page }) => {
  // Use a unique value for username/email
  const unique = Date.now();
  const email = `testinfluencer${unique}@example.com`;
  const username = `testinfluencer${unique}`;

  // 1. Go to registration page
  await page.goto('http://localhost:4200/register-influencer');

  // 2. Fill registration form
  await page.fill('input[formControlName="name"]', 'Test Influencer');
  await page.fill('input[formControlName="username"]', username);
  await page.fill('input[formControlName="phoneNumber"]', '9000000000');
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Test@1234');
  await page.fill('input[formControlName="confirmPassword"]', 'Test@1234');

  // Select state (Angular Material mat-select example)
  await page.click('[formcontrolname="state"]');
  await page.click('mat-option >> nth=0');

  // Languages
  await page.click('[formcontrolname="languages"]');
  await page.click('mat-option >> nth=0');

  // Categories
  await page.click('[formcontrolname="categories"]');
  await page.click('mat-option >> nth=0');

  // Social media
  await page.fill('input[formControlName="platform"]', 'Instagram');
  await page.fill('input[formControlName="handle"]', '@testhandle');
  await page.fill('input[formControlName="tier"]', 'Nano');
  await page.fill('input[formControlName="followersCount"]', '1000');

  // Contact method
  await page.check('input[type="checkbox"][formControlName="whatsapp"]');
  // Profile image upload (skip if not automatable)
  // await page.setInputFiles('input[type="file"]', 'path/to/image.jpg');

  // 3. Submit form
  await page.click('button[type="submit"]');

  // 4. Expect success modal or email verification prompt
  await expect(page.locator('.alert-warning, .modal-success')).toBeVisible();

  // 5. (Manual) Complete email verification and admin approval if required

  // 6. Login
  await page.goto('http://localhost:4200/login');
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="password"]', 'Test@1234');
  await page.click('button[type="submit"]');

  // 7. Go to campaigns page
  await page.goto('http://localhost:4200/campaigns');
  await expect(page.locator('.campaigns-grid, .cm-page')).toBeVisible();
});
