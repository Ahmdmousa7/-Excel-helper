import { test, expect, Page, Request, Response } from '@playwright/test';

/**
 * Post-deployment verification.
 *
 * Production is behind Google sign-in, so these assert on what is observable
 * from outside that gate: the document serves, every asset resolves, the
 * bundle parses and React mounts, and nothing throws. That is enough to catch
 * the failure modes a Pages deploy actually has — a wrong `base` path, a
 * missing asset, a bundle that 200s but is HTML, a build that white-screens.
 *
 * Deeper flows are covered by the pre-merge suite against the built bundle;
 * repeating them here would only prove that sign-in still blocks a robot.
 */

/** Third-party noise the app does not control and cannot fix. */
const EXTERNAL_NOISE =
  /googleapis|gstatic|accounts\.google|gsi\/client|firebaseio|firestore|googletagmanager|google-analytics|cdn\.tailwindcss/i;

function watch(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failed: string[] = [];
  const notFound: string[] = [];

  page.on('console', (m) => {
    if (m.type() === 'error' && !EXTERNAL_NOISE.test(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r: Request) => {
    if (!EXTERNAL_NOISE.test(r.url())) {
      failed.push(`${r.url()} — ${r.failure()?.errorText ?? 'unknown'}`);
    }
  });
  page.on('response', (r: Response) => {
    if (r.status() >= 400 && !EXTERNAL_NOISE.test(r.url())) notFound.push(`${r.status()} ${r.url()}`);
  });

  return { consoleErrors, pageErrors, failed, notFound };
}

test.describe('live deployment', () => {
  test('the homepage serves a 200 with HTML', async ({ page }) => {
    const res = await page.goto('./', { waitUntil: 'domcontentloaded' });
    expect(res, 'no response from the live URL').not.toBeNull();
    expect(res!.status()).toBe(200);
    expect(res!.headers()['content-type'] ?? '').toContain('text/html');
  });

  test('the document has the expected title and favicon', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Sale Onboarding Team/i);
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });

  test('no first-party asset 404s or fails to load', async ({ page }) => {
    const w = watch(page);
    await page.goto('./', { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(3_000);

    expect(w.notFound, `assets returned >=400:\n${w.notFound.join('\n')}`).toEqual([]);
    expect(w.failed, `requests failed outright:\n${w.failed.join('\n')}`).toEqual([]);
  });

  test('the JavaScript bundle serves as JavaScript, not an HTML error page', async ({ page, request }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const scripts = await page.locator('script[src]').evaluateAll((els) =>
      els.map((e) => (e as HTMLScriptElement).src),
    );
    expect(scripts.length, 'the page loaded no scripts at all').toBeGreaterThan(0);

    for (const src of scripts) {
      if (EXTERNAL_NOISE.test(src)) continue;
      const res = await request.get(src);
      expect(res.status(), `${src} did not serve 200`).toBe(200);
      // A misconfigured `base` makes Pages serve index.html for a missing
      // asset — a 200 that is HTML. That is the classic silent deploy break.
      expect(
        res.headers()['content-type'] ?? '',
        `${src} served HTML instead of JavaScript — check vite.config.ts \`base\``,
      ).toMatch(/javascript|ecmascript/i);
    }
  });

  test('React mounts and replaces the static loading shell', async ({ page }) => {
    const w = watch(page);
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // index.html ships an inline "Loading Workspace..." spinner. If the bundle
    // fails to execute, the page still returns 200 and still looks alive —
    // uptime monitoring stays green while the app is dead. This is the check
    // that catches it.
    await expect(page.getByText('Loading Workspace...')).toHaveCount(0, { timeout: 30_000 });

    const rootChildren = await page.locator('#root > *').count();
    expect(rootChildren, '#root is empty — the bundle did not mount').toBeGreaterThan(0);

    expect(w.pageErrors, `uncaught exceptions on load:\n${w.pageErrors.join('\n')}`).toEqual([]);
  });

  test('the sign-in gate renders, which means the app booted', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    // Production has no auth bypass, so a correctly-working deploy shows the
    // sign-in screen. Reaching it proves the bundle parsed, React mounted,
    // and Firebase initialised.
    await expect(
      page.getByRole('button', { name: /sign in with google/i }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('CSS is applied, not just downloaded', async ({ page }) => {
    await page.goto('./', { waitUntil: 'networkidle' }).catch(() => undefined);
    // An unstyled page still passes every check above. Assert a computed style
    // that only exists once the stylesheet is actually in effect.
    const bg = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, 'body has no background colour — CSS did not apply').not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the page does not scroll sideways', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the live page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(2);
  });

  test('no uncaught console errors from first-party code', async ({ page }) => {
    const w = watch(page);
    await page.goto('./', { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    expect(w.consoleErrors, `console errors:\n${w.consoleErrors.join('\n')}`).toEqual([]);
  });
});
