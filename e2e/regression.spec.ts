import { test, expect } from '@playwright/test';
import { gotoApp, sidebar, openTool, openQrTool, generateQr, TOOL, GROUP } from './fixtures';

/**
 * Regression guards.
 *
 * Each test here pins a property that has broken before, or that would break
 * silently and expensively. Add a case whenever a bug escapes to production —
 * the point is that the same bug cannot escape twice.
 */
test.describe('regression', () => {
  test('the GitHub Pages base path is honoured', async ({ page }) => {
    // vite.config.ts sets base: '/-Excel-helper/'. Dropping or changing it
    // ships a site whose every asset 404s — and the failure only appears
    // after deploy, never in `npm run dev`.
    await gotoApp(page);

    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))) {
        const src = s.getAttribute('src') ?? '';
        if (src.startsWith('/') && !src.startsWith('/-Excel-helper/')) out.push(src);
      }
      return out;
    });

    expect(bad, `assets reference a root path instead of the Pages base:\n${bad.join('\n')}`).toEqual([]);
  });

  test('no asset request 404s on the landing view', async ({ page }) => {
    const missing: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 404 && res.url().includes('127.0.0.1')) {
        missing.push(`${res.status()} ${res.url()}`);
      }
    });

    await gotoApp(page);
    await page.waitForTimeout(1500);

    expect(missing, `local assets 404'd:\n${missing.join('\n')}`).toEqual([]);
  });

  test('the loading shell is always replaced by the real app', async ({ page }) => {
    // index.html ships an inline spinner. If React fails to mount, the user
    // sees "Loading Workspace..." forever and the page still reports HTTP 200
    // — the worst kind of failure, because uptime monitoring stays green.
    await gotoApp(page);
    await expect(page.getByText('Loading Workspace...')).toHaveCount(0);
  });

  test('both duplicate Variable Balance tools are not routed at once', async ({ page }) => {
    // VariableBalanceTab and VariableBalanceTabV2 both exist in the tree. Only
    // one should be reachable; two live copies means half of every subsequent
    // fix lands in the wrong file.
    await gotoApp(page);

    const balanceEntries = await sidebar(page)
      .getByRole('button')
      .filter({ hasText: /balance|رصيد/i })
      .count();

    expect(
      balanceEntries,
      'more than one Variable Balance tool is routed — land the V2 migration or delete the loser',
    ).toBeLessThanOrEqual(1);
  });

  test('switching language does not blank the app', async ({ page }) => {
    await gotoApp(page);

    const langToggle = sidebar(page)
      .getByRole('button', { name: /English|العربية/ })
      .first();
    await expect(langToggle).toBeVisible();
    await langToggle.click();

    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    await expect(sidebar(page).getByText(GROUP.newTools)).toBeVisible();
  });

  test('switching theme does not blank the app', async ({ page }) => {
    await gotoApp(page);

    const themeButton = sidebar(page)
      .getByRole('button')
      .filter({ hasText: /light|dark|midnight|forest|سمة|فاتح|داكن/i })
      .first();

    if (await themeButton.count()) {
      await themeButton.click();
      await expect(sidebar(page)).toBeVisible();
      await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    }
  });

  test('the QR preview does not leak object URLs across regenerations', async ({ page }) => {
    // The QR tool renders a data: URL, so it should never call
    // createObjectURL for the preview. If that changes, revocation becomes
    // mandatory and this catches the moment it starts mattering.
    await gotoApp(page);
    await openQrTool(page);

    await page.evaluate(() => {
      const w = window as unknown as { __objectUrls: number; __revoked: number };
      w.__objectUrls = 0;
      w.__revoked = 0;
      const realCreate = URL.createObjectURL.bind(URL);
      const realRevoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (o: Blob | MediaSource) => { w.__objectUrls++; return realCreate(o); };
      URL.revokeObjectURL = (u: string) => { w.__revoked++; return realRevoke(u); };
    });

    for (const text of ['one', 'two', 'three', 'four', 'five']) {
      await generateQr(page, text);
    }

    const { created, revoked } = await page.evaluate(() => {
      const w = window as unknown as { __objectUrls: number; __revoked: number };
      return { created: w.__objectUrls, revoked: w.__revoked };
    });

    const leaked = created - revoked;
    expect(
      leaked,
      `${leaked} object URL(s) created and never revoked across 5 regenerations`,
    ).toBeLessThanOrEqual(1);
  });

  test('opening every hard-coded tool in sequence leaves no console errors', async ({ page }) => {
    await gotoApp(page);

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/firebase|firestore|net::ERR_|Failed to load resource|googleapis|gsi\/client|tailwindcss/i.test(t)) return;
      errors.push(t);
    });

    for (const tool of Object.values(TOOL)) {
      await openTool(page, tool);
      await page.waitForTimeout(250);
    }

    expect(errors, `opening the tools produced console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
