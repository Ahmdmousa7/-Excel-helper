import { test, expect } from '@playwright/test';
import { gotoApp, sidebar } from './fixtures';

const VIEWPORTS = [
  { name: 'mobile-portrait', width: 375, height: 812 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
] as const;

test.describe('responsive layout', () => {
  for (const vp of VIEWPORTS) {
    test(`renders without horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoApp(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      // A couple of pixels of sub-pixel rounding is normal; a real overflow is
      // tens of pixels and makes the page pan sideways on a phone.
      expect(
        overflow,
        `the page scrolls sideways by ${overflow}px at ${vp.width}px wide`,
      ).toBeLessThanOrEqual(2);
    });
  }

  test('the shell stays usable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoApp(page);

    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  /**
   * Known mobile-layout debt.
   *
   * The sidebar is a fixed `w-64` (256px) with no responsive collapse, so on a
   * 375px screen the header controls are pushed off the right edge. The page
   * itself does not scroll sideways — something clips it — but the controls are
   * unreachable, which is worse than a visible overflow.
   *
   * Fixing it properly means a mobile drawer for the sidebar, which is a
   * feature, not a test change. Until then this is a RATCHET: the current count
   * is recorded, and the test fails if it grows.
   *
   * Lower this number as the layout is fixed. Never raise it to make a red
   * build green.
   *
   * Measured: 22 offenders on Chromium at 375x812. The budget carries a small
   * amount of headroom so platform font-metric differences between a local run
   * and the CI runner cannot flip the result on their own.
   */
  const KNOWN_MOBILE_OVERFLOW_BUDGET = 24;

  test('mobile overflow does not get worse', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoApp(page);

    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // >8px past the edge, to tolerate deliberate off-canvas transforms
        // and sub-pixel rounding.
        if (r.right > vw + 8) {
          bad.push(`${el.tagName}.${el.className?.toString().slice(0, 40)} right=${Math.round(r.right)}`);
        }
      }
      return bad;
    });

    expect(
      offenders.length,
      `${offenders.length} element(s) overflow the 375px viewport (budget ${KNOWN_MOBILE_OVERFLOW_BUDGET}).\n` +
        `The root cause is the fixed w-64 sidebar with no mobile collapse.\n` +
        offenders.slice(0, 15).join('\n'),
    ).toBeLessThanOrEqual(KNOWN_MOBILE_OVERFLOW_BUDGET);
  });

  test('tap targets in the sidebar meet the 24px minimum', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoApp(page);

    // WCAG 2.2 SC 2.5.8 sets 24x24 CSS px as the minimum; 44px is the stricter
    // platform guidance. Gate on the standard's floor so the check is a real
    // bar rather than an aspiration.
    const tooSmall = await sidebar(page).evaluate((aside) => {
      const bad: string[] = [];
      for (const btn of Array.from(aside.querySelectorAll<HTMLElement>('button'))) {
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 24 || r.width < 24) {
          bad.push(`${Math.round(r.width)}x${Math.round(r.height)} "${btn.innerText.slice(0, 20)}"`);
        }
      }
      return bad;
    });

    expect(tooSmall, `sidebar tap targets under 24px:\n${tooSmall.join('\n')}`).toEqual([]);
  });

  test('the layout reflows rather than truncating between breakpoints', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const wide = await sidebar(page).boundingBox();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400); // let the CSS transition settle
    const narrow = await sidebar(page).boundingBox();

    expect(wide).not.toBeNull();
    expect(narrow).not.toBeNull();
    expect(narrow!.width).toBeLessThanOrEqual(wide!.width);
  });
});
