// Playwright config for e2e tests
import { defineConfig, devices } from '@playwright/test';

const BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['BASE_URL']
  ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run start:e2e',
    port: 4200,
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
