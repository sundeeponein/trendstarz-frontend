import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

test('Influencer registration and campaign discovery', async ({ page }) => {
  // Collect browser console logs for debugging
  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.type(), msg.text());
  });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imagePath = path.resolve(__dirname, 'test-profile.png');
  // Use a unique value for username/email
  const unique = Date.now();
  const email = `testinfluencer${unique}@example.com`;
  const username = `testinfluencer${unique}`;
  const phone = `9${String(unique).slice(-9)}`;


  // 1. Go to registration page
  await page.goto('/register-influencer');

  // Mock Cloudinary upload to avoid dependency on real credentials in tests
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        secure_url: 'https://res.cloudinary.com/test/image/upload/e2e-test.png',
        public_id: 'e2e_test_public_id'
      })
    });
  });

  // Wait for form to load (wait for name input to be visible)
  await page.waitForSelector('input[formControlName="name"]', { state: 'visible' });

  // 2. Fill registration form (step 1)
  // Fill Full Name
  const nameSelector = 'input[formControlName="name"]';
  await page.waitForSelector(nameSelector, { state: 'visible', timeout: 5000 });
  console.log('Full Name input found:', !!(await page.$(nameSelector)));
  await page.type(nameSelector, 'Test Influencer', { delay: 100 });
  await page.keyboard.press('Tab');

  // Fill Username
  const usernameSelector = 'input[formControlName="username"]';
  await page.waitForSelector(usernameSelector, { state: 'visible', timeout: 5000 });
  console.log('Username input found:', !!(await page.$(usernameSelector)));
  await page.type(usernameSelector, username, { delay: 100 });
  await page.keyboard.press('Tab');

  // Fill Mobile Number (try both formControlName and placeholder)
  let phoneSelector = 'input[formControlName="phoneNumber"]';
  if (!(await page.$(phoneSelector))) phoneSelector = 'input[placeholder*="10-digit"]';
  console.log('Phone input found:', !!(await page.$(phoneSelector)));
  if (await page.$(phoneSelector)) {
    await page.type(phoneSelector, phone, { delay: 100 });
    await page.keyboard.press('Tab');
  }

  // Fill Email Address
  let emailSelector = 'input[formControlName="email"]';
  if (!(await page.$(emailSelector))) emailSelector = 'input[placeholder*="@"]';
  console.log('Email input found:', !!(await page.$(emailSelector)));
  if (await page.$(emailSelector)) {
    await page.type(emailSelector, email, { delay: 100 });
    await page.keyboard.press('Tab');
  }

  // Fill Password
  const passwordSelector = 'input[formControlName="password"]';
  await page.waitForSelector(passwordSelector, { state: 'visible', timeout: 5000 });
  console.log('Password input found:', !!(await page.$(passwordSelector)));
  await page.type(passwordSelector, 'Test@1234', { delay: 100 });
  await page.keyboard.press('Tab');

  // Fill Confirm Password
  const confirmPasswordSelector = 'input[formControlName="confirmPassword"]';
  await page.waitForSelector(confirmPasswordSelector, { state: 'visible', timeout: 5000 });
  console.log('Confirm Password input found:', !!(await page.$(confirmPasswordSelector)));
  await page.type(confirmPasswordSelector, 'Test@1234', { delay: 100 });
  await page.keyboard.press('Tab');




  // Go to next step (step 2)
  await page.click('button:has-text("Next Step")');
  // Take screenshot and log errors after clicking Next Step
  await page.screenshot({ path: 'after-nextstep.png', fullPage: true });
  const errors = await page.$$eval('.text-danger', els => els.map(e => e.textContent));
  console.log('Validation errors after Next Step:', errors);
  // Log all visible input fields for debugging
  const visibleInputs = await page.$$eval('input, select, ng-select', els => els.filter(e => e instanceof HTMLElement && e.offsetParent !== null).map(e => e.outerHTML));
  console.log('Visible input fields after Next Step:', visibleInputs);
  // Log the current step indicator if present
  const stepText = await page.$eval('.step-count', el => el.textContent).catch(() => 'step-count not found');
  console.log('Current step indicator:', stepText);
  // Log the outer HTML of the registration form for inspection
  const formHtml = await page.$eval('form', el => el.outerHTML).catch(() => 'form not found');
  console.log('Registration form outerHTML:', formHtml);
  // Wait for step 2 heading to ensure navigation, or throw if not found
  try {
    await page.waitForSelector('h2:has-text("Social Media & Media")', { timeout: 5000 });
  } catch (e) {
    throw new Error('Step 2 did not appear. See after-nextstep.png and console for errors.');
  }

  // Upload profile image (required, after language and categories in step 2)
  const fileInputSelector = 'input[type="file"][accept="image/*"]';
  const fileInput = await page.$(fileInputSelector);
  if (fileInput) {
    // Take a screenshot after file upload for debugging
    await page.screenshot({ path: 'after-file-upload.png', fullPage: true });
    await page.waitForSelector(fileInputSelector, { state: 'visible', timeout: 5000 });
    // Log parent HTML of file input and upload box for debugging
    const parentHtml = await page.$eval(fileInputSelector, el => el.parentElement?.outerHTML || 'no parent');
    console.log('File input parent HTML:', parentHtml);
    const uploadBoxHtml = await page.$eval('.upload-box', el => el.outerHTML).catch(() => 'upload-box not found');
    console.log('Upload box HTML:', uploadBoxHtml);
    // Set file and dispatch native change event to trigger Angular handler
    await page.setInputFiles(fileInputSelector, imagePath);
    // Wait a bit for Angular to process the change
    await page.waitForTimeout(1000);
    // Log all input and image elements for debugging
    const allInputs = await page.$$eval('input', els => els.map(e => e.outerHTML));
    const allImages = await page.$$eval('img', els => els.map(e => e.outerHTML));
    console.log('All input elements after file upload:', allInputs);
    console.log('All image elements after file upload:', allImages);
    // Wait for the persistent debug span to appear and log its text content
    try {
      await page.waitForSelector('span:has-text("GLOBAL OUTSIDE DEBUG")', { timeout: 8000 });
      const debugSpanText = await page.$eval('span:has-text("GLOBAL OUTSIDE DEBUG")', el => el.textContent);
      console.log('GLOBAL OUTSIDE DEBUG span text:', debugSpanText);
    } catch (e) {
      // Extra logging if debug span does not appear
      const uploadBoxHtml = await page.$eval('.upload-box', el => el.outerHTML).catch(() => 'upload-box not found');
      console.log('Upload box HTML after file upload:', uploadBoxHtml);
      throw new Error('GLOBAL OUTSIDE DEBUG span did not appear after file upload.');
    }
  } else {
    // Log all input elements for debugging
    const allInputs = await page.$$eval('input', els => els.map(e => (e as HTMLInputElement).outerHTML));
    console.log('File input not found. All input elements:', allInputs);
    throw new Error('File input for image upload not found. See console log for available inputs.');
  }
  // Now select state (handle possible nested form group)
  // Try both direct and nested selectors for robustness
  let stateSelector = 'select[formcontrolname="state"]';
  if (!(await page.$(stateSelector))) {
    stateSelector = '[formgroupname="location"] select[formcontrolname="state"]';
  }
  await page.waitForSelector(stateSelector);
  // Select the first valid state option (not the placeholder)
  const stateOptions = await page.$$eval(
    stateSelector + ' option',
    opts => opts
      .filter(o => o instanceof HTMLOptionElement)
      .map(o => ({ value: o.value, disabled: o.disabled, selected: o.selected }))
  );
  const validState = stateOptions.find(o => o.value && !o.disabled && !o.selected);
  if (validState) {
    await page.selectOption(stateSelector, validState.value);
  } else {
    throw new Error('No valid state option found to select.');
  }

  // Payment option (optional, default is 'free')
  // await page.selectOption('select[formcontrolname="paymentOption"]', 'free');

  // Languages (ng-select)
  await page.click('ng-select[formcontrolname="languages"] .ng-select-container');
  await page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
  await page.click('.ng-dropdown-panel .ng-option');

  // Categories (ng-select)
  await page.click('ng-select[formcontrolname="categories"] .ng-select-container');
  await page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
  await page.click('.ng-dropdown-panel .ng-option');


  // Social media
  await page.selectOption('select[formControlName="platform"]', { label: 'Instagram' });
  await page.fill('input[formControlName="handle"]', '@testhandle');
  await page.selectOption('select[formControlName="tier"]', { label: 'Nano' });
  await page.fill('input[formControlName="followersCount"]', '1000');

  // Contact method
  // Wait for step 3 (Professional Details)
  await page.click('button:has-text("Next Step")');
  await page.waitForSelector('h2:has-text("Professional Details")', { timeout: 5000 });

  // Contact method (check WhatsApp)
  await page.click('label.contact-item:has-text("WhatsApp") input[type="checkbox"]');

  // Fill promotional price
  await page.fill('input[formControlName="promotionalPrice"]', '5000');

  // 3. Submit form
  await page.click('button[type="submit"]');

  // 4. Expect success modal — registration complete
  await expect(page.locator('.reg-success-modal-overlay')).toBeVisible({ timeout: 30000 });

  // Verify success modal text
  await expect(page.locator('.reg-success-title')).toContainText('Successfully Registered');

  // NOTE: Steps 5-8 (email verification, admin approval, login, and campaign discovery)
  // require manual steps outside the automated test:
  //   - Verify email via the link sent to the registered email
  //   - Wait for admin to approve the account
  //   - Log in with the approved account
  //   - Navigate to /campaigns to browse open campaigns
});

