/**
 * OCR → Rewaa in a real browser, on the product owner's own files
 * (tests/fixtures/ocr-rewaa/): the source spreadsheet is uploaded, the model
 * call is answered with `model-answer.json`, and the workbook that downloads BY
 * ITSELF is compared with the contract, `correct-output.xlsx`.
 *
 * The unit suite compares every cell; this checks the same workbook survives
 * the real tab — upload, prompt, post-processing, writer, download — plus the
 * browser-only parts: the automatic download, the ZIP button, and the paths
 * that must NOT download.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';

const fx = (name: string) => readFileSync(new URL(`../tests/fixtures/ocr-rewaa/${name}`, import.meta.url));
const SOURCE_NAME = 'kelah.yallaqrcodes.com_extract_1790703069069.xlsx';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ANSWER = JSON.parse(fx('model-answer.json').toString('utf8'));
const SHEETS = ['Generic All Data', 'Generic Simple', 'Generic Variable', 'Rewaa Simple Products', 'Rewaa Variable Products', 'Source Files & Audit'];

const candidate = (text: string) => ({
  candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text }] } }],
});

/** Answer text extraction with `answer`, or fail with 429 when `fail(body)` says so. */
async function interceptModel(page: Page, answer: unknown, fail: (body: string) => boolean = () => false): Promise<string[]> {
  const sent: string[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    const body = route.request().postData() ?? '';
    sent.push(body);
    if (fail(body)) {
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: {
        code: 429, message: 'You exceeded your current quota. limit: 0', status: 'RESOURCE_EXHAUSTED' } }) });
      return;
    }
    const payload = JSON.stringify(candidate(JSON.stringify(answer)));
    if (route.request().url().includes('streamGenerateContent')) {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: `data: ${payload}\r\n\r\n` });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: payload });
    }
  });
  return sent;
}

const ocrInput = (page: Page) => page.locator('input[type="file"][accept*=".docx"]');
const sourceFile = () => ({ name: SOURCE_NAME, mimeType: XLSX_MIME, buffer: fx('source.xlsx') });

async function openOcr(app: any, page: Page) {
  await app.goto();
  await app.openToolMatching(/OCR Extraction/);
  await expect(ocrInput(page)).toHaveCount(1);
}

type Grid = unknown[][];
const grid = (wb: XLSX.WorkBook, name: string): Grid =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true }) as Grid;
const column = (g: Grid, header: string) => g.slice(1).map((r) => r[g[0].indexOf(header)] ?? null);

/** Counts downloads from now on; `stop()` returns how many happened. */
function countDownloads(page: Page) {
  let n = 0;
  const on = () => { n++; };
  page.on('download', on);
  return { stop: () => { page.off('download', on); return n; } };
}

test.describe('OCR → Rewaa on the supplied source file', () => {
  test('downloads the contract workbook by itself, once; the ZIP holds the bundle and no key', async ({ app, page }) => {
    test.setTimeout(120_000);
    const sent = await interceptModel(page, ANSWER);
    await openOcr(app, page);
    await ocrInput(page).setInputFiles(sourceFile());

    const auto = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Start Extraction/i }).click();
    const download = await auto;
    const counter = countDownloads(page);

    // --- the source reached the model, inside the English-first prompt -------
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('أصابع الوافل');
    expect(sent[0]).toContain('English FIRST');

    // --- the automatic file -------------------------------------------------
    const name = download.suggestedFilename();
    expect(name).toMatch(/^OCR-Rewaa-kelah\.yallaqrcodes\.com_extract_1790703069069-\d{8}-\d{6}\.xlsx$/);
    const wb = XLSX.read(readFileSync((await download.path())!), { type: 'buffer' });
    const correct = XLSX.read(fx('correct-output.xlsx'), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(SHEETS);
    expect(wb.SheetNames).toEqual(correct.SheetNames);
    for (const s of SHEETS) {
      expect(grid(wb, s)[0], `${s} headers`).toEqual(grid(correct, s)[0]);
      expect(grid(wb, s).length, `${s} rows`).toBe(grid(correct, s).length);
    }
    // Every non-random value column of the main sheet, row for row.
    for (const h of ['Product Name', 'Category', 'Type', 'Enable stock management', 'Option 1 Name', 'Option 1 Value',
      'Source File', 'Retail Price', 'Variant Name', 'Same in Rewaa Simple', 'Same in Rewaa Variable', 'Rewaa Data Identical', 'Target Rewaa File']) {
      expect(column(grid(wb, 'Generic All Data'), h), h).toEqual(column(grid(correct, 'Generic All Data'), h));
    }
    expect(column(grid(wb, 'Rewaa Simple Products'), 'Retail Price')).toEqual(column(grid(correct, 'Rewaa Simple Products'), 'Retail Price'));
    expect(column(grid(wb, 'Rewaa Variable Products'), 'Variant Name')).toEqual(column(grid(correct, 'Rewaa Variable Products'), 'Variant Name'));
    // Approved deviation: the real option name, not the literal "Option 1".
    expect(column(grid(wb, 'Rewaa Variable Products'), 'Option 1')).toEqual(column(grid(correct, 'Generic Variable'), 'Option 1 Name'));
    expect(new Set(column(grid(wb, 'Generic All Data'), 'Enable stock management'))).toEqual(new Set(['no']));

    // --- the success state ----------------------------------------------------
    const panel = page.getByTestId('ocr-rewaa-result');
    await expect(panel).toContainText('OCR complete');
    await expect(panel).toContainText(`Rewaa file generated: ${name}`);
    await expect(panel).toContainText('File downloaded automatically');
    await expect(panel).toContainText('5 row(s) differ');
    await page.waitForTimeout(1_500);
    expect(counter.stop(), 'the run downloaded more than once').toBe(0);

    // --- the ZIP ----------------------------------------------------------------
    const pendingZip = page.waitForEvent('download', { timeout: 30_000 });
    await panel.getByRole('button', { name: 'Download ZIP' }).click();
    const zipDownload = await pendingZip;
    expect(zipDownload.suggestedFilename()).toBe(name.replace(/\.xlsx$/, '.zip'));
    const zipBytes = readFileSync((await zipDownload.path())!);
    const zip = await JSZip.loadAsync(zipBytes);
    const entries = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(entries).toEqual([name, `source/${SOURCE_NAME}`, 'summary.json'].sort());
    // The original file, byte for byte; the workbook, the same file as the automatic download.
    expect(Buffer.from(await zip.file(`source/${SOURCE_NAME}`)!.async('uint8array')).equals(fx('source.xlsx'))).toBe(true);
    const inZip = XLSX.read(await zip.file(name)!.async('uint8array'), { type: 'array' });
    for (const s of SHEETS) expect(grid(inZip, s)).toEqual(grid(wb, s));
    const summary = JSON.parse(await zip.file('summary.json')!.async('string'));
    expect(summary.counts).toEqual({ total: 180, simple: 115, variable: 65, notIdentical: 5, missingPrice: 5 });
    // No credential in any entry: the seeded key, its storage name, or a Google key shape.
    const everything = [zipBytes.toString('latin1'), ...(await Promise.all(entries.map((e) => zip.file(e)!.async('string'))))].join('\n');
    expect(everything).not.toContain('e2e-placeholder-key');
    expect(everything).not.toContain('gemini_api_key');
    expect(everything).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);

    // --- Download Excel gives the same file again, on request ------------------
    const again = page.waitForEvent('download', { timeout: 30_000 });
    await panel.getByRole('button', { name: 'Download Excel' }).click();
    expect((await again).suggestedFilename()).toBe(name);
  });

  test('a failed OCR downloads nothing and shows no success', async ({ app, page }) => {
    test.setTimeout(60_000);
    await interceptModel(page, ANSWER, () => true);
    await openOcr(app, page);
    await ocrInput(page).setInputFiles(sourceFile());
    const counter = countDownloads(page);
    await page.getByRole('button', { name: /Start Extraction/i }).click();
    await page.getByRole('button', { name: /Show Logs/i }).click();
    await expect(page.getByText(/No data extracted/)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    expect(counter.stop(), 'a failed run downloaded a file').toBe(0);
    await expect(page.getByTestId('ocr-rewaa-result')).toHaveCount(0);
  });

  test('a partial failure is held: no automatic download, buttons still work', async ({ app, page }) => {
    test.setTimeout(120_000);
    // The second file's content marks it for failure.
    const broken = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(broken, XLSX.utils.aoa_to_sheet([['Name'], ['BROKEN-FILE']]), 'S');
    await interceptModel(page, ANSWER, (body) => body.includes('BROKEN-FILE'));
    await openOcr(app, page);
    await ocrInput(page).setInputFiles([
      sourceFile(),
      { name: 'broken.xlsx', mimeType: XLSX_MIME, buffer: Buffer.from(XLSX.write(broken, { type: 'buffer', bookType: 'xlsx' })) },
    ]);
    const counter = countDownloads(page);
    await page.getByRole('button', { name: /Start Extraction/i }).click();
    const panel = page.getByTestId('ocr-rewaa-result');
    await expect(panel).toContainText('OCR finished with errors', { timeout: 60_000 });
    await expect(panel).toContainText('1 of 2 file(s) failed');
    await page.waitForTimeout(1_500);
    expect(counter.stop(), 'a partly failed run downloaded by itself').toBe(0);

    const pending = page.waitForEvent('download', { timeout: 30_000 });
    await panel.getByRole('button', { name: 'Download Excel' }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    const audit = grid(wb, 'Source Files & Audit');
    expect(audit.slice(1).map((r) => [r[1], r[6]])).toEqual([[SOURCE_NAME, 'Extracted'], ['broken.xlsx', 'Failed']]);
  });

  test('a non-Rewaa extraction (Invoice) is unchanged: no automatic download, plain export', async ({ app, page }) => {
    test.setTimeout(120_000);
    await interceptModel(page, [{ Item: 'Paper', Qty: 2, Price: 5 }]);
    await openOcr(app, page);
    await ocrInput(page).setInputFiles(sourceFile());
    await page.getByRole('button', { name: /Invoice/i }).click();
    const counter = countDownloads(page);
    await page.getByRole('button', { name: /Start Extraction/i }).click();
    await page.getByRole('button', { name: /Show Logs/i }).click();
    await expect(page.getByText('Click Export to download the results.')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    expect(counter.stop(), 'a non-Rewaa run downloaded by itself').toBe(0);
    await expect(page.getByTestId('ocr-rewaa-result')).toHaveCount(0);

    const pending = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['All Extracted Data', 'Simple Products']);
  });
});
