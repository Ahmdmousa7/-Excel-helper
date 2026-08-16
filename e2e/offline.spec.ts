import { test, expect, TOOL } from './fixtures';
import { makeCsv } from './helpers/makeFiles';

/**
 * Offline and degraded-network behaviour.
 *
 * Most of this app is client-side by design — spreadsheet transforms, QR
 * generation, PDF assembly all run in the browser. That is a real feature on a
 * flaky connection, but only if the app does not tie its own shoelaces
 * together: one failed network call must not take the tools down with it.
 *
 * This used to be specifically about Firebase, which initialised on every load
 * and retried in the background. ADR-0005 deleted it, so there is far less to go
 * wrong offline — but the property still needs asserting, because the remaining
 * network users (Google Sheets sync, the AI calls, the scraper's CORS proxies)
 * can each fail the same way.
 */
test.describe('offline', () => {
  test('client-side tools keep working with the network cut', async ({ app, qr, context }) => {
    // Load first, then go offline — this models a connection dropping during
    // use, which is the common case. Cold-start offline needs a service worker
    // the app does not have; see the last test in this file.
    await qr.generate('online-baseline');

    await context.setOffline(true);
    try {
      await qr.generate('generated-while-offline');
      await expect(qr.image).toBeVisible();
      await app.expectHealthy();
    } finally {
      await context.setOffline(false);
    }
  });

  test('a spreadsheet transform works offline', async ({ app, dataTool, context }) => {
    await app.openTool(TOOL.removeBlanks);
    await context.setOffline(true);
    try {
      const file = makeCsv(200);
      await dataTool.upload(file.name, file.mimeType, file.buffer);
      await app.page.waitForTimeout(2000);
      await dataTool.expectStillUsable();
    } finally {
      await context.setOffline(false);
    }
  });

  test('tool navigation still works offline once chunks are cached', async ({ app, context }) => {
    // Visit the tools first so their lazy chunks are in the HTTP cache, then
    // cut the network. This is the realistic pattern for a user mid-session.
    await app.openTool(TOOL.removeBlanks);
    await app.openTool(TOOL.separator);

    await context.setOffline(true);
    try {
      await app.openTool(TOOL.removeBlanks);
      await app.expectHealthy();
    } finally {
      await context.setOffline(false);
    }
  });

  test('going offline does not trip the error boundary', async ({ app, context }) => {
    await context.setOffline(true);
    try {
      // Give any background request time to fail and surface whatever it does.
      await app.page.waitForTimeout(4000);
      await app.expectHealthy();
    } finally {
      await context.setOffline(false);
    }
  });

  test('the app recovers when the network comes back', async ({ app, qr, context }) => {
    await qr.generate('before-drop');
    await context.setOffline(true);
    await app.page.waitForTimeout(2000);
    await context.setOffline(false);
    await app.page.waitForTimeout(1500);

    await qr.generate('after-recovery');
    await expect(qr.image).toBeVisible();
    await app.expectHealthy();
  });

  test('opening an uncached tool offline fails visibly, not silently', async ({ app, context }) => {
    // A lazy chunk that was never fetched cannot be fetched offline. React's
    // lazy() rejects, and without an error boundary around Suspense the whole
    // tree unmounts to a blank page.
    //
    // Documenting current behaviour rather than asserting a fix: the app has a
    // top-level ErrorBoundary, so the worst case is a visible error rather than
    // a white screen. A per-tool boundary with a retry would be better, and is
    // worth doing when the app gets a service worker.
    await context.setOffline(true);
    try {
      const tool = app.tool(TOOL.qrGenerator);
      await tool.click().catch(() => undefined);
      await app.page.waitForTimeout(3000);

      const blank = await app.page.evaluate(() => document.body.innerText.trim().length === 0);
      expect(blank, 'the page went completely blank when a chunk failed to load').toBe(false);
    } finally {
      await context.setOffline(false);
    }
  });
});
