import { test, expect, TOOL, GROUP } from './fixtures';

/**
 * Regression guards.
 *
 * Each test pins a property that has broken before, or that would break
 * silently and expensively. Add a case whenever a bug escapes — the point is
 * that the same bug cannot escape twice.
 */
test.describe('regression', () => {
  test('a Content-Security-Policy is present and not violated', async ({ shell, qr, page }) => {
    // TD-006. A CSP that is too strict breaks a feature silently — the browser
    // blocks the request and logs to a console nobody is watching. This makes
    // that a test failure instead.
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/content security policy|refused to (load|connect|execute|apply)/i.test(m.text())) {
        violations.push(m.text());
      }
    });

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp, 'no CSP meta tag on the page').toBeTruthy();

    // The three directives that are pure win and must never be relaxed.
    expect(csp).toMatch(/object-src\s+'none'/);
    expect(csp).toMatch(/base-uri\s+'self'/);
    expect(csp).toMatch(/form-action\s+'self'/);

    // Exercise a tool so the policy is tested against real work, not just load.
    await qr.generate('https://example.com/csp');
    await page.waitForTimeout(1000);
    await shell.expectHealthy();

    expect(violations, `the CSP blocked something the app needs:\n${violations.join('\n')}`).toEqual([]);
  });

  test('Tailwind is compiled into the bundle, not loaded from a CDN', async ({ app, page }) => {
    // TD-007. The failure mode of that change is silent: a wrong content glob
    // purges classes the app uses, the page still renders and still returns
    // 200, and it just looks broken.
    await app.expectHealthy();
    expect(
      await page.locator('script[src*="cdn.tailwindcss.com"]').count(),
      'the Tailwind Play CDN script is back in the page',
    ).toBe(0);
    expect(
      await page.locator('link[rel="stylesheet"][href*=".css"]').count(),
      'no compiled stylesheet is linked',
    ).toBeGreaterThan(0);
  });

  test('custom theme utilities survive purging', async ({ app, page }) => {
    // `primary-*` is a custom token, so it is the canary: if the content globs
    // miss a directory, these vanish first while stock utilities keep working.
    const primaryButton = app.sidebar.locator('button.bg-primary-600').first();
    await expect(primaryButton).toBeVisible();

    expect(
      await primaryButton.evaluate((el) => getComputedStyle(el).backgroundColor),
      'bg-primary-600 resolved to nothing — the custom palette was purged',
    ).toBe('rgb(37, 99, 235)'); // #2563eb

    // A stock utility, to distinguish "custom tokens purged" from "Tailwind is
    // not running at all".
    expect(
      (await app.sidebar.boundingBox())?.width ?? 0,
      'the w-64 sidebar has no width — Tailwind is not applied',
    ).toBeGreaterThan(200);

    expect(
      await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily),
      'the custom font stack is missing',
    ).toMatch(/Inter/i);
  });

  test('the heavy vendor chunks are not fetched on the landing page', async ({ shell, page }) => {
    // TD-004. Regressing this is easy and invisible: one static import of a tab
    // in App.tsx pulls its whole dependency tree back into the entry, and
    // nothing about the app looks or behaves differently.
    //
    // Asserting on a chunk COUNT would be wrong — the landing page legitimately
    // fetches the HomeTab chunk and its dependencies, and that number moves
    // whenever Rollup regroups. What must never happen is the spreadsheet, PDF,
    // or AI engine loading before the user opens a tool that needs one.
    const fetched: string[] = [];
    page.on('response', (r) => {
      if (/\/assets\/.*\.js$/.test(r.url())) fetched.push(r.url().split('/').pop()!);
    });

    await shell.goto();
    await page.waitForTimeout(2500);

    const heavy = fetched.filter((f) =>
      /xlsx|sheetjs|pdf|jspdf|genai|jszip|html2canvas/i.test(f),
    );
    expect(
      heavy,
      `heavy engines loaded before any tool asked for them:\n${heavy.join('\n')}\n\n` +
        `all chunks fetched:\n${fetched.join('\n')}`,
    ).toEqual([]);
  });

  test('opening a tool fetches its chunk on demand', async ({ app, page }) => {
    const fetched: string[] = [];
    page.on('response', (r) => {
      if (/\/assets\/.*\.js$/.test(r.url())) fetched.push(r.url().split('/').pop()!);
    });

    await app.openTool(TOOL.separator);
    await page.waitForTimeout(1500);

    expect(
      fetched.length,
      'opening a tool fetched no new chunk — lazy loading may have regressed',
    ).toBeGreaterThan(0);
  });

  test('the GitHub Pages base path is honoured', async ({ app, page }) => {
    // vite.config.ts sets base: '/-Excel-helper/'. Dropping it ships a site
    // whose every asset 404s — and it only appears after deploy, never in dev.
    await app.expectHealthy();
    const bad = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
        .map((s) => s.getAttribute('src') ?? '')
        .filter((src) => src.startsWith('/') && !src.startsWith('/-Excel-helper/')),
    );
    expect(bad, `assets reference a root path instead of the Pages base:\n${bad.join('\n')}`).toEqual([]);
  });

  test('no asset request 404s on the landing view', async ({ shell, page }) => {
    const missing: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 404 && res.url().includes('127.0.0.1')) {
        missing.push(`${res.status()} ${res.url()}`);
      }
    });

    await shell.goto();
    await page.waitForTimeout(1500);
    expect(missing, `local assets 404'd:\n${missing.join('\n')}`).toEqual([]);
  });

  test('the loading shell is always replaced by the real app', async ({ app }) => {
    // If React fails to mount, the user sees "Loading Workspace..." forever and
    // the page still reports HTTP 200 — the worst kind of failure, because
    // uptime monitoring stays green.
    await expect(app.loadingShell).toHaveCount(0);
  });

  test('both duplicate Variable Balance tools are not routed at once', async ({ app }) => {
    // VariableBalanceTab and VariableBalanceTabV2 both exist (TD-010). Two live
    // copies means half of every subsequent fix lands in the wrong file.
    const count = await app.sidebar.getByRole('button').filter({ hasText: /balance|رصيد/i }).count();
    expect(
      count,
      'more than one Variable Balance tool is routed — land the V2 migration or delete the loser',
    ).toBeLessThanOrEqual(1);
  });

  test('switching language does not blank the app', async ({ app }) => {
    await app.toggleLanguage();
    await app.expectHealthy();
    await expect(app.sidebar.getByText(GROUP.newTools)).toBeVisible();
  });

  test('switching theme does not blank the app', async ({ app }) => {
    const themeButton = app.sidebar
      .getByRole('button')
      .filter({ hasText: /light|dark|midnight|forest|سمة|فاتح|داكن/i })
      .first();
    if (await themeButton.count()) {
      await themeButton.click();
      await app.expectHealthy();
    }
  });

  test('the QR preview does not leak object URLs across regenerations', async ({ qr, page }) => {
    // The QR tool renders a data: URL, so it should never call
    // createObjectURL for the preview. If that changes, revocation becomes
    // mandatory and this catches the moment it starts mattering.
    await page.evaluate(() => {
      const w = window as unknown as { __objectUrls: number; __revoked: number };
      w.__objectUrls = 0;
      w.__revoked = 0;
      const realCreate = URL.createObjectURL.bind(URL);
      const realRevoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (o: Blob | MediaSource) => { w.__objectUrls++; return realCreate(o); };
      URL.revokeObjectURL = (u: string) => { w.__revoked++; return realRevoke(u); };
    });

    for (const text of ['one', 'two', 'three', 'four', 'five']) await qr.generate(text);

    const { created, revoked } = await page.evaluate(() => {
      const w = window as unknown as { __objectUrls: number; __revoked: number };
      return { created: w.__objectUrls, revoked: w.__revoked };
    });

    const leaked = created - revoked;
    expect(leaked, `${leaked} object URL(s) created and never revoked across 5 regenerations`).toBeLessThanOrEqual(1);
  });

  test('opening every hard-coded tool in sequence leaves no console errors', async ({ app, pageErrors }) => {
    for (const tool of Object.values(TOOL)) await app.openTool(tool);
    pageErrors.expectNone('opening the tools produced console errors');
  });
});
