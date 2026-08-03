import { test, expect, Page, Request, Response } from '@playwright/test';

/**
 * Post-deployment verification.
 *
 * These assert that the deploy itself is sound: the document serves, every
 * asset resolves — including chunks no homepage request touches — the bundle
 * parses, React mounts, and nothing throws. That is enough to catch the failure
 * modes a Pages deploy actually has: a wrong `base` path, a missing asset, a
 * bundle that 200s but is HTML, a build that white-screens, a chunk Jekyll ate.
 *
 * Deeper behaviour is covered by the pre-merge suite against the built bundle.
 * Duplicating it here would buy nothing and make every deploy slower.
 */

/** Third-party noise the app does not control and cannot fix.
 *
 *  `firebaseio` and `firestore` were removed when ADR-0005 deleted Firebase: a
 *  message naming either would now mean it came back, which is a finding rather
 *  than noise. The Google entries stay — Sheets sync uses Google Identity
 *  Services, which is unrelated to Firebase and still in use. */
const EXTERNAL_NOISE =
  /googleapis|gstatic|accounts\.google|gsi\/client|googletagmanager|google-analytics|cdn\.tailwindcss/i;

function watch(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failed: string[] = [];
  const notFound: string[] = [];

  page.on('console', (m) => {
    if (m.type() === 'error' && !EXTERNAL_NOISE.test(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r: Request) => {
    if (!EXTERNAL_NOISE.test(r.url())) {
      failed.push(`${r.url()} — ${r.failure()?.errorText ?? 'unknown'}`);
    }
  });
  page.on('response', (r: Response) => {
    if (r.status() >= 400 && !EXTERNAL_NOISE.test(r.url())) notFound.push(`${r.status()} ${r.url()}`);
  });

  return { consoleErrors, pageErrors, failed, notFound };
}

test.describe('live deployment', () => {
  test('the homepage serves a 200 with HTML', async ({ page }) => {
    const res = await page.goto('./', { waitUntil: 'domcontentloaded' });
    expect(res, 'no response from the live URL').not.toBeNull();
    expect(res!.status()).toBe(200);
    expect(res!.headers()['content-type'] ?? '').toContain('text/html');
  });

  test('the document has the expected title and favicon', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Sale Onboarding Team/i);
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });

  test('no first-party asset 404s or fails to load', async ({ page }) => {
    const w = watch(page);
    await page.goto('./', { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(3_000);

    expect(w.notFound, `assets returned >=400:\n${w.notFound.join('\n')}`).toEqual([]);
    expect(w.failed, `requests failed outright:\n${w.failed.join('\n')}`).toEqual([]);
  });

  test('the JavaScript bundle serves as JavaScript, not an HTML error page', async ({ page, request }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const scripts = await page.locator('script[src]').evaluateAll((els) =>
      els.map((e) => (e as HTMLScriptElement).src),
    );
    expect(scripts.length, 'the page loaded no scripts at all').toBeGreaterThan(0);

    for (const src of scripts) {
      if (EXTERNAL_NOISE.test(src)) continue;
      const res = await request.get(src);
      expect(res.status(), `${src} did not serve 200`).toBe(200);
      // A misconfigured `base` makes Pages serve index.html for a missing
      // asset — a 200 that is HTML. That is the classic silent deploy break.
      expect(
        res.headers()['content-type'] ?? '',
        `${src} served HTML instead of JavaScript — check vite.config.ts \`base\``,
      ).toMatch(/javascript|ecmascript/i);
    }
  });

  test('every lazily-imported chunk resolves, not just the ones the homepage loads', async ({ page, request }) => {
    // THE GAP THAT LET A BROKEN SITE PASS THIS SUITE.
    //
    // The app code-splits 28 tools behind React.lazy, so none of their chunks
    // are requested until a signed-in user opens that tool. Every test above
    // watches network traffic from the homepage, which means a missing tool
    // chunk is invisible to all of them — the page boots, React mounts, nothing
    // throws, and 18 tests go green while most of the app cannot open.
    //
    // That is exactly what shipped: GitHub Pages runs Jekyll, Jekyll excludes
    // paths beginning with `_`, and Rollup names its CommonJS dynamic-require
    // helper `_commonjs-dynamic-modules-<hash>.js`. Pages served a 404 for it
    // while all 28 tool chunks kept a static import of it, so every one of them
    // failed to load. Fixed by shipping `public/.nojekyll`.
    //
    // So this walks the static module graph from the entry chunk and asserts
    // every edge resolves — which is the only way to see a chunk nobody has
    // navigated to yet.
    test.slow();
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const entry = (
      await page.locator('script[src]').evaluateAll((els) =>
        els.map((e) => (e as HTMLScriptElement).src),
      )
    ).find((s) => !EXTERNAL_NOISE.test(s));
    expect(entry, 'found no first-party entry script').toBeTruthy();

    // Three forms, and the third is the one that matters most here:
    //
    //   from"./x.js"      re-export / named import
    //   import("./x.js")  dynamic import
    //   import"./x.js"    BARE SIDE-EFFECT IMPORT — no `from`, no paren
    //
    // The first version of this test matched only the first two, and 24 of the
    // 28 tool chunks import the helper in the third form. The crawl reached it
    // anyway, but only because `xlsx.min` and `jszip.min` happen to also
    // reference it with `from` — so the test that caught this outage would have
    // passed the moment that incidental edge changed. `seen.size > 20` would not
    // have noticed, because there are 82 chunks.
    const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+\.js)["']/g;

    const queue = [entry!];
    const seen = new Set(queue);
    const broken: string[] = [];

    while (queue.length > 0) {
      const url = queue.shift()!;
      const res = await request.get(url);

      if (res.status() !== 200) {
        broken.push(`${res.status()} ${url}`);
        continue;
      }
      // A 200 that is HTML means Pages served index.html for a missing file.
      if (!/javascript|ecmascript/i.test(res.headers()['content-type'] ?? '')) {
        broken.push(`served non-JavaScript ${url}`);
        continue;
      }

      const body = await res.text();
      for (const [, spec] of body.matchAll(SPECIFIER)) {
        const next = new URL(spec, url).href;
        if (EXTERNAL_NOISE.test(next) || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }

    // Guards the crawl itself: if the regex ever stops matching, this test would
    // silently pass having checked one file.
    expect(seen.size, 'crawled suspiciously few chunks — did the module graph change shape?')
      .toBeGreaterThan(20);
    expect(broken, `chunks referenced by the bundle but not served:\n${broken.join('\n')}`)
      .toEqual([]);
  });

  test('React mounts and replaces the static loading shell', async ({ page }) => {
    const w = watch(page);
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // index.html ships an inline "Loading Workspace..." spinner. If the bundle
    // fails to execute, the page still returns 200 and still looks alive —
    // uptime monitoring stays green while the app is dead. This is the check
    // that catches it.
    await expect(page.getByText('Loading Workspace...')).toHaveCount(0, { timeout: 30_000 });

    const rootChildren = await page.locator('#root > *').count();
    expect(rootChildren, '#root is empty — the bundle did not mount').toBeGreaterThan(0);

    expect(w.pageErrors, `uncaught exceptions on load:\n${w.pageErrors.join('\n')}`).toEqual([]);
  });

  test('the app shell renders, which means the app booted', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // This used to assert the Google sign-in button, until ADR-0005 removed the
    // gate. The shell is what proves a working boot now: `<aside>` is rendered
    // by App, not by index.html, so reaching it means the bundle parsed and
    // React mounted.
    //
    // Asserted on desktop AND mobile, and below `md` the sidebar is an
    // off-canvas drawer (TD-005) that starts closed — so this waits for the
    // element to exist rather than to be visible.
    await expect(page.locator('aside').first()).toBeAttached({ timeout: 30_000 });

    // A control inside the shell, to distinguish a mounted app from an empty
    // <aside> left by a half-failed render.
    await expect(
      page.locator('aside').first().getByRole('button').first(),
    ).toBeAttached({ timeout: 30_000 });

    // Deliberately NOT asserting anything about lazy tab chunks here.
    //
    // `Sidebar` is imported eagerly and rendered outside the <Suspense> boundary
    // that wraps the tab chunks, so `<aside>` is attached even when a tab chunk
    // never resolves. And the default tab is Home (`activeTab === -1`), which
    // has no `component` at all — so the "Loading tool…" fallback never renders
    // on the landing page, and asserting its absence here would pass no matter
    // what. Lazy chunks get their own test below.
  });

  test('tool chunks evaluate, not just download', async ({ page, request }) => {
    // The residual gap after the asset crawl.
    //
    // The crawl proves every chunk SERVES — a 404 or an HTML error page fails
    // it. It cannot prove a chunk RUNS. A chunk that returns 200 with valid
    // JavaScript and then throws on evaluation would pass every other test
    // here, and the user would sit on "Loading tool…" forever.
    //
    // Tabs are state, not routes, so there is no URL that mounts a tool. Rather
    // than drive the sidebar — which is an off-canvas drawer below `md` and
    // would make this a layout test — this imports the chunks directly in the
    // page context. That is the actual contract React.lazy depends on.
    test.slow();
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    const entrySrc = (
      await page.locator('script[src]').evaluateAll((els) =>
        els.map((e) => (e as HTMLScriptElement).src),
      )
    ).find((s) => !EXTERNAL_NOISE.test(s));
    // Asserted, not `!`-asserted: without this, a build that ships no local
    // <script src> makes the next line request `undefined` and fail with a URL
    // parse error instead of saying what went wrong.
    expect(entrySrc, 'found no first-party entry script').toBeTruthy();
    const entryJs = await (await request.get(entrySrc!)).text();

    // A spread of tools rather than all 28: enough to cover the shared
    // spreadsheet path, a PDF/canvas tool, and a network tool, without turning a
    // post-deploy gate into a minute of imports.
    const TOOLS = ['CleanTool', 'CompareTool', 'MergeTool', 'QrCodeTab', 'excelService'];
    const failures: string[] = [];

    for (const tool of TOOLS) {
      // The `./` stays INSIDE the capture group, so the specifier resolves
      // against the entry chunk the same way the browser resolves it.
      //
      // It was outside, with the URL then built as `new URL('assets/' + name,
      // entrySrc)`. entrySrc is already inside assets/, and relative-reference
      // merging strips only the last segment — so every URL came out as
      // `assets/assets/Tool-hash.js`, 404'd, and this test failed
      // unconditionally. That would have turned the post-deploy job red on every
      // single deploy: precisely the routinely-failing gate this suite argues
      // against. The crawl above has always done it correctly.
      const m = entryJs.match(new RegExp(`"(\\./${tool}-[A-Za-z0-9_-]{8}\\.js)"`));
      if (!m) {
        failures.push(`${tool}: no chunk reference found in the entry bundle`);
        continue;
      }
      const url = new URL(m[1], entrySrc!).href;
      const result = await page.evaluate(async (u) => {
        try {
          const mod = await import(/* @vite-ignore */ u);
          return `ok:${Object.keys(mod).length}`;
        } catch (e) {
          return `err:${e instanceof Error ? e.message : String(e)}`;
        }
      }, url);
      if (!result.startsWith('ok:') || result === 'ok:0') {
        failures.push(`${tool}: ${result}`);
      }
    }

    expect(failures, `tool chunks that did not evaluate:\n${failures.join('\n')}`).toEqual([]);
  });

  test('CSS is applied, not just downloaded', async ({ page }) => {
    await page.goto('./', { waitUntil: 'networkidle' }).catch(() => undefined);
    // An unstyled page still passes every check above. Assert a computed style
    // that only exists once the stylesheet is actually in effect.
    const bg = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, 'body has no background colour — CSS did not apply').not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the page does not scroll sideways', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the live page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(2);
  });

  test('no uncaught console errors from first-party code', async ({ page }) => {
    const w = watch(page);
    await page.goto('./', { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    expect(w.consoleErrors, `console errors:\n${w.consoleErrors.join('\n')}`).toEqual([]);
  });
});
