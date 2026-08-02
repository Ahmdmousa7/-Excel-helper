import { test, expect } from '@playwright/test';
import { gotoApp, openQrTool, generateQr } from './fixtures';

/**
 * Clipboard behaviour is browser- and permission-dependent, so these tests are
 * Chromium-only: the `clipboard-read`/`clipboard-write` permissions granted in
 * playwright.config.ts are a Chromium capability. On other engines the writes
 * would reject for reasons that have nothing to do with the app.
 */
test.describe('clipboard', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions are Chromium-only');

  test('the QR copy button writes to the clipboard without throwing', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoApp(page);
    await openQrTool(page);
    await generateQr(page, 'https://example.com/copy-target');

    // Record what the page asks the clipboard to do. The QR tool uses
    // `navigator.clipboard.write` with an image blob, which cannot be read
    // back as text — so observing the call is the meaningful assertion.
    await page.evaluate(() => {
      (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls = [];
      const nav = navigator as unknown as {
        clipboard: { write?: unknown; writeText?: unknown };
      };
      const realWrite = nav.clipboard.write as ((d: unknown) => Promise<void>) | undefined;
      const realWriteText = nav.clipboard.writeText as ((s: string) => Promise<void>) | undefined;

      if (realWrite) {
        nav.clipboard.write = async (data: unknown) => {
          (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls.push('write');
          return realWrite.call(nav.clipboard, data);
        };
      }
      if (realWriteText) {
        nav.clipboard.writeText = async (s: string) => {
          (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls.push(`writeText:${s}`);
          return realWriteText.call(nav.clipboard, s);
        };
      }
    });

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // The copy control sits next to the download button and is icon-only.
    const copyButton = page.getByRole('button', { name: /copy qr code/i });
    await copyButton.click();

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as unknown as { __clipboardCalls: string[] }).__clipboardCalls.length,
          ),
        { timeout: 8_000, message: 'the copy button never called the clipboard API' },
      )
      .toBeGreaterThan(0);

    expect(errors, `copying threw:\n${errors.join('\n')}`).toEqual([]);
  });

  test('clipboard text round-trips in this browser context', async ({ page, context }) => {
    // A guard on the harness rather than the app: if this fails, a clipboard
    // failure elsewhere in the suite is a permissions problem, not a bug.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoApp(page);

    await page.evaluate(() => navigator.clipboard.writeText('apexyard-clipboard-probe'));
    const read = await page.evaluate(() => navigator.clipboard.readText());
    expect(read).toBe('apexyard-clipboard-probe');
  });

  test('a clipboard rejection does not crash the app', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoApp(page);
    await openQrTool(page);
    await generateQr(page, 'rejection-path');

    // Simulate a locked-down browser: the app must degrade, not white-screen.
    await page.evaluate(() => {
      const nav = navigator as unknown as { clipboard: Record<string, unknown> };
      nav.clipboard.write = () => Promise.reject(new Error('denied'));
      nav.clipboard.writeText = () => Promise.reject(new Error('denied'));
    });

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    const copyButton = page.getByRole('button', { name: /copy qr code/i });
    await copyButton.click();
    await page.waitForTimeout(800);

    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();
    expect(crashes, `a rejected clipboard write crashed the page:\n${crashes.join('\n')}`).toEqual([]);
  });
});
