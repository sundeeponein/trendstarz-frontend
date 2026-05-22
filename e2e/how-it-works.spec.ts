import { test, expect } from '@playwright/test';

test.describe('How it Works page', () => {
  test('features alias shows features eyebrow and route-aware CTA links', async ({ page }) => {
    await page.goto('/features');

    await expect(page.locator('.eyebrow')).toHaveText('Features');
    await expect(page.getByRole('heading', { name: 'Get Brand Deals Without Chasing DMs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find the Right Influencers for Your Brand' })).toBeVisible();

    const influencerCta = page.getByRole('link', { name: 'Start Getting Brand Deals' });
    const brandCta = page.getByRole('link', { name: 'Start Your First Campaign' });

    await expect(influencerCta).toHaveAttribute('href', /register-influencer\?source=features&audience=influencer/);
    await expect(brandCta).toHaveAttribute('href', /register-brand\?source=features&audience=brand/);
  });

  test('guest sees both influencer and brand journeys with CTA links', async ({ page }) => {
    await page.goto('/how-it-works');

    await expect(page.getByRole('heading', { name: 'Get Brand Deals Without Chasing DMs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find the Right Influencers for Your Brand' })).toBeVisible();

    const influencerCta = page.getByRole('link', { name: 'Start Getting Brand Deals' });
    const brandCta = page.getByRole('link', { name: 'Start Your First Campaign' });

    await expect(influencerCta).toHaveAttribute('href', /register-influencer\?source=how-it-works&audience=influencer/);
    await expect(brandCta).toHaveAttribute('href', /register-brand\?source=how-it-works&audience=brand/);
  });

  test('audience route for influencers shows only influencer journey', async ({ page }) => {
    await page.goto('/how-it-works/influencers');

    await expect(page.getByRole('heading', { name: 'Get Brand Deals Without Chasing DMs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find the Right Influencers for Your Brand' })).toHaveCount(0);
  });

  test('audience route for brands shows only brand journey', async ({ page }) => {
    await page.goto('/how-it-works/brands');

    await expect(page.getByRole('heading', { name: 'Find the Right Influencers for Your Brand' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Get Brand Deals Without Chasing DMs' })).toHaveCount(0);
  });

  test('logged in influencer sees activation section and campaigns CTA', async ({ page }) => {
    await page.addInitScript(() => {
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const payload = btoa(JSON.stringify({ role: 'influencer', userId: 'inf_1', exp: Math.floor(Date.now() / 1000) + 3600 }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      localStorage.setItem('token', `${header}.${payload}.`);
      localStorage.setItem('userRole', 'influencer');
      localStorage.setItem('loginTimestamp', Date.now().toString());
      localStorage.setItem('user', JSON.stringify({
        _id: 'inf_1',
        role: 'influencer',
        name: 'Test Influencer',
        email: 'inf@test.com',
      }));
    });

    await page.route('**/users/influencer-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { isPremium: false } }),
      });
    });

    await page.goto('/how-it-works');

    await expect(page.getByRole('heading', { name: 'You are live. Turn visibility into offers.' })).toBeVisible();
    await expect(page.getByText('Brands can now discover your profile.', { exact: true })).toBeVisible();

    const cta = page.getByRole('link', { name: 'Explore Campaigns' });
    await expect(cta).toHaveAttribute('href', /campaigns\?source=how-it-works-activation&audience=influencer/);
  });

  test('logged in brand sees activation section and create campaign CTA', async ({ page }) => {
    await page.addInitScript(() => {
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const payload = btoa(JSON.stringify({ role: 'brand', userId: 'brand_1', exp: Math.floor(Date.now() / 1000) + 3600 }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      localStorage.setItem('token', `${header}.${payload}.`);
      localStorage.setItem('userRole', 'brand');
      localStorage.setItem('loginTimestamp', Date.now().toString());
      localStorage.setItem('user', JSON.stringify({
        _id: 'brand_1',
        role: 'brand',
        brandName: 'Test Brand',
        email: 'brand@test.com',
      }));
    });

    await page.route('**/users/brand-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { isPremium: false } }),
      });
    });

    await page.goto('/how-it-works');

    await expect(page.getByRole('heading', { name: 'You are ready. Launch your first campaign.' })).toBeVisible();
    await expect(page.getByText('Start reaching relevant influencers in minutes with a focused campaign.')).toBeVisible();

    const cta = page.getByRole('link', { name: 'Create Campaign' });
    await expect(cta).toHaveAttribute('href', /campaigns\?source=how-it-works-activation&audience=brand/);
  });

  test('homepage hero features CTA navigates to features page', async ({ page }) => {
    await page.goto('/welcome');

    await page.getByRole('button', { name: 'Explore Features' }).click();

    await expect(page).toHaveURL(/\/features$/);
    await expect(page.locator('.eyebrow')).toHaveText('Features');
  });
});
