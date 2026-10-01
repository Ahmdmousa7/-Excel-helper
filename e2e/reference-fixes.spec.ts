/**
 * Behaviour adopted from the ExcelDiff AI reference package (2026-09-30),
 * driven through the real tools in a browser. Each test fails on the code
 * before that change. The pure logic behind them is unit tested in
 * tests/unit/{compareRules,sheetNames,dedupe,workbookBytesUtf16}.test.ts.
 */
import { test, expect, TOOL, AppShell } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
const csv = (rows: string[][]) => Buffer.from(rows.map((r) => r.join(',')).join(NL) + NL, 'utf8');
const xlsx = (rows: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};
const CSV_MIME = 'text/csv';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Load the shell's primary file, then open a tool. */
async function openWith(app: AppShell, page: Page, tool: string, name: string, buffer: Buffer, mimeType = CSV_MIME) {
  await app.goto();
  await app.openTool(tool);
  await page.locator('input[type="file"]').first().setInputFiles({ name, mimeType, buffer });
}

async function showLogs(page: Page) {
  const btn = page.getByRole('button', { name: /Show Logs/i });
  if (await btn.count()) await btn.first().click();
}

const bytesOf = async (dl: Promise<import('@playwright/test').Download>) => readFileSync((await (await dl).path())!);

test.describe('Compare Files', () => {
  test('Run is disabled while no column is mapped', async ({ app, page }) => {
    await openWith(app, page, TOOL.compareFiles, 'one.csv', csv([['id', 'price'], ['1', '5']]));
    await page.locator('input[type="file"]').last().setInputFiles({ name: 'two.csv', mimeType: CSV_MIME, buffer: csv([['key', 'cost'], ['1', '5']]) });
    // Before: enabled, and every shared key came back as a "perfect match".
    const run = page.getByRole('button', { name: /Run Comparison/ });
    await expect(run).toBeDisabled();
    // The reason is visible text tied to the button, not a hover-only tooltip.
    await expect(page.getByText('Map at least one column to compare.')).toBeVisible();
    await expect(run).toHaveAccessibleDescription('Map at least one column to compare.');
    await expect(run).not.toHaveAttribute('title');
  });

  test('the hint disappears once a column is mapped', async ({ app, page }) => {
    await openWith(app, page, TOOL.compareFiles, 'one.csv', csv([['id', 'price'], ['1', '5']]));
    await page.locator('input[type="file"]').last().setInputFiles({ name: 'two.csv', mimeType: CSV_MIME, buffer: csv([['id', 'price'], ['1', '5']]) });
    await expect(page.getByRole('button', { name: /Run Comparison/ })).toBeEnabled();
    await expect(page.getByText('Map at least one column to compare.')).toHaveCount(0);
  });

  test('the CSV export keeps rows after a # and cells stay whole', async ({ app, page }) => {
    await openWith(app, page, TOOL.compareFiles, 'one.csv', csv([['SKU', 'Name'], ['1', 'Item #3 red'], ['2', 'Second']]));
    await page.locator('input[type="file"]').last().setInputFiles({ name: 'two.csv', mimeType: CSV_MIME, buffer: csv([['SKU', 'Name'], ['1', 'Item #3 blue'], ['2', 'Second']]) });
    await page.getByRole('button', { name: /Run Comparison/ }).click();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export CSV/ }).click();
    const text = (await bytesOf(dl)).toString('utf8');
    // Before: a data: URI via encodeURI, so the file ended at the first `#`.
    expect(text).toContain('"Item #3 red"');
    expect(text).toContain('"Item #3 blue"');
    expect(text).toContain('"Second"');
  });
});

test.describe('Remove Blanks', () => {
  test('a result is cleared when the start row changes', async ({ app, page }) => {
    await openWith(app, page, TOOL.removeBlanks, 'a.csv', csv([['a', 'b'], ['1', '']]));
    await page.getByRole('button', { name: /Scrub Clean/ }).click();
    const all = page.getByRole('button', { name: /Download All Files/ });
    await expect(all).toBeVisible();
    await page.locator('input[type="number"]').fill('1');
    // Before: the old result stayed downloadable under the new start row.
    await expect(all).toHaveCount(0);
  });

  test('two files with one name both reach the ZIP', async ({ app, page }) => {
    await openWith(app, page, TOOL.removeBlanks, 'a.csv', csv([['a', 'b'], ['first', '']]));
    await page.locator('input[type="file"][multiple]').setInputFiles({ name: 'a.csv', mimeType: CSV_MIME, buffer: csv([['a', 'b'], ['second', '']]) });
    await page.getByRole('button', { name: /Scrub Clean/ }).click();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download All Files/ }).click();
    const zip = await JSZip.loadAsync(await bytesOf(dl));
    const names = Object.keys(zip.files).sort();
    // Before: one entry — the second file overwrote the first.
    expect(names).toEqual(['Cleaned_a_Sheet1-2.xlsx', 'Cleaned_a_Sheet1.xlsx']);
    const values = await Promise.all(names.map(async (n) => {
      const wb = XLSX.read(await zip.files[n].async('uint8array'));
      return (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][])[1][0];
    }));
    expect(values.sort()).toEqual(['first', 'second']);
  });
});

test.describe('Deduplicator', () => {
  test('Select All selects every column, and the counts add up', async ({ app, page }) => {
    await openWith(app, page, TOOL.deduplicator, 'd.csv', csv([['sku', 'name'], ['1', 'x'], ['1', 'x'], ['2', 'y']]));
    await page.getByRole('button', { name: 'Select All' }).click();
    await expect(page.getByText('2 Selected')).toBeVisible();
    await page.getByRole('radio').nth(1).check(); // Remove All Duplicates
    await page.getByRole('button', { name: /Execute Deduplication/ }).click();
    // Remove-all drops both copies: 3 rows, 2 removed, 1 survives.
    // Before: "Discovered Duplicates: 1" beside "Surviving: 1".
    await expect(page.getByText('Discovered Duplicates: 2')).toBeVisible();
    await expect(page.getByText('Surviving: 1')).toBeVisible();
  });

  test('the two modes are one radio group', async ({ app, page }) => {
    await openWith(app, page, TOOL.deduplicator, 'd.csv', csv([['sku'], ['1']]));
    const radios = page.getByRole('radio');
    await expect(radios.nth(0)).toHaveAttribute('name', 'dedupe-mode');
    await expect(radios.nth(1)).toHaveAttribute('name', 'dedupe-mode');
  });
});

test.describe('Merge Datasets', () => {
  const addFiles = (page: Page) => page.locator('input[type="file"][multiple]');
  const run = async (page: Page) => {
    await page.getByRole('button', { name: /Configuration & Run/ }).click();
  };

  test('two files with the same name are both merged', async ({ app, page }) => {
    await openWith(app, page, TOOL.mergeDatasets, 'export.csv', csv([['sku', 'qty'], ['A', '1']]));
    await addFiles(page).setInputFiles({ name: 'export.csv', mimeType: CSV_MIME, buffer: csv([['sku', 'qty'], ['B', '2']]) });
    await run(page);
    await page.getByRole('button', { name: /Generate Unified Dataset/ }).click();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Output File/ }).click();
    const wb = XLSX.read(await bytesOf(dl));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
    // Before: the second export.csv was replaced by the first — A appeared twice, B never.
    // (CSV cells are read as text on purpose, so `00123` survives: hence '1'.)
    expect(rows).toEqual([['sku', 'qty'], ['A', '1'], ['B', '2']]);
  });

  test('Sales.csv + Sales.xlsx as separate sheets downloads instead of crashing', async ({ app, page }) => {
    await openWith(app, page, TOOL.mergeDatasets, 'Sales.csv', csv([['a'], ['1']]));
    await addFiles(page).setInputFiles({ name: 'Sales.xlsx', mimeType: XLSX_MIME, buffer: xlsx([['a'], [2]]) });
    await run(page);
    await page.getByText('Multiple Sheets', { exact: false }).first().click();
    await page.getByRole('button', { name: /Process Separated Datasets/ }).click();
    const dl = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /Download Output File/ }).click();
    // Before: two sheets named `Sales` — SheetJS threw and nothing downloaded.
    expect(XLSX.read(await bytesOf(dl)).SheetNames).toEqual(['Sales', 'Sales (2)']);
  });

  test('a result is cleared when a setting changes', async ({ app, page }) => {
    await openWith(app, page, TOOL.mergeDatasets, 'a.csv', csv([['a'], ['1']]));
    await addFiles(page).setInputFiles({ name: 'b.csv', mimeType: CSV_MIME, buffer: csv([['a'], ['2']]) });
    await run(page);
    await page.getByRole('button', { name: /Generate Unified Dataset/ }).click();
    const download = page.getByRole('button', { name: /Download Output File/ });
    await expect(download).toBeVisible();
    await page.getByText('Multiple Sheets', { exact: false }).first().click();
    // Before: the single-sheet result stayed downloadable in sheets mode.
    await expect(download).toHaveCount(0);
  });

  test('Add Files can be reached by keyboard', async ({ app, page }) => {
    await openWith(app, page, TOOL.mergeDatasets, 'a.csv', csv([['a'], ['1']]));
    const input = addFiles(page);
    await input.focus();
    // Before: `display:none`, which cannot take focus.
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type)).toBe('file');
  });
});

test.describe('Separator', () => {
  test('an invalid rows-per-file value is reported, and nothing downloads', async ({ app, page }) => {
    await openWith(app, page, TOOL.separator, 'book.xlsx', xlsx([['a'], [1], [2]]), XLSX_MIME);
    await page.getByRole('button', { name: /Divide Rows/ }).click();
    await page.locator('input[type="number"]').fill('-5');
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await page.getByRole('button', { name: /Execute Row Split/ }).click();
    await showLogs(page);
    // Before: nothing happened and nothing was said.
    await expect(page.getByText('Maximum rows per file must be a whole number of 1 or more.')).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(downloads).toBe(0);
  });

  test('the sheets ZIP is named without the workbook extension', async ({ app, page }) => {
    await openWith(app, page, TOOL.separator, 'book.xlsx', xlsx([['a'], [1]]), XLSX_MIME);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download ZIP Repository/ }).click();
    // Before: Separated_Sheets_book.xlsx.zip
    expect((await dl).suggestedFilename()).toBe('Separated_Sheets_book.zip');
  });
});
