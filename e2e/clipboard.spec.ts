import { test, expect } from './fixtures';

/**
 * Chromium-only: the clipboard permissions granted in playwright.config.ts are
 * a Chromium capability. Elsewhere the writes would reject for reasons that
 * have nothing to do with the app.
 */
test.describe('clipboard', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions are Chromium-only');

  /** Record what the page asks the clipboard to do, without preventing it. */
  async function spyOnClipboard(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls = [];
      const nav = navigator as unknown as { clipboard: Record<string, unknown> };
      const realWrite = nav.clipboard.write as ((d: unknown) => Promise<void>) | undefined;
      const realWriteText = nav.clipboard.writeText as ((s: string) => Promise<void>) | undefined;
      const log = (s: string) =>
        (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls.push(s);

      if (realWrite) {
        nav.clipboard.write = async (d: unknown) => { log('write'); return realWrite.call(nav.clipboard, d); };
      }
      if (realWriteText) {
        nav.clipboard.writeText = async (s: string) => { log(`writeText:${s}`); return realWriteText.call(nav.clipboard, s); };
      }
    });
  }

  const clipboardCallCount = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls.length);

  test('the QR copy button writes to the clipboard without throwing', async ({ qr, page, context, pageErrors }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await qr.generate('https://example.com/copy-target');
    await spyOnClipboard(page);

    await qr.copyButton.click();

    await expect
      .poll(() => clipboardCallCount(page), {
        timeout: 8_000,
        message: 'the copy button never called the clipboard API',
      })
      .toBeGreaterThan(0);

    pageErrors.expectNone('copying threw');
  });

  test('clipboard text round-trips in this browser context', async ({ app, page, context }) => {
    // A guard on the harness, not the app: if this fails, a clipboard failure
    // elsewhere in the suite is a permissions problem rather than a bug.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await app.expectHealthy();

    await page.evaluate(() => navigator.clipboard.writeText('apexyard-clipboard-probe'));
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('apexyard-clipboard-probe');
  });

  test('a clipboard rejection does not crash the app', async ({ qr, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await qr.generate('rejection-path');

    // Simulate a locked-down browser: the app must degrade, not white-screen.
    await page.evaluate(() => {
      const nav = navigator as unknown as { clipboard: Record<string, unknown> };
      nav.clipboard.write = () => Promise.reject(new Error('denied'));
      nav.clipboard.writeText = () => Promise.reject(new Error('denied'));
    });

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    await qr.copyButton.click();
    await page.waitForTimeout(800);

    await expect(qr.image).toBeVisible();
    expect(crashes, `a rejected clipboard write crashed the page:\n${crashes.join('\n')}`).toEqual([]);
  });
});
