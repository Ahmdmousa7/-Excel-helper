import { test, expect, TOOL } from './fixtures';

/**
 * The app's job is to survive bad input. Every case here is something a real
 * user does by accident.
 */
test.describe('error handling', () => {
  test('an empty QR input does not crash or render a broken image', async ({ qr, page, pageErrors }) => {
    await qr.generate('x');
    await qr.input.fill('');
    await page.waitForTimeout(600);

    // Either the preview clears or it keeps the last render — both fine. What
    // is not fine is a broken <img> or an exception.
    if (await qr.image.count()) {
      const broken = await qr.image
        .first()
        .evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 0);
      expect(broken, 'the QR preview is a broken image after clearing the input').toBe(false);
    }
    pageErrors.expectNone('clearing the input threw');
  });

  test('a very long QR payload fails gracefully', async ({ qr, app, page, pageErrors }) => {
    // Well past the ~4,296-character ceiling for a QR code. The library rejects
    // it; the tool must not take the page down with it.
    await qr.input.fill('A'.repeat(8000));
    await page.waitForTimeout(1500);

    await app.expectHealthy();

    // The library logging "data is too big" is the CORRECT behaviour here, so
    // this test asserts on everything EXCEPT that. Using pageErrors.expectNone()
    // would fail on the app working as intended.
    const unexpected = pageErrors
      .all()
      .filter((e) => !/too big to be stored in a QR ?Code|code length overflow/i.test(e));
    expect(unexpected, `an oversized payload caused an unexpected error:\n${unexpected.join('\n')}`).toEqual([]);
  });

  test('a data tool handles having no file loaded', async ({ app, pageErrors }) => {
    // Every one of these expects a spreadsheet. Opening them cold is the most
    // common thing a first-time user does.
    for (const tool of [
      TOOL.removeBlanks,
      TOOL.compareFiles,
      TOOL.deduplicator,
      TOOL.mergeDatasets,
      TOOL.separator,
    ]) {
      await app.openTool(tool);
      await expect(app.sidebar, `the shell broke after opening "${tool}"`).toBeVisible();
      await expect(
        app.errorBoundary,
        `"${tool}" tripped the error boundary with no file loaded`,
      ).toHaveCount(0);
    }
    pageErrors.expectNone('opening tools with no file threw');
  });

  test('rapid tool switching does not leave the app in a broken state', async ({ app, pageErrors }) => {
    // Mount/unmount churn is where missing effect cleanup and stale setState
    // after unmount surface.
    for (let round = 0; round < 3; round++) {
      for (const tool of [TOOL.removeBlanks, TOOL.separator, TOOL.mergeDatasets]) {
        await app.openTool(tool);
      }
    }
    await app.expectHealthy();
    pageErrors.expectNone('rapid tool switching threw');
  });

  test('an unknown hash route still renders the app', async ({ shell }) => {
    await shell.goto('./#/no-such-route');
    await shell.expectHealthy();
  });
});
