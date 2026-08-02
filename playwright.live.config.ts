import { defineConfig, devices } from '@playwright/test';

/**
 * Post-deployment verification against the live GitHub Pages site.
 *
 * Separate from playwright.config.ts because the contract is different:
 * no webServer (the site is already deployed), no auth bypass (production
 * has none, by design), and therefore only checks that are meaningful
 * from outside the sign-in gate.
 *
 *   npm run e2e:live
 *   LIVE_URL=https://example.com/preview/ npm run e2e:live
 */
const LIVE_URL = process.env.LIVE_URL ?? 'https://ahmdmousa7.github.io/-Excel-helper/';

export default defineConfig({
  testDir: './e2e/live',
  outputDir: './test-results/live',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The public internet is not a hermetic test environment. Retry so a single
  // transient CDN blip cannot fail a deployment gate.
  retries: process.env.CI ? 3 : 1,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 20_000 },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }], ['github']]
    : [['list']],

  use: {
    baseURL: LIVE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
    locale: 'en-US',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
