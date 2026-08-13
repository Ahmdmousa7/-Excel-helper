import { test, expect } from './fixtures';
import type { Locator } from '@playwright/test';

/**
 * Wait for the drawer to finish sliding, rather than sleeping and hoping.
 *
 * This replaces `await page.waitForTimeout(400)` followed by a bare
 * `expect(await sidebar.boundingBox())`, which was TD-040's most reproducible
 * flake: `expect()` on a number that has already been read does NOT retry, so a
 * transition that had not finished within the fixed 400 ms failed permanently.
 * With six Playwright workers competing for twelve cores, animation frames slip
 * and 400 ms is occasionally not enough — reproduced as
 * "the drawer did not slide in" once in 202 runs.
 *
 * `expect.poll` re-reads the box until it settles, so the assertion converges as
 * soon as the transition ends and only fails if the drawer genuinely never
 * arrives. That makes it independent of machine load instead of tuned to one
 * machine's idle speed, and the fix is to wait for the right THING rather than to
 * raise the sleep — a longer sleep would just move the threshold and slow every
 * passing run.
 */
const drawerRightEdge = (sidebar: Locator) =>
  expect
    .poll(async () => {
      const box = await sidebar.boundingBox();
      return box ? Math.round(box.x + box.width) : null;
    }, { timeout: 10_000, message: 'the drawer never reached its resting position' });

const drawerLeftEdge = (sidebar: Locator) =>
  expect
    .poll(async () => {
      const box = await sidebar.boundingBox();
      return box ? Math.round(box.x) : null;
    }, { timeout: 10_000, message: 'the drawer never reached its resting position' });

const VIEWPORTS = [
  { name: 'mobile-portrait', width: 375, height: 812 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
] as const;

test.describe('responsive layout', () => {
  for (const vp of VIEWPORTS) {
    test(`renders without horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ shell, page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await shell.goto();

      const overflow = await shell.horizontalOverflow();
      // A couple of pixels of sub-pixel rounding is normal; a real overflow is
      // tens of pixels and makes the page pan sideways on a phone.
      expect(overflow, `the page scrolls sideways by ${overflow}px at ${vp.width}px wide`).toBeLessThanOrEqual(2);
    });
  }

  test('the shell stays usable at 375px', async ({ shell, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await shell.goto();
    await shell.expectHealthy();
  });

  /**
   * Mobile overflow ratchet (TD-005).
   *
   * Was 24, when the sidebar was a fixed `w-64` with no responsive collapse and
   * 22 header controls sat off the right edge, unreachable. The off-canvas
   * drawer brought that to **1**.
   *
   * The one remaining is `DIV.absolute -top-24 -right-24 w-96` — a decorative
   * background blob deliberately positioned past the edge. It is not a defect,
   * so the budget is 2: room for that plus platform font-metric variance,
   * without room for a real regression to hide in.
   *
   * Never raise this to make a red build green.
   */
  const KNOWN_MOBILE_OVERFLOW_BUDGET = 2;

  test('mobile overflow does not get worse', async ({ shell, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await shell.goto();

    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // >8px past the edge, tolerating deliberate off-canvas transforms.
        if (r.right > vw + 8) {
          bad.push(`${el.tagName}.${el.className?.toString().slice(0, 40)} right=${Math.round(r.right)}`);
        }
      }
      return bad;
    });

    expect(
      offenders.length,
      `${offenders.length} element(s) overflow the 375px viewport (budget ${KNOWN_MOBILE_OVERFLOW_BUDGET}).\n` +
        `Root cause is the fixed w-64 sidebar with no mobile collapse (TD-005).\n` +
        offenders.slice(0, 15).join('\n'),
    ).toBeLessThanOrEqual(KNOWN_MOBILE_OVERFLOW_BUDGET);
  });

  test('tap targets in the sidebar meet the 24px minimum', async ({ shell, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await shell.goto();

    // WCAG 2.2 SC 2.5.8 sets 24x24 CSS px as the minimum; 44px is the stricter
    // platform guidance. Gate on the standard's floor so this is a real bar.
    const tooSmall = await shell.sidebar.evaluate((aside) => {
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

  test('the layout reflows rather than truncating between breakpoints', async ({ shell, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await shell.goto();
    const wide = await shell.sidebar.boundingBox();

    expect(wide, 'the sidebar element is gone at 1280px').not.toBeNull();

    await page.setViewportSize({ width: 375, height: 812 });

    // Wait for the settled state that actually CHANGES — the sidebar becoming an
    // off-canvas drawer — not for the width.
    //
    // Polling the width looked like a wait and was not: the sidebar is ~256px at
    // both breakpoints, so `width <= wide.width` was already true on the first
    // read, mid-transition or not, and the poll returned immediately. A poll whose
    // predicate is true before the thing happens is a sleep of zero.
    await drawerRightEdge(shell.sidebar).toBeLessThanOrEqual(1);

    // Now the width comparison means something, because it is measured after the
    // layout settled rather than during it.
    const narrow = await shell.sidebar.boundingBox();
    expect(narrow, 'the sidebar element is gone at 375px').not.toBeNull();
    expect(narrow!.width).toBeLessThanOrEqual(wide!.width);
  });

  test.describe('mobile navigation drawer', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('the sidebar is off-canvas by default and the trigger is visible', async ({ shell, page }) => {
      await shell.goto();

      // Off-canvas, not display:none — it stays in the accessibility tree and
      // slides rather than popping, which is what makes the transition read as
      // a drawer instead of a flash.
      const box = await shell.sidebar.boundingBox();
      expect(box, 'the sidebar element is gone entirely').not.toBeNull();
      expect(box!.x + box!.width, 'the sidebar is not off-canvas at 375px').toBeLessThanOrEqual(1);

      await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible();
    });

    test('the trigger opens it and the backdrop closes it', async ({ shell, page }) => {
      await shell.goto();

      await page.getByRole('button', { name: /open navigation/i }).click();
      await drawerLeftEdge(shell.sidebar).toBeGreaterThanOrEqual(-1);

      // Tap to the RIGHT of the drawer, not on the backdrop's centre. The
      // backdrop is full-screen, so its centre point sits underneath the 256px
      // drawer — Playwright would click there and hit the drawer instead. This
      // also matches what a real user does: they tap the visible content beside
      // the panel, not its middle.
      await expect(page.getByRole('button', { name: /close navigation/i })).toBeVisible();
      await page.mouse.click(340, 400);

      await drawerRightEdge(shell.sidebar).toBeLessThanOrEqual(1);
    });

    test('picking a tool closes the drawer', async ({ shell, page }) => {
      await shell.goto();
      await page.getByRole('button', { name: /open navigation/i }).click();
      await drawerLeftEdge(shell.sidebar).toBeGreaterThanOrEqual(-1);

      // Leaving it open over the tool the user just chose would hide the thing
      // they came for.
      await shell.sidebar.getByRole('button', { name: 'Separator', exact: false }).first().click();

      await drawerRightEdge(shell.sidebar).toBeLessThanOrEqual(1);
    });

    test('the header controls are reachable at 375px', async ({ shell, page }) => {
      // The actual regression TD-005 describes: 22 controls pushed past the
      // right edge, where no amount of scrolling reached them.
      await shell.goto();

      const offscreen = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const header = document.querySelector('header');
        if (!header) return ['no <header> found'];
        return Array.from(header.querySelectorAll<HTMLElement>('button'))
          .filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.left > vw; })
          .map((b) => b.getAttribute('aria-label') ?? b.className.slice(0, 30));
      });

      expect(offscreen, `header controls off the right edge:\n${offscreen.join('\n')}`).toEqual([]);
    });
  });

  test('a tool renders correctly on a tablet', async ({ shell, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await shell.goto();

    const { QrToolPage } = await import('./pages/QrToolPage');
    const qr = new QrToolPage(page, shell);
    await qr.open();
    await qr.generate('tablet-layout-check');

    await expect(qr.image).toBeVisible();
    expect(await shell.horizontalOverflow()).toBeLessThanOrEqual(2);
  });
});
