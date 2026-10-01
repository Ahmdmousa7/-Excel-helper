/**
 * Web Scraper on a Fresha booking link, in a real browser, fully offline:
 * r.jina.ai is answered from tests/fixtures/fresha/ and every model call is
 * intercepted. Covers the structured venue-data path (utils/freshaVenue.ts),
 * the `Not on venue page` note, and the fallback to the existing page-text
 * route when the venue data is unavailable.
 */
import { test, expect, AppShell } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../utils/translations';
import { FRESHA_COLUMNS, BOOKING_ONLY_NOTE, STARTING_PRICE_NOTE } from '../utils/freshaVenue';

const fx = (n: string) => readFileSync(new URL(`../tests/fixtures/fresha/${n}`, import.meta.url), 'utf-8');
const VENUE_HTML = fx('little-palm-spa-venue.html');
const BOOKING_ONLY = JSON.parse(fx('booking-only-addons.example.json')).services as { name: string }[];
const BOOKING = 'https://www.fresha.com/en-GB/a/little-palm-spa-lytl-blm-sb-llkhdm-lmnzly-eastern-province-home-service-khdm-mnzly-f4pn5kmx/booking?pId=1000001&cartId=00000000-0000-4000-8000-000000000000';
const VENUE = 'https://www.fresha.com/en-GB/a/little-palm-spa-lytl-blm-sb-llkhdm-lmnzly-eastern-province-home-service-khdm-mnzly-f4pn5kmx';
const en = TRANSLATIONS.en;

/** The booking page as Jina's markdown shows it: the first category only. */
const BOOKING_MARKDOWN = [
  'Title: Make an appointment at Little Palm Spa | Fresha', '', '# Select services', '',
  '### بوتكس الشعر | Botox treatment', '3 hours', 'from SAR 575', '',
  '### الكولاجين | Collgen', '3 hours', 'from SAR 575', '',
].join('\n');
const FALLBACK_ANSWER = [
  { Name: 'بوتكس الشعر | Botox treatment', Category: 'Hair treatment', Price: '575' },
  { Name: 'الكولاجين | Collgen', Category: 'Hair treatment', Price: '575' },
];

/** Jina: HTML mode → the venue page (`html`), markdown mode → the booking text. */
async function jina(page: Page, html: string) {
  const asked: { url: string; format?: string }[] = [];
  await page.route('https://r.jina.ai/**', async (route) => {
    const format = route.request().headers()['x-return-format'];
    asked.push({ url: route.request().url(), format });
    await route.fulfill({
      status: 200, contentType: 'text/plain; charset=utf-8', headers: { 'access-control-allow-origin': '*' },
      body: format === 'html' ? html : BOOKING_MARKDOWN,
    });
  });
  return asked;
}

async function models(page: Page, answer: unknown) {
  const calls: string[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    calls.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(answer) }] } }],
    }) });
  });
  return calls;
}

/** Nothing may reach Fresha itself — least of all its protected booking API. */
async function noFresha(page: Page) {
  const hits: string[] = [];
  // Anchored: unanchored, it also matched `https://r.jina.ai/https://www.fresha.com/…`.
  await page.route(/^https:\/\/(www\.)?fresha\.com\//, async (route) => { hits.push(route.request().url()); await route.abort('blockedbyclient'); });
  return hits;
}

async function scrape(app: AppShell, page: Page) {
  await app.goto();
  await app.openToolMatching(/Web Scraper|كاشط الويب|استخراج الويب/);
  await page.getByPlaceholder('https://example.com/products').fill(BOOKING);
  await page.getByRole('button', { name: en.common.start }).click();
}

async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: en.common.download, exact: true }).click();
  return XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
}

test.describe('Web Scraper — Fresha venue data', () => {
  test('a booking link is read from the public venue page: 67 services, no model call', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await jina(page, VENUE_HTML);
    const calls = await models(page, FALLBACK_ANSWER);
    const fresha = await noFresha(page);
    await scrape(app, page);
    await expect(page.getByText(`${en.scraper.preview} (67)`)).toBeVisible({ timeout: 60_000 });

    // The venue page, in HTML mode — not the booking link, not Fresha directly.
    expect(asked).toEqual([{ url: `https://r.jina.ai/${VENUE}`, format: 'html' }]);
    expect(fresha).toEqual([]);
    expect(calls).toHaveLength(0); // structured data: no model reads prices off text
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/Read Fresha's venue data .*67 services in 9 categories, 10 with a starting price/)).toBeVisible();
    await expect(page.getByText(/booking flow \(add-ons\) are not on the venue page and cannot be read/)).toBeVisible();

    const wb = await download(page);
    expect(wb.SheetNames).toEqual(['Scraped Data', 'Not on venue page']);
    const grid = XLSX.utils.sheet_to_json(wb.Sheets['Scraped Data'], { header: 1, defval: '' }) as string[][];
    expect(grid[0]).toEqual([...FRESHA_COLUMNS]);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Scraped Data'], { defval: '' }) as Record<string, string>[];
    expect(rows).toHaveLength(67);
    expect(new Set(rows.map((r) => r.Category)).size).toBe(9);
    expect(rows.find((r) => r.Name === 'بوتكس الشعر | Botox treatment')).toMatchObject({
      Category: 'معالجات الشعر | Hair treatment', Price: '575.00', Type: 'Simple', Duration: '3 hours', 'Price Note': STARTING_PRICE_NOTE,
    });
    expect(rows.find((r) => r.Name === 'مساج سويدي | Swedish Massage')).toMatchObject({
      Category: 'خدمات المساج | Massage services', Price: '200.00', Duration: '1 hour', 'Price Note': '',
    });
    expect(rows.filter((r) => r['Price Note'] === STARTING_PRICE_NOTE)).toHaveLength(10);

    // Booking-only add-ons: a note, no invented services.
    const note = XLSX.utils.sheet_to_json(wb.Sheets['Not on venue page'], { header: 1, defval: '' }) as string[][];
    expect(note).toEqual([['Note'], ...BOOKING_ONLY_NOTE.map((l) => [l])]);
    const everything = JSON.stringify(rows) + JSON.stringify(note);
    for (const s of BOOKING_ONLY) expect(everything).not.toContain(s.name.split(' | ')[1].trim());
  });

  test('venue data unavailable: falls back to the existing page-text route, without the note sheet', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked = await jina(page, '<html><body><h1>Select services</h1></body></html>');
    const calls = await models(page, FALLBACK_ANSWER);
    await noFresha(page);
    await scrape(app, page);
    await expect(page.getByText(`${en.scraper.preview} (2)`)).toBeVisible({ timeout: 60_000 });

    // Venue page first; then the original link as markdown, exactly as before.
    expect(asked).toEqual([
      { url: `https://r.jina.ai/${VENUE}`, format: 'html' },
      { url: `https://r.jina.ai/${BOOKING}`, format: 'markdown' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Botox treatment');
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText("Could not read Fresha's venue data; using the page text instead", { exact: false })).toBeVisible();

    const wb = await download(page);
    expect(wb.SheetNames).toEqual(['Scraped Data']);
    expect(XLSX.utils.sheet_to_json(wb.Sheets['Scraped Data'])).toEqual(FALLBACK_ANSWER);
  });

  test('the log counts starting prices per service, not per option row', async ({ app, page }) => {
    test.setTimeout(90_000);
    // One service, three differently named "from" options.
    const venue = { props: { pageProps: { data: { location: { name: 'Test venue', services: [{ id: 1, name: 'Hair', items: [{
      name: 'Hair colour', caption: '2 hours', formattedRetailPrice: 'from SAR 200', retailPrice: { currency: 'SAR', value: 200 },
      variants: [
        { id: '1', name: 'Short', caption: '1 hour', formattedRetailPrice: 'from SAR 200' },
        { id: '2', name: 'Medium', caption: '1 hour 30 mins', formattedRetailPrice: 'from SAR 300' },
        { id: '3', name: 'Long', caption: '2 hours', formattedRetailPrice: 'from SAR 400' },
      ],
    }] }] } } } } };
    await jina(page, `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(venue)}</script>`);
    await models(page, FALLBACK_ANSWER);
    await noFresha(page);
    await scrape(app, page);
    await expect(page.getByText(`${en.scraper.preview} (3)`)).toBeVisible({ timeout: 60_000 }); // 3 option rows
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    // Before: "…, 3 with a starting price, 1 with options".
    await expect(page.getByText(/1 services in 1 categories, 1 with a starting price, 1 with options/)).toBeVisible();
  });

  test('a non-Fresha link never takes the Fresha route', async ({ app, page }) => {
    test.setTimeout(90_000);
    const asked: string[] = [];
    await page.route('https://r.jina.ai/**', async (route) => {
      asked.push(`${route.request().headers()['x-return-format']} ${route.request().url()}`);
      await route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: BOOKING_MARKDOWN });
    });
    await models(page, FALLBACK_ANSWER);
    await app.goto();
    await app.openToolMatching(/Web Scraper|كاشط الويب|استخراج الويب/);
    await page.getByPlaceholder('https://example.com/products').fill('https://example.com/menu');
    await page.getByRole('button', { name: en.common.start }).click();
    await expect(page.getByText(`${en.scraper.preview} (2)`)).toBeVisible({ timeout: 60_000 });
    expect(asked).toEqual(['markdown https://r.jina.ai/https://example.com/menu']);
    const wb = await download(page);
    expect(wb.SheetNames).toEqual(['Scraped Data']);
  });
});
