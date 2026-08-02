import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// vite.config.ts sets `base: '/-Excel-helper/'` for GitHub Pages, so
// `vite preview` serves the app under that path, not at the root.
const BASE_PATH = '/-Excel-helper/';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,

  // A `.only` left in a test silently narrows the suite to one case while
  // still reporting green. Fail the CI run instead.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
        ['github'],
      ]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `${BASE}${BASE_PATH}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    // The app renders Arabic as well as English; pin the locale so
    // text-based assertions are deterministic.
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'mobile',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    // Build with the e2e bypass, then serve the real production-shaped bundle.
    // Testing the built output rather than the dev server is deliberate: it is
    // what catches base-path and bundling breakage before it reaches Pages.
    command: `npm run build:e2e && npx vite preview --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: `${BASE}${BASE_PATH}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { VITE_E2E_AUTH_BYPASS: 'true' },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
