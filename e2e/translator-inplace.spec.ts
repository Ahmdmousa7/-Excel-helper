/**
 * AI Translator, In-Place Update, on the product owner's real reproduction file
 * (tests/fixtures/translator/translate-real.xlsx) with the settings of the
 * report: first column, Auto ⇄, separator |, In-Place Update. Every model call
 * is answered by a deterministic mock.
 *
 * The bug: the download was a new workbook whose FIRST sheet was an untouched
 * "Original File" copy, so a finished translation looked like nothing had
 * happened. The output is now the user's own workbook with the column changed.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../utils/translations';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const REAL = readFileSync(new URL('../tests/fixtures/translator/translate-real.xlsx', import.meta.url));
const en = TRANSLATIONS.en;
const ARABIC = /[؀-ۿ]/;

/** The mock model: Arabic → `EN:…`, anything else → `AR:…`, each `|` segment on its own. */
const mockTranslate = (text: string) =>
  text.split('|').map((s) => `${ARABIC.test(s) ? 'EN' : 'AR'}:${s.trim()}`).join(' | ');

/** Answer every translation call; record the prompt and the items sent. */
async function model(page: Page, mode: 'ok' | 'fail' = 'ok') {
  const calls: { prompt: string; items: { text: string }[] }[] = [];
  await page.route(/[gG]enerateContent/, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const prompt: string = body.contents?.[0]?.parts?.[0]?.text ?? '';
    const items = JSON.parse(/Items:\s*(\[[\s\S]*?\])\s*\n\s*Return ONLY/.exec(prompt)?.[1] ?? '[]');
    calls.push({ prompt, items });
    if (mode === 'fail') {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }) });
      return;
    }
    const answer = items.map((it: { text: string }) => mockTranslate(it.text));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(answer) }] } }] }) });
  });
  return calls;
}

/** Load a file, pick the column, the direction, | and In-Place Update, run; the download. */
async function translate(app: { openToolMatching(r: RegExp): Promise<void> }, page: Page, buffer: Buffer, name: string, column: string, direction = 'Auto ⇄', sheet?: string) {
  await app.openToolMatching(/AI Translator/);
  await page.locator('input[type="file"]').first().setInputFiles({ name, mimeType: XLSX_TYPE, buffer });
  if (sheet) await page.locator('select').first().selectOption(sheet);
  await page.getByRole('checkbox', { name: column, exact: true }).check();
  await page.getByRole('button', { name: direction }).click();
  await page.getByRole('button', { name: '|', exact: true }).click();
  await page.getByRole('button', { name: 'In-Place Update' }).click();
  const pending = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: en.common.start }).click();
  const d = await pending;
  const bytes = readFileSync((await d.path())!);
  return { file: d.suggestedFilename(), bytes, wb: XLSX.read(bytes, { type: 'buffer' }) };
}

const grid = (wb: XLSX.WorkBook, name: string, raw = true) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw }) as unknown[][];

test.describe('AI Translator — In-Place Update writes the translation into the file', () => {
  test('the real file, first column, Auto ⇄, |, In-Place: column A changes; everything else is the user\'s file', async ({ app, page }) => {
    test.setTimeout(120_000);
    const calls = await model(page);
    const source = XLSX.read(REAL, { type: 'buffer' });
    const src = grid(source, 'rewaa-import-simple');
    const { file, bytes, wb } = await translate(app, page, REAL, 'Translate (2).xlsx', 'Product Name');

    // The user's own workbook: their sheet first, by its name; the summary after it.
    expect(file).toBe('Translated_Translate (2).xlsx');
    expect(wb.SheetNames).toEqual(['rewaa-import-simple', 'Translation Summary']);
    const out = grid(wb, 'rewaa-import-simple');
    expect(out).toHaveLength(src.length);                  // 21 rows: header + 20
    expect(out[0]).toEqual(src[0]);                        // header untouched
    for (let r = 1; r < src.length; r++) {
      const before = String(src[r][0]);
      // Bilingual in place: "<Arabic> | <English>" — the cell CHANGED.
      expect(out[r][0]).toBe(`${before} | EN:${before}`);
      expect(out[r][0]).not.toBe(before);
      // Every other column exactly as the user had it, numbers still numbers.
      expect(out[r].slice(1)).toEqual(src[r].slice(1));
    }
    expect(wb.Sheets['rewaa-import-simple'].N2).toMatchObject({ t: 'n', v: 40 });
    expect(Buffer.compare(bytes, REAL)).not.toBe(0);

    // Auto ⇄ went to the model as "detect, then translate to the other language"; all 20 sent once.
    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).toContain('If the text is primarily Arabic, translate it entirely to English');
    expect(calls[0].items.map((i) => i.text)).toEqual(src.slice(1).map((r) => String(r[0])));
    const summary = grid(wb, 'Translation Summary');
    expect(summary[0]).toEqual(['Row', 'Source Text', 'Translated Text', 'Status']);
    expect(summary.slice(1).every((r) => r[3] === 'Translated')).toBe(true);
    expect(summary).toHaveLength(21);
  });

  test('Auto ⇄ both ways, blanks, a cell already bilingual, and | segments inside a cell', async ({ app, page }) => {
    test.setTimeout(120_000);
    const calls = await model(page);
    const wb0 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([
      ['Name', 'Code', 'Price'],
      ['Grilled chicken', 'A1', 40],                         // English → Arabic
      ['حبة شواية', 'A2', 21],                               // Arabic → English
      ['', 'A3', 5],                                          // blank: stays blank, never sent
      ['Green tea | Black tea', 'A4', 7],                     // segments separated by |
      ['حبة شواية | Whole grilled chicken', 'A5', 9],         // already bilingual: left as is
    ]), 'Menu');
    const { wb } = await translate(app, page, Buffer.from(XLSX.write(wb0, { type: 'buffer', bookType: 'xlsx' })), 'menu.xlsx', 'Name');
    const out = grid(wb, 'Menu');
    expect(out.map((r) => r[0])).toEqual([
      'Name',
      'Grilled chicken | AR:Grilled chicken',
      'حبة شواية | EN:حبة شواية',
      '',
      // The source segments are kept as written, in order; the translation follows, segment for segment.
      'Green tea | Black tea | AR:Green tea | AR:Black tea',
      'حبة شواية | Whole grilled chicken',
    ]);
    expect(out.map((r) => r.slice(1))).toEqual([['Code', 'Price'], ['A1', 40], ['A2', 21], ['A3', 5], ['A4', 7], ['A5', 9]]);
    // Sent: the three that needed it — no blank, no already-bilingual cell.
    expect(calls[0].items.map((i) => i.text)).toEqual(['Grilled chicken', 'حبة شواية', 'Green tea | Black tea']);
  });

  test('a chosen direction is still sent as chosen (En → Ar)', async ({ app, page }) => {
    test.setTimeout(120_000);
    const calls = await model(page);
    await translate(app, page, REAL, 'Translate (2).xlsx', 'Product Name', 'En → Ar');
    expect(calls[0].prompt).toContain('Translate the following items from en to ar.');
  });

  test('another sheet: only it changes; every sheet keeps its place and name', async ({ app, page }) => {
    test.setTimeout(120_000);
    await model(page);
    const wb0 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([['Read me'], ['first sheet']]), 'Notes');
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([['Name', 'Price'], ['شاي', 3]]), 'Menu');
    const { wb } = await translate(app, page, Buffer.from(XLSX.write(wb0, { type: 'buffer', bookType: 'xlsx' })), 'two.xlsx', 'Name', 'Auto ⇄', 'Menu');
    expect(wb.SheetNames).toEqual(['Notes', 'Menu', 'Translation Summary']);
    expect(grid(wb, 'Notes')).toEqual([['Read me'], ['first sheet']]);
    expect(grid(wb, 'Menu')).toEqual([['Name', 'Price'], ['شاي | EN:شاي', 3]]);
  });

  test('New Column pointed at a column with data: nothing is lost — previous values are listed in the summary', async ({ app, page }) => {
    test.setTimeout(120_000);
    await model(page);
    await app.openToolMatching(/AI Translator/);
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'Translate (2).xlsx', mimeType: XLSX_TYPE, buffer: REAL });
    await page.getByRole('checkbox', { name: 'Product Name', exact: true }).check();
    // New Column mode writes column A's translation to column B by default — Product SKU here.
    await page.getByRole('button', { name: /New Column/ }).click();
    const pending = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: en.common.start }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    const src = grid(XLSX.read(REAL, { type: 'buffer' }), 'rewaa-import-simple');
    expect(grid(wb, 'rewaa-import-simple')[1].slice(0, 2)).toEqual([src[1][0], `EN:${src[1][0]}`]);
    const summary = grid(wb, 'Translation Summary');
    const at = summary.findIndex((r) => String(r[0]).startsWith('*** EXISTING CELLS REPLACED'));
    expect(at).toBeGreaterThan(0);
    expect(summary[at + 1]).toEqual(['Cell', 'Column', 'Previous Value', 'Written Value']);
    // The existing header is kept (New Column only names an empty one), so B2..B21 are listed.
    expect(summary[at + 2]).toEqual(['B2', 'Product SKU', 'A1', `EN:${src[1][0]}`]);
    expect(summary.slice(at + 2).map((r) => r[2])).toEqual(src.slice(1).map((r) => r[1]));   // A1 … A20
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/20 existing cell\(s\) outside the selected columns were replaced by the output column: B \("Product SKU"\)/)).toBeVisible();
  });

  test('a failed model call: a PARTIAL_ file with the column unchanged, a banner and a clear error — never a "Translated_" file', async ({ app, page }) => {
    test.setTimeout(120_000);
    await model(page, 'fail');
    const src = grid(XLSX.read(REAL, { type: 'buffer' }), 'rewaa-import-simple');
    const { file, wb } = await translate(app, page, REAL, 'Translate (2).xlsx', 'Product Name');
    expect(file).toBe('PARTIAL_Translated_Translate (2).xlsx');
    // Nothing half-written: the sheet is exactly the user's.
    expect(grid(wb, 'rewaa-import-simple')).toEqual(src);
    const summary = grid(wb, 'Translation Summary');
    expect(summary[0][0]).toBe('*** PARTIAL TRANSLATION — THIS FILE IS NOT COMPLETE ***');
    expect(summary[1][0]).toBe('Translated 0 of 20 items that needed translation.');
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    await expect(page.getByText(/Batch failed, stopping here: The AI API key was rejected/)).toBeVisible();
  });
});

/**
 * Every model of the key busy at once (production, 2026-10-06): no quota for the
 * Pro ids on this key, and every Flash id answering 503 "high demand". The run
 * now waits 15s / 30s / 60s and tries the list again before giving up. The
 * browser's clock is fast-forwarded, so the waits cost no real time.
 */
test.describe('AI Translator — all models overloaded: bounded wait-and-retry', () => {
  const PRO = /pro/;
  const busy = (busyFlashCalls: number) => async (page: Page) => {
    const calls: string[] = [];
    let flashCalls = 0;
    await page.route(/[gG]enerateContent/, async (route) => {
      const model = /models\/([^:]+):/.exec(route.request().url())?.[1] ?? '?';
      calls.push(model);
      if (PRO.test(model)) {
        await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: ${model}` } }) });
        return;
      }
      if (flashCalls++ < busyFlashCalls) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.' } }) });
        return;
      }
      const body = JSON.parse(route.request().postData() ?? '{}');
      const prompt: string = body.contents?.[0]?.parts?.[0]?.text ?? '';
      const items = JSON.parse(/Items:\s*(\[[\s\S]*?\])\s*\n\s*Return ONLY/.exec(prompt)?.[1] ?? '[]');
      const answer = items.map((it: { text: string }) => mockTranslate(it.text));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(answer) }] } }] }) });
    });
    return calls;
  };
  const FLASH_IDS = 3; // gemini-3.6-flash, gemini-flash-latest, gemini-3-flash-preview

  // The clock is installed BEFORE the app loads (`shell` does not navigate on
  // its own): installed on an already-loaded page it does not take over the
  // app's timers, and the waits would run in real time.
  async function start(shell: { goto(): Promise<void>; openToolMatching(r: RegExp): Promise<void> }, page: Page) {
    await page.clock.install();
    await shell.goto();
    await shell.openToolMatching(/AI Translator/);
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'Translate (2).xlsx', mimeType: XLSX_TYPE, buffer: REAL });
    await page.getByRole('checkbox', { name: 'Product Name', exact: true }).check();
    await page.getByRole('button', { name: 'Auto ⇄' }).click();
    await page.getByRole('button', { name: '|', exact: true }).click();
    await page.getByRole('button', { name: 'In-Place Update' }).click();
    const pending = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: en.common.start }).click();
    await page.getByRole('button', { name: en.actions.showLogs }).click();
    // Wrapped: an async function returning the promise itself would make the
    // caller's `await` wait for the DOWNLOAD — i.e. for the waits to pass in real time.
    return { pending };
  }
  const waitNotice = (s: number, n: number) => `All models are busy (temporary Gemini service overload) — retrying in ${s}s (${n}/3).`;

  test('every Flash id 503 in the first round → a logged 15s wait, then the run completes: Translated_, column A bilingual', async ({ shell, page }) => {
    test.setTimeout(120_000);
    const calls = await busy(FLASH_IDS)(page);
    const { pending } = await start(shell, page);
    await expect(page.getByText(waitNotice(15, 1))).toBeVisible({ timeout: 30_000 });
    const before = calls.length;
    await page.clock.runFor(14_000);
    expect(calls).toHaveLength(before); // nothing is asked during the wait
    await page.clock.runFor(1_500);
    const d = await pending;
    expect(d.suggestedFilename()).toBe('Translated_Translate (2).xlsx');
    const wb = XLSX.read(readFileSync((await d.path())!), { type: 'buffer' });
    const src = grid(XLSX.read(REAL, { type: 'buffer' }), 'rewaa-import-simple');
    const out = grid(wb, 'rewaa-import-simple');
    for (let r = 1; r < src.length; r++) expect(out[r][0]).toBe(`${src[r][0]} | EN:${src[r][0]}`);
    expect(out.map((r) => r.slice(1))).toEqual(src.map((r) => r.slice(1)));
    // One wait only; the no-quota Pros were asked once each, never again after the wait.
    await expect(page.getByText(waitNotice(30, 2))).toHaveCount(0);
    expect(calls.filter((m) => PRO.test(m))).toHaveLength(3);
    expect(calls.filter((m) => !PRO.test(m))).toHaveLength(FLASH_IDS + 1);
    // The wait is not reported as a model change in the workbook.
    const summary = grid(wb, 'Translation Summary').flat().map(String);
    expect(summary.some((c) => c.startsWith('All models are busy'))).toBe(false);
  });

  test('two busy rounds, then success: 15s, then 30s, both logged', async ({ shell, page }) => {
    test.setTimeout(120_000);
    await busy(FLASH_IDS * 2)(page);
    const { pending } = await start(shell, page);
    await expect(page.getByText(waitNotice(15, 1))).toBeVisible({ timeout: 30_000 });
    await page.clock.runFor(15_500);
    await expect(page.getByText(waitNotice(30, 2))).toBeVisible({ timeout: 30_000 });
    await page.clock.runFor(30_500);
    expect((await pending).suggestedFilename()).toBe('Translated_Translate (2).xlsx');
  });

  test('busy through all three waits → the same safe PARTIAL_ file as before: column unchanged, banner, readable error', async ({ shell, page }) => {
    test.setTimeout(120_000);
    const calls = await busy(Number.MAX_SAFE_INTEGER)(page);
    const { pending } = await start(shell, page);
    for (const [s, n] of [[15, 1], [30, 2], [60, 3]] as const) {
      await expect(page.getByText(waitNotice(s, n))).toBeVisible({ timeout: 30_000 });
      await page.clock.runFor(s * 1000 + 500);
    }
    const d = await pending;
    expect(d.suggestedFilename()).toBe('PARTIAL_Translated_Translate (2).xlsx');
    const wb = XLSX.read(readFileSync((await d.path())!), { type: 'buffer' });
    expect(grid(wb, 'rewaa-import-simple')).toEqual(grid(XLSX.read(REAL, { type: 'buffer' }), 'rewaa-import-simple'));
    const summary = grid(wb, 'Translation Summary');
    expect(summary[0][0]).toBe('*** PARTIAL TRANSLATION — THIS FILE IS NOT COMPLETE ***');
    expect(summary[1][0]).toBe('Translated 0 of 20 items that needed translation.');
    await expect(page.getByText(`Batch failed, stopping here: ${en.aiErrors.busy}`)).toBeVisible();
    // Bounded: the Flash list walked four times (first try + three retries), never a fifth.
    expect(calls.filter((m) => !PRO.test(m))).toHaveLength(FLASH_IDS * 4);
  });
});

test.describe('AI Translator — the overload wait budget is per RUN, not per batch', () => {
  // 40 different Arabic items → two batches of 20.
  function fortyRows(): Buffer {
    const rows = [['Product Name', 'Price'], ...Array.from({ length: 40 }, (_, i) => [`منتج رقم ${i + 1}`, i + 1])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Menu');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  test('batch 1 spends 105s and succeeds; batch 2 gets only the 15s left, then a safe PARTIAL_ with batch 1 kept', async ({ shell, page }) => {
    test.setTimeout(120_000);
    // Pro: no quota. Flash: busy for batch 1's first three walks (9 calls), the
    // 10th call answers (batch 1 done), and busy for everything after.
    let flashCalls = 0;
    await page.route(/[gG]enerateContent/, async (route) => {
      const model = /models\/([^:]+):/.exec(route.request().url())?.[1] ?? '?';
      if (/pro/.test(model)) {
        await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: ${model}` } }) });
        return;
      }
      if (flashCalls++ !== 9) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand. Please try again later.' } }) });
        return;
      }
      const prompt: string = JSON.parse(route.request().postData() ?? '{}').contents?.[0]?.parts?.[0]?.text ?? '';
      const items = JSON.parse(/Items:\s*(\[[\s\S]*?\])\s*\n\s*Return ONLY/.exec(prompt)?.[1] ?? '[]');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(items.map((it: { text: string }) => mockTranslate(it.text))) }] } }] }) });
    });
    await page.clock.install();
    await shell.goto();
    await shell.openToolMatching(/AI Translator/);
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'forty.xlsx', mimeType: XLSX_TYPE, buffer: fortyRows() });
    await page.getByRole('checkbox', { name: 'Product Name', exact: true }).check();
    await page.getByRole('button', { name: 'Auto ⇄' }).click();
    await page.getByRole('button', { name: '|', exact: true }).click();
    await page.getByRole('button', { name: 'In-Place Update' }).click();
    const pending = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: en.common.start }).click();
    await page.getByRole('button', { name: en.actions.showLogs }).click();

    const log = page.getByText(/^All models are (busy|still busy)/);
    // Batch 1: 15, 30, 60 — then it is answered.
    for (const [sec, n, count] of [[15, 1, 1], [30, 2, 2], [60, 3, 3]] as const) {
      await expect(log).toHaveCount(count, { timeout: 30_000 });
      await expect(page.getByText(`All models are busy (temporary Gemini service overload) — retrying in ${sec}s (${n}/3).`)).toBeVisible();
      await page.clock.runFor(sec * 1000 + 500);
    }
    // Batch 2: its rounds restart, but only 15s of the run's 120s is left.
    await expect(log).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByText('All models are busy (temporary Gemini service overload) — retrying in 15s (1/3).')).toHaveCount(2);
    await page.clock.runFor(15_500);
    await expect(page.getByText("All models are still busy and this run's 120s wait budget for temporary Gemini service overload is used up — stopping.")).toBeVisible({ timeout: 30_000 });
    // No 30s round for batch 2 — the budget, not the per-batch rounds, ended it.
    await expect(page.getByText(/retrying in 30s/)).toHaveCount(1);

    const d = await pending;
    expect(d.suggestedFilename()).toBe('PARTIAL_Translated_forty.xlsx');
    const out = grid(XLSX.read(readFileSync((await d.path())!), { type: 'buffer' }), 'Menu');
    for (let r = 1; r <= 20; r++) expect(out[r][0]).toBe(`منتج رقم ${r} | EN:منتج رقم ${r}`); // batch 1 kept
    for (let r = 21; r <= 40; r++) expect(out[r][0]).toBe(`منتج رقم ${r}`);                    // batch 2 untouched
    expect(out.map((r) => r[1])).toEqual(['Price', ...Array.from({ length: 40 }, (_, i) => i + 1)]);
  });
});

test.describe('AI Translator — CSV and XLSX take the same request path', () => {
  test('the same 20 items as .xlsx and as a UTF-8 (BOM, CRLF) .csv: one request each, identical items and prompt', async ({ app, page }) => {
    test.setTimeout(120_000);
    const calls = await model(page);
    const csv = XLSX.utils.sheet_to_csv(XLSX.read(REAL, { type: 'buffer' }).Sheets['rewaa-import-simple'], { RS: '\r\n' });
    const CSV = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]);
    const x = await translate(app, page, REAL, 'menu.xlsx', 'Product Name');
    const fromXlsx = calls.splice(0);
    await page.reload();
    await app.waitUntilReady();
    const c = await translate(app, page, CSV, 'menu.csv', 'Product Name');
    const fromCsv = calls.splice(0);
    expect(fromXlsx).toHaveLength(1);
    expect(fromCsv).toHaveLength(1);
    expect(fromCsv[0].items).toEqual(fromXlsx[0].items);
    expect(fromCsv[0].prompt).toBe(fromXlsx[0].prompt);
    // Same translated column; only the sheet name differs (a CSV has no sheet name).
    expect(x.wb.SheetNames).toEqual(['rewaa-import-simple', 'Translation Summary']);
    expect(c.wb.SheetNames).toEqual(['Sheet1', 'Translation Summary']);
    expect(grid(c.wb, 'Sheet1').map((r) => r[0])).toEqual(grid(x.wb, 'rewaa-import-simple').map((r) => r[0]));
    expect(c.file).toBe('Translated_menu.xlsx');
  });
});
