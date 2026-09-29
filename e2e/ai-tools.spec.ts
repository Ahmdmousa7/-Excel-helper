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
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await page.getByRole('button', { name: TRANSLATIONS.en.actions.showLogs }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.common.error}: Content too short.`)).toBeVisible({ timeout: 30_000 });
    expect(models).toHaveLength(0);
  });

  test('LIVE SITE (E2E_NETWORK=1): fetches the real menu and sends it to the model', async ({ app, page }) => {
    test.skip(process.env.E2E_NETWORK !== '1', 'network test — set E2E_NETWORK=1 to fetch the real site');
    test.setTimeout(180_000);
    const calls = await modelAnswers(page, ANSWER);
    await openScraper(app, page);
    await page.getByRole('button', { name: TRANSLATIONS.en.common.start }).click();
    await expect(page.getByText(`${TRANSLATIONS.en.scraper.preview} (4)`)).toBeVisible({ timeout: 150_000 });
    expect(calls).toHaveLength(1);
    // Items from across the real page — the first section, the middle, the last.
    for (const s of ['شاي أخضر', 'سبانش لاتيه', 'بكج الحفلات']) expect(calls[0].body).toContain(s);
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
