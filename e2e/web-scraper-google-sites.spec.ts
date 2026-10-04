/**
 * Web Scraper on a published Google Sites page, in a real browser, fully
 * offline: r.jina.ai is answered from tests/fixtures/google-sites/, Google's
 * images from a placeholder, and every model call is intercepted. Covers the
 * text route (utils/googleSites.ts), the image route, the fallback to the
 * existing page-text scrape, and links that are not Google Sites.
 */
import { test, expect, AppShell } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../utils/translations';
import { GOOGLE_SITES_COLUMNS } from '../utils/googleSites';

const FIXTURE = JSON.parse(readFileSync(new URL('../tests/fixtures/google-sites/nightback-pages.json', import.meta.url), 'utf-8')) as { pages: Record<string, string> };
const MAIN = 'https://sites.google.com/view/nightback/main-menu';
const AR_HOME = 'https://sites.google.com/view/nightback/الصفحة-الرئيسية';
const en = TRANSLATIONS.en;
const CATEGORY_PAGES = ['hot-drinks', 'soft-drinks', 'shisha-flavours', 'cold-drinks', 'cake-and-sweets', 'الصفحة-الرئيسية'];

const FALLBACK_MARKDOWN = 'Title: Night Back - Main Menu\n\nMenu - English\n\nSpecial offer for the morning shift\n\nShisha + Tea + Water = 39 Riyal only\n';
const FALLBACK_ANSWER = [{ Name: 'Shisha + Tea + Water', Category: 'Special offer', Price: '39' }];
// A 1×1 PNG: tests never fetch Google's real (signed, expiring) image links.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/**
 * Jina: HTML mode → the fixture page for the requested path (or `override`);
 * markdown mode → the old page-text route's answer.
 */
async function jina(page: Page, override: Record<string, { status: number; body?: string }> = {}) {
  const asked: { slug: string; format?: string }[] = [];
  await page.route('https://r.jina.ai/**', async (route) => {
    const format = route.request().headers()['x-return-format'];
    const target = route.request().url().slice('https://r.jina.ai/'.length);
    let slug = target;
    try { slug = decodeURIComponent(new URL(target).pathname.split('/').pop() ?? ''); } catch { /* not a URL */ }
    asked.push({ slug, format });
    const o = override[slug];
    const body = format === 'html' ? o?.body ?? FIXTURE.pages[slug] ?? '' : FALLBACK_MARKDOWN;
    await route.fulfill({
      status: format === 'html' ? o?.status ?? (FIXTURE.pages[slug] ? 200 : 404) : 200,
      contentType: 'text/plain; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body,
    });
  });
  return asked;
}

/** Each model call gets the next answer (the last one repeats). */
async function models(page: Page, answers: unknown[]) {
  const calls: string[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    calls.push(route.request().postData() ?? '');
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(answer) }] } }],
    }) });
  });
  return calls;
}

/** Google Sites itself: pages are never fetched directly (no CORS); images are. */
async function google(page: Page) {
  const pages: string[] = [];
  const images: string[] = [];
  await page.route(/^https:\/\/sites\.google\.com\/(?!sitesv-images)/, async (route) => { pages.push(route.request().url()); await route.abort('blockedbyclient'); });
  await page.route('https://sites.google.com/sitesv-images-rt/**', async (route) => {
    images.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG });
  });
  return { pages, images };
}

async function open(app: AppShell, page: Page, link: string) {
  await app.goto();
  await app.openToolMatching(/Web Scraper|كاشط الويب|استخراج الويب/);
  await page.getByPlaceholder('https://example.com/products').fill(link);
}

async function scrape(app: AppShell, page: Page, link: string) {
  await open(app, page, link);
  await page.getByRole('button', { name: en.common.start }).click();
}

async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: en.common.download, exact: true }).click();
  return XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
}

test.describe('Web Scraper — Google Sites', () => {
  test('the Night Back hub: 103 menu rows from the 5 English category pages, no model call', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await jina(page);
    const calls = await models(page, [FALLBACK_ANSWER]);
    const g = await google(page);
    await scrape(app, page, MAIN);
    await expect(page.getByText(`${en.scraper.preview} (103)`)).toBeVisible({ timeout: 60_000 });

    // The hub, then its links in order, all through Jina in HTML mode; Google's pages never directly.
    expect(asked).toEqual(['main-menu', 'shisha-flavours', 'hot-drinks', 'cold-drinks', 'soft-drinks', 'cake-and-sweets', 'الصفحة-الرئيسية'].map((slug) => ({ slug, format: 'html' })));
    expect(g.pages).toEqual([]);
    expect(g.images).toEqual([]); // menu text was found: no image is read
    expect(calls).toHaveLength(0);

    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/Read the Google Site عودة الليل لاونج: 103 items in 8 categories from 6 pages\./)).toBeVisible();
    await expect(page.getByText(/1 linked page\(s\) are the site's other language edition/)).toBeVisible();
    await expect(page.getByText(/1 priced line\(s\) did not match a menu line .*"Shisha \+ Tea \+ Water = 39 Riyal only"/)).toBeVisible();

    const wb = await download(page);
    expect(wb.SheetNames).toEqual(['Scraped Data', 'Google Sites pages']);
    const sheet = wb.Sheets['Scraped Data'];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    expect(grid[0]).toEqual([...GOOGLE_SITES_COLUMNS]);
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string | number>[];
    expect(rows).toHaveLength(103);
    expect([...new Set(rows.map((r) => r.Category))]).toEqual(['Shisha Flavours', 'Hot Drinks', 'Cold Drinks', 'Fresh juices', 'Soft Drinks', 'Beer', 'Cake and sweets', 'Snacks']);
    expect(rows.find((r) => r.Name === 'Turkish coffee')).toEqual({ Name: 'Turkish coffee', Category: 'Hot Drinks', Price: 20, Type: 'Simple', 'Option 1': '', 'Option 1 Value': '', Duration: '', 'Price Note': '' });
    expect(rows.find((r) => r.Name === 'Heineken beer')).toMatchObject({ Category: 'Beer', Price: 24 });
    // Prices are numeric cells.
    expect(sheet.C2.t).toBe('n');
    expect(new Set(rows.map((r) => `${r.Name}|${r.Category}`)).size).toBe(103); // no duplicate rows

    const report = XLSX.utils.sheet_to_json(wb.Sheets['Google Sites pages'], { header: 1, defval: '' }) as string[][];
    expect(report[0]).toEqual(['Page', 'Link', 'Status', 'Rows', 'Note']);
    expect(report.slice(1).map((r) => [r[0], r[2], r[3]])).toEqual([
      ['Main Menu', 'no menu', '0'],
      ['Shisha Flavours', 'read', '15'],
      ['Hot Drinks', 'read', '27'],
      ['Cold Drinks', 'read', '34'],
      ['Soft Drinks', 'read', '11'],
      ['Cake and Sweets', 'read', '16'],
      ['عودة الليل لاونج', 'other language', '0'],
      ['Main Menu', 'line not parsed', '0'],
    ]);
  });

  test('the Arabic hub: the Arabic edition only, in the site\'s own Arabic', async ({ app, page }) => {
    test.setTimeout(90_000);
    await jina(page);
    const calls = await models(page, [FALLBACK_ANSWER]);
    await google(page);
    await scrape(app, page, AR_HOME);
    await expect(page.getByText(`${en.scraper.preview} (107)`)).toBeVisible({ timeout: 60_000 });
    expect(calls).toHaveLength(0);
    const rows = XLSX.utils.sheet_to_json((await download(page)).Sheets['Scraped Data'], { defval: '' }) as Record<string, string | number>[];
    expect(rows.find((r) => r.Name === 'بيبسي')).toMatchObject({ Category: 'المشروبات الغازية', Price: 7 });
    expect(rows.some((r) => r.Name === 'Pepsi')).toBe(false);
  });

  test('no menu text anywhere: the content images are read by AI, buttons are not', async ({ app, page }) => {
    test.setTimeout(90_000);
    // Every linked page is down: only the hub, whose menu is in images.
    const asked = await jina(page, Object.fromEntries(CATEGORY_PAGES.map((s) => [s, { status: 503 }])));
    const calls = await models(page, [[], [], [{ name: 'شيشة + شاي + ماء', category: 'عرض الفترة الصباحية', price: 39, startingPrice: false, duration: null }]]);
    const g = await google(page);
    await scrape(app, page, MAIN);
    await expect(page.getByText(`${en.scraper.preview} (1)`)).toBeVisible({ timeout: 60_000 });

    expect(asked.filter((a) => a.format !== 'html')).toEqual([]); // no page-text fallback
    // Logo, promo photo, offer banner — in page order; the 5 category buttons are skipped.
    expect(g.images).toHaveLength(3);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain('Do NOT translate');
    expect(calls[0]).toContain('image/png');

    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/1 item in 1 category from 1 page, 3 images read by AI/)).toBeVisible();
    await expect(page.getByText(/6 linked page\(s\) could not be read/)).toBeVisible();
    const rows = XLSX.utils.sheet_to_json((await download(page)).Sheets['Scraped Data'], { defval: '' });
    expect(rows).toEqual([{ Name: 'شيشة + شاي + ماء', Category: 'عرض الفترة الصباحية', Price: 39, Type: 'Simple', 'Option 1': '', 'Option 1 Value': '', Duration: '', 'Price Note': '' }]);
  });

  test('the Google Sites read fails: falls back to the existing page-text route, without the pages sheet', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await jina(page, { 'main-menu': { status: 200, body: '<html><body>Jina could not render this page</body></html>' } });
    const calls = await models(page, [FALLBACK_ANSWER]);
    await google(page);
    await scrape(app, page, MAIN);
    await expect(page.getByText(`${en.scraper.preview} (1)`)).toBeVisible({ timeout: 60_000 });

    expect(asked).toEqual([{ slug: 'main-menu', format: 'html' }, { slug: 'main-menu', format: 'markdown' }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Shisha + Tea + Water = 39 Riyal only');
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/Could not read the Google Site's menu \(The answer was not a published Google Sites page\.\); using the page text instead\./)).toBeVisible();
    const wb = await download(page);
    expect(wb.SheetNames).toEqual(['Scraped Data']);
    expect(XLSX.utils.sheet_to_json(wb.Sheets['Scraped Data'])).toEqual(FALLBACK_ANSWER);
  });

  test('the image model fails: falls back to the page text instead of returning half a menu', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await jina(page, Object.fromEntries(CATEGORY_PAGES.map((s) => [s, { status: 503 }])));
    const calls: string[] = [];
    await page.route(/[gG]enerateContent/, async (route) => {
      calls.push(route.request().postData() ?? '');
      // The first call is an image read: refuse it. The second is the page-text route.
      if (calls.length === 1) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(FALLBACK_ANSWER) }] } }],
      }) });
    });
    await google(page);
    await scrape(app, page, MAIN);
    await expect(page.getByText(`${en.scraper.preview} (1)`)).toBeVisible({ timeout: 60_000 });
    expect(calls).toHaveLength(2);
    expect(asked.filter((a) => a.format === 'markdown')).toHaveLength(1);
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/Could not read the Google Site's menu \(Reading the menu images failed: /)).toBeVisible();
  });

  test('with every field unchecked: a Google Sites link still scrapes; if it fails it stops without a model call', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await jina(page, { 'main-menu': { status: 500 } });
    const calls = await models(page, [FALLBACK_ANSWER]);
    await google(page);
    await open(app, page, MAIN);
    const boxes = page.getByRole('checkbox');
    for (let i = 0; i < await boxes.count(); i++) if (await boxes.nth(i).isChecked()) await boxes.nth(i).uncheck();
    await page.getByRole('button', { name: en.common.start }).click();
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(`${en.common.error}: ${en.scraper.needFields}`)).toBeVisible({ timeout: 60_000 });
    expect(asked).toEqual([{ slug: 'main-menu', format: 'html' }]); // no page-text fetch
    expect(calls).toHaveLength(0);
  });

  test.describe('links that are not Google Sites keep the existing route', () => {
    for (const link of ['https://example.com/menu', 'https://docs.google.com/document/d/abc/edit', 'https://www.google.com/view/nightback/main-menu']) {
      test(link, async ({ app, page }) => {
        test.setTimeout(90_000);
        const asked = await jina(page);
        await models(page, [FALLBACK_ANSWER]);
        await scrape(app, page, link);
        await expect(page.getByText(`${en.scraper.preview} (1)`)).toBeVisible({ timeout: 60_000 });
        expect(asked.map((a) => a.format)).toEqual(['markdown']);
        const wb = await download(page);
        expect(wb.SheetNames).toEqual(['Scraped Data']);
      });
    }
  });
});
