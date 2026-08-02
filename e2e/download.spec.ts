import { test, expect } from './fixtures';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test.describe('download', () => {
  test('the QR tool downloads a real PNG', async ({ qr }) => {
    await qr.generate('https://example.com/download-target');
    const download = await qr.download();

    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    const path = await download.path();
    expect(path, 'the download produced no file on disk').toBeTruthy();

    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(path!);

    // A zero-byte or HTML-error-page "download" still fires the event, so
    // assert on the PNG magic number rather than just the filename.
    expect(bytes.length, 'the downloaded file is empty').toBeGreaterThan(100);
    expect(bytes.subarray(0, 8).equals(PNG_MAGIC), 'the downloaded file is not a PNG').toBe(true);
  });

  test('the download filename is timestamped so repeats do not collide', async ({ qr, page }) => {
    await qr.generate('first');
    const name1 = (await qr.download()).suggestedFilename();

    await qr.generate('second-distinct-content');
    await page.waitForTimeout(1100); // the name embeds Date.now()
    const name2 = (await qr.download()).suggestedFilename();

    expect(name1).toMatch(/^qrcode_\d+\.png$/);
    expect(name2).toMatch(/^qrcode_\d+\.png$/);
    expect(name2).not.toBe(name1);
  });

  test('downloading twice in a row does not crash the tool', async ({ qr, pageErrors }) => {
    await qr.generate('repeat-download');
    await qr.download();
    await qr.download();

    await expect(qr.image).toBeVisible();
    pageErrors.expectNone('repeated downloads threw');
  });
});
