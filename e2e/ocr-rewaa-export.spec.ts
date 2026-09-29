/**
 * OCR Extraction into the REAL Rewaa templates, in a browser, with the model
 * call intercepted. The model's answer is the shape the live run of 2026-09-29
 * returned for the salon price list (ocr-result.xlsx), which exposed:
 *
 *   - Variable sheet with blank Option 1 / Option 1 Value / Variant Name: the
 *     mapping panel only knew the FIRST row's columns, and the first row was a
 *     simple item.
 *   - `الطويل 600–900` split into two Long rows (600 and 900) with an invented
 *     `Range | المدى` option — the rule is ONE row, Price 0, range in Description.
 *   - Raw JSON-in-JSON provider errors shown to the user.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../utils/translations';

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

const DYE = 'صبغات شعر لون واحد | Hair color single tone';
const TWO_TONE = 'صبغات شعر لونين ارضية وتخصيل | Two-tone hair color background and highlights';
const COLOR = 'قسم الصبغات | Hair Coloring Section';

const variant = (name: string, value: string, price: unknown, extra: Record<string, unknown> = {}) => ({
  'Variant SKU': '', Category: COLOR, 'Product Name': name, Description: '', 'Retail Price': price,
  Type: 'Variable', 'Enable stock management': 'no', 'Option 1': 'Size | الحجم', 'Option 1 Value': value, ...extra,
});

/** First rows SIMPLE, variant columns only later — the order the live run had. */
const ANSWER = [
  { 'Variant SKU': '', Category: 'قسم الإستشوار | Blow-dry Section', 'Product Name': 'استشوار شعر قصير | Short hair blow-dry',
    Description: '', 'Retail Price': 50, Type: 'Simple', 'Enable stock management': 'no', 'Product SKU': '00123' },
  { 'Variant SKU': '', Category: 'قسم المساج | Massage Section', 'Product Name': 'مساج إسترخاء | Relaxing massage',
    Description: '', 'Retail Price': 140, Type: 'Simple', 'Enable stock management': 'no', 'Product SKU': '123' },
  { 'Variant SKU': '', Category: 'قسم البشرة | Skin Section', 'Product Name': 'تنظيف بشرة | Facial cleaning',
    Description: '', 'Retail Price': `50${EM_DASH}100`, Type: 'Simple', 'Enable stock management': 'no' },
  variant(DYE, 'Short | القصير', 400, { 'Variant SKU': '00456' }),
  variant(DYE, 'Medium | الوسط', 500),
  // The split the old prompt asked for, exactly as the model produced it.
  variant(DYE, 'Long | الطويل', 600, { 'Option 2': 'Range | المدى', 'Option 2 Value': 'Small | صغير' }),
  variant(DYE, 'Long | الطويل', 900, { 'Option 2': 'Range | المدى', 'Option 2 Value': 'Large | كبير' }),
  variant(TWO_TONE, 'Short | القصير', 650),
  variant(TWO_TONE, 'Medium | الوسط', 800),
  // The rule the new prompt asks for: the range text as written, Arabic around it.
  variant(TWO_TONE, 'Long | الطويل', `من 1000 ${EN_DASH} 1500 ريال`),
];

/** A 1x1 PNG: the image content is irrelevant, the model call is intercepted. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const candidate = (text: string) => ({
  candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text }] } }],
});

/** Answer image extraction (streamed, SSE) and text extraction (plain JSON). */
async function interceptModel(page: Page, answer: unknown): Promise<string[]> {
  const models: string[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    const url = route.request().url();
    models.push(/models\/([^:]+):/.exec(url)?.[1] ?? '?');
    const text = JSON.stringify(answer);
    if (url.includes('streamGenerateContent')) {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: `data: ${JSON.stringify(candidate(text))}\r\n\r\n` });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(candidate(text)) });
    }
  });
  return models;
}

/** Every model call fails the way the free-tier key's Pro calls did. */
async function interceptNoQuota(page: Page): Promise<string[]> {
  const models: string[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    const model = /models\/([^:]+):/.exec(route.request().url())?.[1] ?? '?';
    models.push(model);
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: {
        code: 429,
        message: `You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: ${model}`,
        status: 'RESOURCE_EXHAUSTED',
      } }),
    });
  });
  return models;
}

const ocrInput = (page: Page) => page.locator('input[type="file"][accept*=".docx"]');
const templateInput = (page: Page) => page.locator('input[type="file"][accept=".xlsx,.xls,.csv"]');
const fixture = (name: string) => readFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url));

async function openOcrWithImage(app: any, page: Page) {
  await app.goto();
  await app.openToolMatching(/OCR Extraction/);
  await ocrInput(page).setInputFiles({ name: 'price-list.png', mimeType: 'image/png', buffer: PNG });
}

type Sheet = Record<string, unknown>[];
const sheet = (wb: XLSX.WorkBook, name: string): Sheet => {
  expect(wb.SheetNames, `sheet "${name}" missing`).toContain(name);
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) as Sheet;
};

test.describe('OCR Extraction — Rewaa export on real-run data', () => {
  test('variant columns map, a range is ONE row at Price 0, leading zeros survive', async ({ app, page }) => {
    test.setTimeout(120_000);
    const models = await interceptModel(page, ANSWER);
    await openOcrWithImage(app, page);

    let unsolicited = 0;
    const count = () => { unsolicited++; };
    page.on('download', count);
    await page.getByRole('button', { name: /Start Extraction/i }).click();
    await page.getByRole('button', { name: /Show Logs/i }).click();
    await expect(page.getByText('Click Export to download the results.')).toBeVisible({ timeout: 60_000 });
    // 2 written as ranges + 1 split pair merged back = 3 ranges.
    await expect(page.getByText(/3 price range\(s\) kept as one row each/)).toBeVisible();
    await expect(page.getByText(/1 duplicate variant row\(s\) from a split price range merged back/)).toBeVisible();

    // The REAL Rewaa templates, through the mapping panel — after extraction,
    // as a user would, so auto-mapping sees every extracted column.
    await templateInput(page).setInputFiles({ name: 'rewaa-simple-template.csv', mimeType: 'text/csv', buffer: fixture('rewaa-simple-template.csv') });
    await expect(page.getByText('Loaded Simple Template: rewaa-simple-template.csv')).toBeVisible();
    await page.getByRole('button', { name: 'Variable Template', exact: true }).click();
    await templateInput(page).setInputFiles({ name: 'rewaa-variable-template.csv', mimeType: 'text/csv', buffer: fixture('rewaa-variable-template.csv') });
    await expect(page.getByText('Loaded Variable Template: rewaa-variable-template.csv')).toBeVisible();

    await page.waitForTimeout(1_000); // D9: still nothing downloaded on its own
    page.off('download', count);
    expect(unsolicited, 'a download started without the user clicking Export').toBe(0);

    const pending = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    expect(models).toHaveLength(1); // one model call; mapping and export are local

    // --- Mapped Variable -----------------------------------------------------
    const v = sheet(wb, 'Mapped Variable');
    expect(v.map((r) => [r['Product Name'], r['Option 1 Value'], r['Retail Price']])).toEqual([
      [DYE, 'Short | القصير', 400],
      [DYE, 'Medium | الوسط', 500],
      [DYE, 'Long | الطويل', 0],          // ONE Long row, not 600 and 900
      [TWO_TONE, 'Short | القصير', 650],
      [TWO_TONE, 'Medium | الوسط', 800],
      [TWO_TONE, 'Long | الطويل', 0],
    ]);
    expect(v.every((r) => r['Option 1'] === 'Size | الحجم')).toBe(true);
    expect(v.every((r) => String(r['Variant Name']).trim() !== ''), 'Variant Name left blank').toBe(true);
    expect(v[2].Description).toBe('Price range: 600 to 900');
    expect(v[5].Description).toBe('Price range: 1000 to 1500');
    expect(v[2]['Option 2']).toBe('');      // the invented Range dimension is gone
    expect(v[2]['Option 2 Value']).toBe('');
    expect(v[0].Description).toBe('');     // a normal price gets no range text
    expect(v[0]['Variant SKU']).toBe('00456');
    expect(v.every((r) => r['Enable stock management'] === 'no')).toBe(true); // approved rule, unchanged

    // --- Mapped Simple -------------------------------------------------------
    const s = sheet(wb, 'Mapped Simple');
    expect(s.map((r) => [r['Product SKU'], r['Retail Price']])).toEqual([
      ['00123', 50], ['123', 140], [expect.stringMatching(/^GEN-/), 0],
    ]);
    expect(s[2].Description).toBe('Price range: 50 to 100');
    expect(s[0]['Product SKU']).not.toBe(s[1]['Product SKU']); // 00123 is not 123

    // --- All Extracted Data --------------------------------------------------
    const all = sheet(wb, 'All Extracted Data');
    expect(all).toHaveLength(9); // 10 extracted, one split duplicate merged back
    expect(all.filter((r) => r['Product Name'] === DYE && r['Option 1 Value'] === 'Long | الطويل')).toHaveLength(1);
    expect(all.every((r) => r['In Rewaa Simple'] === true || r['In Rewaa Variable'] === true),
      'a row did not arrive intact in its Rewaa sheet').toBe(true);
  });

  test('English: a provider failure is ONE readable sentence, no raw JSON', async ({ app, page }) => {
    test.setTimeout(60_000);
    const models = await interceptNoQuota(page);
    await openOcrWithImage(app, page);
    await page.getByRole('button', { name: /Start Extraction/i }).click();
    await page.getByRole('button', { name: /Show Logs/i }).click();
    await expect(page.getByText(
      `${TRANSLATIONS.en.aiErrors.fileFailed.replace('{file}', 'price-list.png')} ${TRANSLATIONS.en.aiErrors['no-model']}`,
    )).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/RESOURCE_EXHAUSTED|"error"|\{"|googleapis/)).toHaveCount(0);
    // Each candidate tried ONCE, then it stopped: no retry storm on a model with no quota.
    expect(new Set(models).size).toBe(models.length);
  });

  test('Arabic: the same failure in Arabic', async ({ app, page }) => {
    test.setTimeout(60_000);
    await interceptNoQuota(page);
    await openOcrWithImage(app, page);
    await app.toggleLanguage();
    const ar = TRANSLATIONS.ar;
    await page.getByRole('button', { name: ar.ocr.extractBtn }).click();
    await page.getByRole('button', { name: ar.actions.showLogs }).click();
    await expect(page.getByText(`${ar.aiErrors.fileFailed.replace('{file}', 'price-list.png')} ${ar.aiErrors['no-model']}`))
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/RESOURCE_EXHAUSTED|"error"|\{"|googleapis/)).toHaveCount(0);
  });
});
