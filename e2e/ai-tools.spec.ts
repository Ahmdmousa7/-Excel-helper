/**
 * TD-051: the model fallback and the readable errors OCR got, now in the other
 * AI tools. Web Scraper and Translator, in a real browser, with every Gemini
 * call intercepted.
 *
 * Web Scraper's page fetch goes through r.jina.ai. By default that is answered
 * from `tests/fixtures/kelah-menu.jina.md` — a trimmed copy of what Jina really
 * returned for https://kelah.yallaqrcodes.com/branch/1/ on 2026-09-29 — so the
 * suite stays deterministic and offline. The last test fetches the REAL site
 * instead, and only runs with E2E_NETWORK=1.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../utils/translations';
import { MODEL_CANDIDATES } from '../services/geminiService';
import { YALLA_REQUEST_TIMEOUT_MS, YALLA_MENU_TIMEOUT_MS } from '../services/yallaMenuService';

const SITE = 'https://kelah.yallaqrcodes.com/branch/1/';
const MENU = readFileSync(new URL('../tests/fixtures/kelah-menu.jina.md', import.meta.url), 'utf-8');

/** What the "model" returns: rows really on that menu, so a row in the export
 *  is traceable to the page. */
const ANSWER = [
  { Name: 'شاي أخضر', Category: 'المشروبات الساخنة', Price: 4 },
  { Name: 'كرك', Category: 'المشروبات الساخنة', Price: 5 },
  { Name: 'سبانش لاتيه', Category: 'القهوة الحارة', Price: 15 },
  { Name: 'بكج الحفلات', Category: 'بكجات حفلات', Price: 400 },
];

const candidate = (text: string) => ({
  candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text }] } }],
});

/** Answer every model call; record the model id and the prompt sent. */
async function modelAnswers(page: Page, answer: unknown) {
  const calls: { model: string; body: string }[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    calls.push({ model: /models\/([^:]+):/.exec(route.request().url())?.[1] ?? '?', body: route.request().postData() ?? '' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(candidate(JSON.stringify(answer))) });
  });
  return calls;
}

/** Every model call fails: `no-quota` = the free-tier 429 `limit: 0`, `busy` = 503. */
async function modelFails(page: Page, kind: 'no-quota' | 'busy') {
  const models: string[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    const model = /models\/([^:]+):/.exec(route.request().url())?.[1] ?? '?';
    models.push(model);
    const error = kind === 'no-quota'
      ? { code: 429, status: 'RESOURCE_EXHAUSTED',
          message: `You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: ${model}` }
      : { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand. Please try again later.' };
    await route.fulfill({ status: error.code, contentType: 'application/json', body: JSON.stringify({ error }) });
  });
  return models;
}

/** Answer r.jina.ai from the fixture — the real page's content, offline. */
async function jinaFromFixture(page: Page) {
  const asked: string[] = [];
  const noCache: (string | undefined)[] = [];
  await page.route('https://r.jina.ai/**', async (route) => {
    asked.push(route.request().url());
    noCache.push(route.request().headers()['x-no-cache']);
    await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: MENU });
  });
  return { asked, noCache };
}

/** The platform's own menu data, from the real capture (utils/yallaMenu.ts). */
const YALLA = JSON.parse(readFileSync(new URL('../tests/fixtures/yalla-kelah.json', import.meta.url), 'utf-8'));

async function yallaFromFixture(page: Page) {
  const asked: { path: string; branch?: string }[] = [];
  await page.route('https://kelah.yallaqrcodes.com/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    asked.push({ path, branch: route.request().headers()['branch'] });
    const body = path === '/api/categories/' ? YALLA.categories
      : path === '/api/items-light/' ? YALLA.items
      : YALLA.details[/\/api\/items\/(\d+)\//.exec(path)?.[1] ?? ''];
    await route.fulfill({ status: body ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body ?? {}) });
  });
  return asked;
}

/** The menu data unreachable: the scraper must fall back to the page text. */
const yallaDown = (page: Page) => page.route('https://kelah.yallaqrcodes.com/api/**', (route) => route.abort('failed'));

const RAW = /RESOURCE_EXHAUSTED|UNAVAILABLE|"error"|\{"|googleapis|limit: 0/;

async function openScraper(app: any, page: Page) {
  await app.goto();
  await app.openToolMatching(/Web Scraper|كاشط الويب|استخراج الويب/);
  await page.getByPlaceholder('https://example.com/products').fill(SITE);
}

test.describe('Web Scraper — kelah.yallaqrcodes.com menu', () => {
  test('the page content reaches the model and the answer reaches the download', async ({ app, page }) => {
    test.setTimeout(90_000);
    const { asked, noCache } = await jinaFromFixture(page);
    const calls = await modelAnswers(page, ANSWER);
    await yallaDown(page); // page-text route (the menu-data route has its own tests)
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.scraper.preview} (4)`)).toBeVisible({ timeout: 60_000 });

    expect(asked).toEqual([`https://r.jina.ai/${SITE}`]);
    // Fresh, not Jina's cached copy: for this very page the cache held an empty
    // app shell (243 bytes, no menu) while the fresh fetch had all 26 sections.
    expect(noCache).toEqual(['true']);
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe(MODEL_CANDIDATES.quality[0]);
    // The menu itself is in the prompt — Arabic, prices and all.
    for (const s of ['سبانش لاتيه', 'كرك', 'بكج الحفلات', '400.00']) expect(calls[0].body).toContain(s);

    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: TRANSLATIONS.en.common.download, exact: true }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets['Scraped Data'])).toEqual(ANSWER);
  });

  test('no quota on any model: ONE readable sentence, one request per candidate', async ({ app, page }) => {
    test.setTimeout(90_000);
    await jinaFromFixture(page);
    const models = await modelFails(page, 'no-quota');
    await yallaDown(page); // page-text route (the menu-data route has its own tests)
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.common.error}: ${TRANSLATIONS.en.aiErrors['no-model']}`))
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(RAW)).toHaveCount(0);
    // Walked the list once — no minutes of retrying a model the key cannot use.
    expect(models).toEqual([...MODEL_CANDIDATES.quality]);
  });

  test('Arabic: every model overloaded → the Arabic "busy" sentence', async ({ app, page }) => {
    test.setTimeout(90_000);
    await jinaFromFixture(page);
    await modelFails(page, 'busy');
    await yallaDown(page); // page-text route (the menu-data route has its own tests)
    await openScraper(app, page);
    await app.toggleLanguage();
    const ar = TRANSLATIONS.ar;
    await page.getByRole('button', { name: ar.common.start }).click();
    await page.getByRole('button', { name: ar.actions.showLogs }).click();
    await expect(page.getByText(`${ar.common.error}: ${ar.aiErrors.busy}`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(RAW)).toHaveCount(0);
  });

  test('the scraper’s OWN errors are not rewritten as AI errors', async ({ app, page }) => {
    test.setTimeout(90_000);
    // A page with almost no text: the tab's own "Content too short." must survive.
    await page.route('https://r.jina.ai/**', (route) => route.fulfill({
      // Over Jina's 100-char minimum, under the tab's 50-char one once whitespace collapses.
      status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: `Title: x${' \n'.repeat(120)}`,
    }));
    const models = await modelFails(page, 'no-quota');
    await yallaDown(page); // page-text route (the menu-data route has its own tests)
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.common.error}: Content too short.`)).toBeVisible({ timeout: 30_000 });
    expect(models).toHaveLength(0);
  });

  test('MENU DATA: items with sizes arrive as variant rows with their real prices; Jina is not needed', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await yallaFromFixture(page);
    const jina = await jinaFromFixture(page);
    const rows = [
      { Name: 'شاي أحمر', Category: 'المشروبات الساخنة', Price: 4, 'Option 1': 'الحجم', 'Option 1 Value': 'كوب', Type: 'Variable' },
      { Name: 'شاي أحمر', Category: 'المشروبات الساخنة', Price: 15, 'Option 1': 'الحجم', 'Option 1 Value': 'إبريق صغير', Type: 'Variable' },
      { Name: 'شاي أحمر', Category: 'المشروبات الساخنة', Price: 20, 'Option 1': 'الحجم', 'Option 1 Value': 'إبريق كبير', Type: 'Variable' },
    ];
    const calls = await modelAnswers(page, rows);
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.scraper.preview} (3)`)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Read the menu data: 8 items, 5 with options/)).toBeVisible();

    // The platform's JSON, with the branch from /branch/1/ in the URL.
    expect(asked.map((a) => a.path)).toEqual(expect.arrayContaining(['/api/categories/', '/api/items-light/', '/api/items/127/']));
    expect(asked.every((a) => a.branch === '1')).toBe(true);
    expect(jina.asked).toEqual([]);
    // What the page text never had: شاي أحمر's sizes and prices.
    const prompt = calls[0].body;
    for (const s of ['VARIANT شاي أحمر', 'إبريق صغير | Price: 15.00', 'إبريق كبير | Price: 20.00', 'مارجريتا', 'Option 1 Value: كبير | Price: 37.00']) {
      expect(prompt).toContain(s);
    }
    expect(prompt).toContain("fill 'Option 1' and 'Option 1 Value'");

    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: TRANSLATIONS.en.common.download, exact: true }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets['Scraped Data'])).toEqual(rows);
  });

  test('MENU DATA unreachable → falls back to the page text, and says so', async ({ app, page }) => {
    test.setTimeout(90_000);
    await yallaDown(page);
    const { asked } = await jinaFromFixture(page);
    const calls = await modelAnswers(page, ANSWER);
    await app.goto();
    await app.openToolMatching(/Web Scraper|كاشط الويب|استخراج الويب/);
    await page.getByPlaceholder('https://example.com/products').fill(SITE);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.scraper.preview} (4)`)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Could not read the menu data; using the page text instead/)).toBeVisible();
    expect(asked).toEqual([`https://r.jina.ai/${SITE}`]);
    expect(calls[0].body).toContain('سبانش لاتيه');
  });

  test('MENU DATA hangs → times out and falls back to the page text; the scrape does not hang', async ({ app, page }) => {
    test.setTimeout(90_000);
    // The menu API accepts the request and never answers.
    await page.route('https://kelah.yallaqrcodes.com/api/**', () => { /* never fulfilled */ });
    const { asked } = await jinaFromFixture(page);
    const calls = await modelAnswers(page, ANSWER);
    await app.goto();
    await app.openToolMatching(/Web Scraper|كاشط الويب|استخراج الويب/);
    await page.getByPlaceholder('https://example.com/products').fill(SITE);
    const started = Date.now();
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    await expect(page.getByText(/Could not read the menu data; using the page text instead/)).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText(`${TRANSLATIONS.en.scraper.preview} (4)`)).toBeVisible({ timeout: 30_000 });
    const waited = Date.now() - started;
    // Bounded by YALLA_REQUEST_TIMEOUT_MS (8 s) — not the 30 s whole-read cap, and not forever.
    expect(waited).toBeGreaterThanOrEqual(YALLA_REQUEST_TIMEOUT_MS - 500);
    expect(waited).toBeLessThan(YALLA_MENU_TIMEOUT_MS);
    expect(asked).toEqual([`https://r.jina.ai/${SITE}`]);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain('سبانش لاتيه'); // the page text reached the model
  });

  test('LIVE SITE (E2E_NETWORK=1): fetches the real menu and sends it to the model', async ({ app, page }) => {
    test.skip(process.env.E2E_NETWORK !== '1', 'network test — set E2E_NETWORK=1 to fetch the real site');
    test.setTimeout(180_000);
    const calls = await modelAnswers(page, ANSWER);
    // Nothing intercepted but the model: the REAL menu data, as users get it.
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.scraper.preview} (4)`)).toBeVisible({ timeout: 150_000 });
    expect(calls).toHaveLength(1);
    // Items from across the real menu — and the sizes the page text never showed.
    for (const s of ['شاي أخضر', 'سبانش لاتيه', 'بكج الحفلات', 'إبريق صغير | Price: 15.00', 'VARIANT مارجريتا']) {
      expect(calls[0].body).toContain(s);
    }
  });
});

test.describe('Translator — readable, localised batch failure', () => {
  function sheet(): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([['Item'], ['شاي أخضر'], ['سبانش لاتيه']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Menu');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  test('no quota on any model: the log and the PARTIAL workbook get one readable sentence', async ({ app, page }) => {
    test.setTimeout(90_000);
    const models = await modelFails(page, 'no-quota');
    await app.openToolMatching(/AI Translator/);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'menu.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: sheet(),
    });
    await page.getByRole('checkbox', { name: 'Item' }).check();
    const pending = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    const sentence = TRANSLATIONS.en.aiErrors['no-model'];
    await expect(page.getByText(`Batch failed, stopping here: ${sentence}`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(RAW)).toHaveCount(0);
    expect(models).toEqual([...MODEL_CANDIDATES.quality]);

    // The partial workbook says why it stopped, in the same readable words.
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    const cells = wb.SheetNames.flatMap((n) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1 }).flat());
    expect(cells.some((c) => String(c).includes(sentence))).toBe(true);
    expect(cells.some((c) => RAW.test(String(c)))).toBe(false);
  });
});
