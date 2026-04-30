import { test, expect } from '@playwright/test';

test.describe('How it Works page', () => {
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
      localStorage.setItem('token', 'dummy.token.value');
      localStorage.setItem('user', JSON.stringify({
        id: 'inf_1',
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
      localStorage.setItem('token', 'dummy.token.value');
      localStorage.setItem('user', JSON.stringify({
        id: 'brand_1',
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
});
