import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// vite.config.ts sets `base: '/-Excel-helper/'` for GitHub Pages, so
// `vite preview` serves the app under that path, not at the root.
const BASE_PATH = '/-Excel-helper/';

export default defineConfig({
  testDir: './e2e',
  // e2e/live/** targets the deployed site and has no auth bypass, so it must
  // not run against the local preview server. It has its own config:
  // playwright.live.config.ts, driven by `npm run e2e:live`.
  testIgnore: ['**/live/**'],
  outputDir: './test-results',
  fullyParallel: true,

  // A `.only` left in a test silently narrows the suite to one case while
  // still reporting green. Fail the CI run instead.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  // Capped rather than left to the CPU count. Each worker boots the full
  // 3.8 MB bundle (TD-004), and past ~3 concurrent boots on one machine the
  // app takes long enough to become interactive that tests fail on timeout
  // rather than on behaviour. That is a false negative, and false negatives
  // are how a suite loses its credibility.
  //
  // Raise this once code splitting lands — the cap is a symptom of the bundle,
  // not a property of the tests.
  workers: process.env.CI ? 2 : 3,

  timeout: 60_000,
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
