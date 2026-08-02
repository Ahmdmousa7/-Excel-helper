import { test, expect } from '@playwright/test';
import { gotoApp, sidebar, openTool, openQrTool, TOOL } from './fixtures';

/**
 * The app's job is to survive bad input. Every case here is something a real
 * user does by accident: an empty field, a wrong-format file, a network that
 * disappears mid-task.
 */
test.describe('error handling', () => {
  test('an empty QR input does not crash or render a broken image', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    const input = page.locator('textarea').first();
    await input.fill('x');
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible({ timeout: 15_000 });

    await input.fill('');
    await page.waitForTimeout(600);

    // Either the preview clears or it keeps the last render — both are fine.
    // What is not fine is a broken <img> or an exception.
    const img = page.locator('img[alt="QR Code"]');
    if (await img.count()) {
      const broken = await img.first().evaluate(
        (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 0,
      );
      expect(broken, 'the QR preview is a broken image after clearing the input').toBe(false);
    }
    expect(crashes, `clearing the input threw:\n${crashes.join('\n')}`).toEqual([]);
  });

  test('a very long QR payload fails gracefully', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    // Well past the ~4,296-character ceiling for a QR code. The library will
    // reject this; the tool must not take the page down with it.
    await page.locator('textarea').first().fill('A'.repeat(8000));
    await page.waitForTimeout(1500);

    await expect(sidebar(page)).toBeVisible();
    expect(crashes, `an oversized payload crashed the page:\n${crashes.join('\n')}`).toEqual([]);
  });

  test('a data tool handles having no file loaded', async ({ page }) => {
    await gotoApp(page);

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    // Every one of these expects a spreadsheet. Opening them cold is the most
    // common thing a first-time user does.
    for (const tool of [TOOL.removeBlanks, TOOL.compareFiles, TOOL.deduplicator, TOOL.mergeDatasets, TOOL.separator]) {
      await openTool(page, tool);
      await expect(sidebar(page), `the shell broke after opening "${tool}"`).toBeVisible();
      await expect(
        page.getByText(/something went wrong/i),
        `"${tool}" tripped the error boundary with no file loaded`,
      ).toHaveCount(0);
    }

    expect(crashes, `opening tools with no file threw:\n${crashes.join('\n')}`).toEqual([]);
  });

  test('rejecting every network request leaves the shell standing', async ({ page }) => {
    // Simulate a corporate firewall / offline laptop: everything cross-origin
    // fails. The client-side tools must still work.
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
        return route.continue();
      }
      return route.abort();
    });

    await gotoApp(page);
    await expect(sidebar(page)).toBeVisible();

    await openQrTool(page);
    await page.locator('textarea').first().fill('offline-generated');
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible({ timeout: 20_000 });
  });

  test('rapid tool switching does not leave the app in a broken state', async ({ page }) => {
    await gotoApp(page);

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    // Mount/unmount churn is where missing effect cleanup and stale setState
    // after unmount surface.
    for (let round = 0; round < 3; round++) {
      for (const tool of [TOOL.removeBlanks, TOOL.separator, TOOL.mergeDatasets]) {
        await openTool(page, tool);
      }
    }

    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    expect(crashes, `rapid tool switching threw:\n${crashes.join('\n')}`).toEqual([]);
  });

  test('an unknown hash route still renders the app', async ({ page }) => {
    await page.goto('./#/no-such-route', { waitUntil: 'domcontentloaded' });
    await expect(sidebar(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });
});
