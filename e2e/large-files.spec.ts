import { test, expect, TOOL } from './fixtures';
import { makeCsv } from './helpers/makeFiles';

/**
 * Large-input behaviour.
 *
 * The inputs here are chosen by the user, not the developer, which inverts the
 * usual performance calculus: code that is fine on a 50-row fixture is a frozen
 * tab on a customer's 40,000-row export, and the failure looks like a crash
 * rather than slowness.
 *
 * These are generous, non-flaky bounds. They exist to catch an O(n²) regression
 * — the kind that turns 20 seconds into 20 minutes — not to police milliseconds.
 */
test.describe('large files', () => {
  test.slow(); // triples the timeout: parsing tens of thousands of rows is not fast

  test('a 5,000-row CSV loads without freezing the tab', async ({ app, dataTool, page }) => {
    await app.openTool(TOOL.removeBlanks);

    const file = makeCsv(5_000);
    const started = Date.now();
    await dataTool.upload(file.name, file.mimeType, file.buffer);

    // The main thread must stay responsive: if it is blocked, this evaluate
    // cannot resolve and the assertion times out rather than passing slowly.
    await expect
      .poll(async () => page.evaluate(() => document.readyState), { timeout: 60_000 })
      .toBe('complete');

    await dataTool.expectStillUsable();
    console.log(`5,000 rows handled in ~${Date.now() - started}ms`);
  });

  test('a 40,000-row CSV completes within a generous bound', async ({ app, dataTool, page }) => {
    await app.openTool(TOOL.removeBlanks);

    const file = makeCsv(40_000);
    expect(file.buffer.length).toBeGreaterThan(1_000_000); // ~1.5 MB, a realistic export

    const started = Date.now();
    await dataTool.upload(file.name, file.mimeType, file.buffer);

    // 8x the row count of the previous test. If handling is linear this is
    // seconds; if something is quadratic it will blow through the timeout,
    // which is exactly the signal wanted.
    await expect
      .poll(async () => page.evaluate(() => document.readyState), { timeout: 120_000 })
      .toBe('complete');

    const elapsed = Date.now() - started;
    console.log(`40,000 rows handled in ~${elapsed}ms`);

    await dataTool.expectStillUsable();
    expect(elapsed, 'a 40k-row file took over two minutes — suspect an O(n^2) path').toBeLessThan(120_000);
  });

  test('the UI stays interactive while a large file is processed', async ({ app, dataTool }) => {
    await app.openTool(TOOL.removeBlanks);

    const file = makeCsv(20_000);
    await dataTool.upload(file.name, file.mimeType, file.buffer);

    // Not awaiting a completion signal: the point is that the shell responds
    // NOW, mid-work. A blocked main thread fails this on timeout.
    await app.searchFor('Compare');
    await expect(app.search).toHaveValue('Compare', { timeout: 30_000 });
    await app.searchFor('');
  });

  test('switching tools mid-processing does not corrupt the app', async ({ app, dataTool }) => {
    await app.openTool(TOOL.removeBlanks);

    const file = makeCsv(20_000);
    await dataTool.upload(file.name, file.mimeType, file.buffer);

    // Unmounting a component whose async work is still in flight is where
    // setState-after-unmount and missing cleanup surface.
    await app.openTool(TOOL.separator);
    await app.openTool(TOOL.compareFiles);
    await app.expectHealthy();
  });
});
