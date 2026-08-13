import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// vite.config.ts sets `base: '/-Excel-helper/'` for GitHub Pages, so
// `vite preview` serves the app under that path, not at the root.
const BASE_PATH = '/-Excel-helper/';

export default defineConfig({
  testDir: './e2e',
  // e2e/live/** targets the DEPLOYED site, so it must not run against the local
  // preview server — its assertions are about what GitHub Pages serves, and
  // several would be meaningless or trivially green locally. It has its own
  // config: playwright.live.config.ts, driven by `npm run e2e:live`.
  testIgnore: ['**/live/**'],
  outputDir: './test-results',
  fullyParallel: true,

  // A `.only` left in a test silently narrows the suite to one case while
  // still reporting green. Fail the CI run instead.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  // Was capped at 3 locally because each worker booted the full 3.8 MB bundle
  // and concurrent boots pushed tests past their timeout. Code splitting
  // (TD-004) cut the initial load to ~199 KB, so the cap is no longer needed —
  // left to the CPU count locally, held at 4 on CI where the runner has 2 cores
  // and oversubscribing costs more than it gains.
  // Capped at 4 locally to MATCH CI, not because 4 is a magic number.
  //
  // `undefined` gives Playwright half the core count — 6 on the maintainer's
  // 12-core machine — and each worker boots a Chromium and pulls the whole
  // bundle from one `vite preview`. Two of TD-040's three observed flakes were
  // retrying assertions timing out (a sidebar not visible in 30 s, a dialog not
  // hidden in 5 s), which is what contention looks like; the third was a real
  // test bug, now fixed in responsive.spec.ts.
  //
  // Stated honestly: this is load reduction, NOT a proven fix. Those two were
  // never reproduced on demand. Two things argue for it anyway. A local run at 6
  // workers is not predictive of a CI run at 4, so a local pass told you less
  // than it appeared to. And it is not a trade — measured on this machine, the
  // full suite takes 1.9 min at 4 workers and 2.1 min at 6, because six
  // Chromiums plus a vite preview on twelve cores is oversubscribed and thrashes.
  // Fewer workers is both steadier and slightly faster, which is the same
  // contention showing up as throughput instead of as a failure.
  workers: 4,

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
    // Serve the real production-shaped bundle rather than the dev server: it is
    // what catches base-path and bundling breakage before it reaches Pages.
    //
    // `--outDir dist-e2e` is load-bearing, and still is now that the app has no
    // sign-in gate. `build:e2e` and `build` used to share `dist/`, and
    // `vite preview` serves that directory live from disk — so a later
    // production build silently replaced what this server was serving.
    // Combined with server reuse that produced a 100-of-101 failure where every
    // test hit the sign-in gate, because the served bundle had been rebuilt
    // without the auth bypass that existed at the time. The gate is gone, but
    // the collision is not: any build into the served directory still swaps the
    // bundle mid-run. Separate directories make it impossible rather than
    // merely unlikely.
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: `${BASE}${BASE_PATH}`,
    timeout: 180_000,

    // Never reuse by default, locally or in CI.
    //
    // Reuse trades correctness for start-up time: Playwright cannot tell
    // whether a server already on the port serves this build, an older one, or
    // a different project entirely — it only checks that the URL answers. In a
    // pre-push gate that is the wrong trade, and the failure it produces is
    // maximally confusing (a hundred "element not found" errors that look like
    // an app regression). With `strictPort`, an occupied port now fails loudly
    // instead.
    //
    // Set PW_REUSE_SERVER=1 for deliberate fast iteration against a server you
    // started yourself and know the provenance of.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
