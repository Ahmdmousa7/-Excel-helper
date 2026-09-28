/**
 * Files Validation, end to end — the first browser coverage this module has had.
 *
 * Drives the real flow: upload a workbook, let the columns auto-map, run
 * validation, export, and read the file a user would actually download. Covers
 * the duplicate rules and the per-error / per-fix sheets, through BOTH export
 * paths — a single workbook, and the chunked ZIP whose parts must each carry
 * only their own rows' issues.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';

// A kasra, built from its code point so no invisible character sits in this file.
const KASRA = String.fromCharCode(0x0650);

/**
 * Headers chosen so the module's auto-mapper maps them without UI clicks.
 * Row indices below are 0-based DATA rows.
 */
const ROWS: (string | number)[][] = [
  // `Pack1 Barcode` is mapped to the barcode field by the auto-mapper, because
  // it maps any header CONTAINING "barcode" — exactly as it does for a real
  // Rewaa file. That makes row 7 carry one code in two barcode cells.
  ['Name', 'SKU', 'Barcode', 'Retail Price', 'Cost', 'Pack1 Barcode'],
  ['Tea', 'S-1', '6287013210006', 10, 5, ''],             // 0
  ['Coffee', 'S-2', `6287013210006${KASRA}`, 12, 6, ''],  // 1  same barcode, hidden kasra
  ['Milk', 'S-3', 'S-1', 8, 4, ''],                       // 2  barcode equals an SKU
  ['Juice', 'S-4', '00123', 9, 3, ''],                    // 3  leading zeros ...
  ['Water', 'S-5', '123', 2, 1, ''],                      // 4  ... are NOT a duplicate (D7)
  ['Loss', 'S-6', '999', 1, 50, ''],                      // 5  cost > retail
  ['Tea2', 'S-1', '777', 11, 5, ''],                      // 6  duplicate SKU
  ['Box', 'S-7', 'Z', 12, 6, 'Z'],                        // 7  same code in two cells of ONE row
];

function workbook(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(ROWS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function validate(app: any, page: Page) {
  await app.goto();
  await app.openToolMatching(/Files Validation/);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'products.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
  await page.getByRole('button', { name: /Run Validation/i }).click();
  await expect(page.getByRole('button', { name: /Export Report/i })).toBeVisible({ timeout: 30_000 });
}

async function download(page: Page): Promise<Buffer> {
  const pending = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: /Export Report/i }).click();
  return readFileSync((await (await pending).path())!);
}

const rowsOf = (wb: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][];

test.describe('Files Validation — duplicates and issue sheets', () => {
  test('single workbook: barcodes resolved, leading zeros respected, issue sheets present', async ({ app, page }) => {
    test.setTimeout(120_000);
    await validate(app, page);
    const wb = XLSX.read(await download(page), { type: 'buffer' });

    const data = rowsOf(wb, 'Validated Data');
    const col = (h: string) => (data[0] as string[]).indexOf(h);
    const cell = (row: number, h: string) => String(data[row + 1][col(h)]);

    // The reported case: the kasra variant IS a duplicate, so the second holder is renamed.
    expect(cell(0, 'Barcode')).toBe('6287013210006');
    expect(cell(1, 'Barcode')).toBe('6287013210006-1');
    // Duplicate SKU resolved first, taking S-1-1 …
    expect(cell(6, 'SKU')).toBe('S-1-1');
    // … so the barcode that clashed with SKU S-1 skips to S-1-2 instead of
    // creating a new duplicate. The SKU keeps the base code.
    expect(cell(2, 'Barcode')).toBe('S-1-2');
    expect(cell(0, 'SKU')).toBe('S-1');
    // Leading zeros are significant: neither is touched.
    expect(cell(3, 'Barcode')).toBe('00123');
    expect(cell(4, 'Barcode')).toBe('123');
    // One row, one code in two barcode cells: the first cell keeps it and only
    // the second is renamed. A row-level fix used to rewrite BOTH to Z-1,
    // resolving nothing and creating a duplicate inside the row.
    expect(cell(7, 'Barcode')).toBe('Z');
    expect(cell(7, 'Pack1 Barcode')).toBe('Z-1');

    // One sheet per error and per fix.
    expect(wb.SheetNames).toEqual(expect.arrayContaining([
      'Err_Loss Alert',
      'Fix_Resolved Duplicate Barcode',
      'Fix_Resolved Barcode = SKU',
      'Fix_Resolved Duplicate SKU',
    ]));
    // No barcode ERROR sheet any more — those are now fixes.
    expect(wb.SheetNames.some((n) => /Err_.*(Duplicate Barcode|Cross-column)/.test(n))).toBe(false);

    // Each sheet holds exactly the rows that triggered it, under the export headers.
    const loss = rowsOf(wb, 'Err_Loss Alert');
    expect(loss[0]).toEqual(data[0]);
    expect(loss.slice(1).map((r) => r[0])).toEqual(['Loss']);
    expect(rowsOf(wb, 'Fix_Resolved Duplicate Barcode').slice(1).map((r) => r[0])).toEqual(['Coffee', 'Box']);
    expect(rowsOf(wb, 'Fix_Resolved Barcode = SKU').slice(1).map((r) => r[0])).toEqual(['Milk']);
    expect(rowsOf(wb, 'Fix_Resolved Duplicate SKU').slice(1).map((r) => r[0])).toEqual(['Tea2']);
  });

  test('chunked ZIP: each part carries only its OWN rows’ issue sheets', async ({ app, page }) => {
    test.setTimeout(120_000);
    await validate(app, page);
    await page.getByPlaceholder('Max Rows/File').fill('3'); // parts: rows 0-2, 3-5, 6-7

    const zip = await JSZip.loadAsync(await download(page));
    const part = async (n: number) =>
      XLSX.read(await zip.file(`Validated_Part_${n}.xlsx`)!.async('nodebuffer'), { type: 'buffer' });

    const [p1, p2, p3] = [await part(1), await part(2), await part(3)];

    // Part 1 (rows 0-2): the two barcode fixes, no Loss Alert.
    expect(p1.SheetNames).toEqual(expect.arrayContaining(['Fix_Resolved Duplicate Barcode', 'Fix_Resolved Barcode = SKU']));
    expect(p1.SheetNames).not.toContain('Err_Loss Alert');
    // And the fix actually reached the cells in the ZIP part — a sheet name alone
    // proves only that the fix was LOGGED, not that the value was rewritten.
    const d1 = rowsOf(p1, 'Validated Data');
    const bc = (d1[0] as string[]).indexOf('Barcode');
    expect(d1.slice(1).map((r) => String(r[bc]))).toEqual(['6287013210006', '6287013210006-1', 'S-1-2']);

    // Part 2 (rows 3-5): only the Loss Alert.
    expect(p2.SheetNames).toContain('Err_Loss Alert');
    expect(p2.SheetNames.filter((n) => n.startsWith('Fix_'))).toEqual([]);

    // Part 3 (rows 6-7): the duplicate-SKU fix and Box's barcode fix.
    expect(p3.SheetNames).toContain('Fix_Resolved Duplicate SKU');
    expect(p3.SheetNames).not.toContain('Err_Loss Alert');
  });
});
