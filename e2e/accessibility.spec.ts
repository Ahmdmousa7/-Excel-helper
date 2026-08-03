import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Known accessibility debt.
 *
 * This suite is a RATCHET, not a pass/fail audit. The app has pre-existing
 * violations; failing the build on all of them would mean a permanently red
 * check that everyone learns to ignore, which is worse than no check.
 *
 * Violations of the rules below are recorded and reported but do not fail. A
 * violation of ANY OTHER rule fails the build — new debt cannot land.
 *
 * The list is meant to shrink. Each entry should get an issue, a fix, and a
 * deletion. Never add to it to make a red build green — that inverts the point,
 * and the last test in this file exists to make that awkward.
 */
const KNOWN_A11Y_DEBT = new Set<string>([
  'color-contrast',            // muted slate-400 text throughout the shell
  'button-name',               // icon-only buttons: sidebar collapse
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
  for (const v of violations) (KNOWN_A11Y_DEBT.has(v.id) ? known : regressions).push(v);
  return { known, regressions };
}

const describeAll = (vs: Violation[]) =>
  vs.map((v) => `  - ${v.id} (${v.impact ?? 'unknown'}) x${v.nodes.length}`).join('\n');

/**
 * Wait until the page is visually settled before scanning.
 *
 * Without this the suite is flaky under parallel workers: the app uses
 * `animate-in fade-in zoom-in` transitions, and axe scanning mid-transition
 * reads interpolated opacity and half-positioned nodes. That surfaces
 * transient violations that do not exist once the frame settles — a false
 * failure, which is the worst kind in a gate people are meant to trust.
 */
async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // Two rAFs guarantees a completed paint, not just a scheduled one.
        const done = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        const running = document.getAnimations().filter((a) => a.playState === 'running');
        if (running.length === 0) return done();
        // Cap the wait: an infinite animation (a spinner) would never finish.
        Promise.race([
          Promise.allSettled(running.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 1200)),
        ]).then(done);
      }),
  );
}

async function scan(page: Page) {
  await settle(page);
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
}

/**
 * Every violation this run observed, recorded for the evidence bundle.
 *
 * The ratchet above answers "did this get worse?", which is the right question
 * for a gate but throws away the absolute picture. `accessibility-report.json`
 * wants the picture: which rules fire, how many nodes, on which pages. So each
 * scan appends here and a teardown writes the summary.
 *
 * Only rule ids, impacts, node COUNTS, and page labels — no selectors and no
 * HTML. Those would put fragments of the rendered DOM into a committed
 * artifact, and the rule plus the page is what anyone actually acts on.
 */
type AxeObservation = { id: string; impact: string | null; nodes: number; page: string };
const observed: AxeObservation[] = [];
const pagesScanned = new Set<string>();

async function expectNoNewViolations(page: Page, where: string) {
  const results = await scan(page);
  const all = results.violations as Violation[];

  pagesScanned.add(where);
  for (const v of all) {
    observed.push({
      id: v.id,
      impact: (v as { impact?: string }).impact ?? null,
      nodes: v.nodes?.length ?? 1,
      page: where,
    });
  }

  const { known, regressions } = partition(all);
  if (known.length) console.log(`known a11y debt on ${where}:\n${describeAll(known)}`);
  expect(
    regressions,
    `NEW accessibility violations on ${where} (not in KNOWN_A11Y_DEBT):\n${describeAll(regressions)}`,
  ).toEqual([]);
}

test.describe('accessibility', () => {
  // Written once, after every scan in this file has run, so the evidence
  // collector has real axe data rather than `available: false`.
  //
  // Sorted and free of timings, because the bundle it feeds has to reproduce
  // byte for byte. `budget` is the ratchet's own number, which lets
  // accessibility-report.json state pass/fail rather than only a count.
  test.afterAll(async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const violations = [...observed].sort(
      (a, b) => a.id.localeCompare(b.id) || a.page.localeCompare(b.page),
    );
    mkdirSync('test-results', { recursive: true });
    writeFileSync(
      'test-results/axe-summary.json',
      `${JSON.stringify({
        standard: 'WCAG 2.2 AA (axe-core)',
        budget: KNOWN_A11Y_DEBT.size,
        pages: [...pagesScanned].sort(),
        violations,
      }, null, 2)}\n`,
      'utf8',
    );
  });

  test('the landing view introduces no new WCAG 2.2 AA violations', async ({ app, page }) => {
    await app.expectHealthy();
    await expectNoNewViolations(page, 'the landing view');
  });

  test('the QR tool introduces no new WCAG 2.2 AA violations', async ({ qr, page }) => {
    await qr.generate('https://example.com');
    await expectNoNewViolations(page, 'the QR tool');
  });

  test('a data tool introduces no new WCAG 2.2 AA violations', async ({ app, page }) => {
    const { TOOL } = await import('./fixtures');
    await app.openTool(TOOL.compareFiles);
    await expectNoNewViolations(page, 'the Compare Files tool');
  });

  test('the generated QR image carries alt text', async ({ qr }) => {
    const img = await qr.generate('alt-text-check');
    await expect(img).toHaveAttribute('alt', /.+/);
  });

  test('the document declares a language', async ({ app, page }) => {
    await app.expectHealthy();
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
  });

  test('the a11y debt list is not silently growing', async () => {
    // A guard on the guard. If someone pads KNOWN_A11Y_DEBT to turn a red build
    // green, this fails and forces the conversation.
    expect(
      KNOWN_A11Y_DEBT.size,
      'KNOWN_A11Y_DEBT grew. Fix the violation instead of allow-listing it; ' +
        'if the addition is genuinely justified, lower this bound deliberately.',
    ).toBeLessThanOrEqual(7);
  });
});
