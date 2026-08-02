import { test, expect } from '@playwright/test';
import { gotoApp, openQrTool, generateQr } from './fixtures';

test.describe('download', () => {
  test('the QR tool downloads a real PNG', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);
    await generateQr(page, 'https://example.com/download-target');

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /download|تحميل/i }).first().click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    const path = await download.path();
    expect(path, 'the download produced no file on disk').toBeTruthy();

    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(path!);

    // A zero-byte or HTML-error-page "download" still fires the event, so
    // assert on the actual PNG magic number rather than just the filename.
    expect(bytes.length, 'the downloaded file is empty').toBeGreaterThan(100);
    expect(
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      'the downloaded file is not a PNG',
    ).toBe(true);
  });

  test('the download filename is timestamped so repeats do not collide', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);
    await generateQr(page, 'first');

    const d1 = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /download|تحميل/i }).first().click();
    const name1 = (await d1).suggestedFilename();

    await generateQr(page, 'second-distinct-content');
    await page.waitForTimeout(1100); // the name embeds Date.now()

    const d2 = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /download|تحميل/i }).first().click();
    const name2 = (await d2).suggestedFilename();

    expect(name1).toMatch(/^qrcode_\d+\.png$/);
    expect(name2).toMatch(/^qrcode_\d+\.png$/);
    expect(name2).not.toBe(name1);
  });

  test('downloading twice in a row does not crash the tool', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);
    await generateQr(page, 'repeat-download');

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    for (let i = 0; i < 2; i++) {
      const dl = page.waitForEvent('download', { timeout: 20_000 });
      await page.getByRole('button', { name: /download|تحميل/i }).first().click();
      await dl;
    }

    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();
    expect(crashes, `repeated downloads crashed the page:\n${crashes.join('\n')}`).toEqual([]);
  });
});
