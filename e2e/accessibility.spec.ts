import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoApp, openQrTool, generateQr } from './fixtures';

/**
 * Known accessibility debt.
 *
 * This suite is a RATCHET, not a pass/fail audit. The app has pre-existing
 * violations; failing the build on all of them would mean a permanently red
 * check that everyone learns to ignore, which is worse than no check.
 *
 * So: violations of the rules below are recorded and reported but do not fail.
 * A violation of ANY OTHER rule fails the build — new debt cannot land.
 *
 * The list is meant to shrink. Each entry should get an issue, a fix, and a
 * deletion from this array. Never add to it to make a red build green — that
 * inverts the whole point.
 */
const KNOWN_A11Y_DEBT = new Set<string>([
  'color-contrast',            // muted slate-400 text throughout the shell
  'button-name',               // icon-only buttons: sidebar collapse, QR copy
  'landmark-one-main',         // no <main> landmark in the shell
  'region',                    // content sits outside any landmark
  'page-has-heading-one',      // no <h1> on the tool views
  'aria-allowed-attr',
  'nested-interactive',
]);

type Violation = { id: string; impact?: string | null; nodes: unknown[] };

function partition(violations: Violation[]) {
  const known: Violation[] = [];
  const regressions: Violation[] = [];
  for (const v of violations) {
    (KNOWN_A11Y_DEBT.has(v.id) ? known : regressions).push(v);
  }
  return { known, regressions };
}

function describe(vs: Violation[]): string {
  return vs
    .map((v) => `  - ${v.id} (${v.impact ?? 'unknown'}) x${v.nodes.length}`)
    .join('\n');
}

/**
 * Wait until the page is visually settled before scanning.
 *
 * Without this the suite is flaky under parallel workers: the app uses
 * `animate-in fade-in zoom-in` transitions, and axe scanning mid-transition
 * reads interpolated opacity and half-positioned nodes. That surfaces
 * transient violations that do not exist once the frame settles — a false
 * failure, which is the worst kind in a gate people are meant to trust.
 */
async function settle(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const done = () =>
          // Two rAFs guarantees a completed paint, not just a scheduled one.
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));

        const running = document
          .getAnimations()
          .filter((a) => a.playState === 'running');

        if (running.length === 0) return done();

        // Cap the wait: an infinite animation (a spinner) would never finish.
        Promise.race([
          Promise.allSettled(running.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 1200)),
        ]).then(done);
      }),
  );
}

async function scan(page: import('@playwright/test').Page) {
  await settle(page);
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

test.describe('accessibility', () => {
  test('the landing view introduces no new WCAG 2.1 AA violations', async ({ page }) => {
    await gotoApp(page);
    const results = await scan(page);
    const { known, regressions } = partition(results.violations as Violation[]);

    if (known.length) {
       
      console.log(`known a11y debt on the landing view:\n${describe(known)}`);
    }
    expect(
      regressions,
      `NEW accessibility violations (not in KNOWN_A11Y_DEBT):\n${describe(regressions)}`,
    ).toEqual([]);
  });

  test('the QR tool introduces no new WCAG 2.1 AA violations', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);
    await generateQr(page, 'https://example.com');

    const results = await scan(page);
    const { known, regressions } = partition(results.violations as Violation[]);

    if (known.length) {
       
      console.log(`known a11y debt on the QR tool:\n${describe(known)}`);
    }
    expect(
      regressions,
      `NEW accessibility violations on the QR tool:\n${describe(regressions)}`,
    ).toEqual([]);
  });

  test('the generated QR image carries alt text', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);
    const img = await generateQr(page, 'alt-text-check');
    await expect(img).toHaveAttribute('alt', /.+/);
  });

  test('the document declares a language', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
  });

  test('the a11y debt list is not silently growing', async ({ page }) => {
    // A guard on the guard. If someone pads KNOWN_A11Y_DEBT to turn a red
    // build green, this fails and forces the conversation.
    expect(
      KNOWN_A11Y_DEBT.size,
      'KNOWN_A11Y_DEBT grew. Fix the violation instead of allow-listing it; ' +
        'if the addition is genuinely justified, lower this bound deliberately.',
    ).toBeLessThanOrEqual(7);
  });
});
