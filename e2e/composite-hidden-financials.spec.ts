/**
 * Composite Check: hidden workbook content, and Cost & Profit in the validated
 * export (utils/compositeWorkbook.ts, utils/compositeFinancials.ts), in a real
 * browser on the workbook the user actually downloads.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const RAW = [
  ['SKU', 'Name', 'Cost'],
  ['RAW-100', 'Bun', 1],
  ['RAW-200', 'Patty', 5],
  ['RAW-300', 'Cheese', 2.5],
  ['00123', 'Sauce', 0.5],
];
const COMPOSITE = [
  ['Product Name', 'Product SKU', 'Retail Price', 'Unit', 'Ing SKU 1', 'Qty 1', 'Ing SKU 2', 'Qty 2'],
  ['Burger', 'COMP-001', 20, 'pc', 'RAW-100', 2, 'RAW-200', 1.5],   // cost 9.5 → profit 10.5
  ['Even', 'COMP-002', 7, 'pc', 'RAW-100', 2, 'RAW-200', 1],        // cost 7 → break-even
  ['Loser', 'COMP-003', 10, 'pc', 'RAW-200', 2, 'RAW-300', 1],      // cost 12.5 > 10
  ['Saucy', 'COMP-004', 3, 'pc', '00123', 2, '', ''],               // leading zeros: cost 1
];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface Build { lists?: 0 | 1 | 2; raw?: 0 | 1 | 2; comp?: 0 | 1 | 2; hideRowsCols?: boolean; extraSheets?: string[] }

/** Raw first, Composite second (the order the defaults assume), plus whatever hidden extras. */
function workbook(b: Build = {}) {
  const wb = XLSX.utils.book_new();
  const states: number[] = [];
  if (b.lists !== undefined) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Units'], ['pc']]), 'Lists');
    states.push(b.lists);
  }
  const raw = XLSX.utils.aoa_to_sheet(RAW);
  const comp = XLSX.utils.aoa_to_sheet(COMPOSITE);
  if (b.hideRowsCols) {
    comp['!rows'] = [{}, { hidden: true }, {}, {}, { hidden: true }];
    comp['!cols'] = [{ hidden: true }, {}, { hidden: true }, {}, {}, {}, {}, { hidden: true }];
    raw['!rows'] = [{}, { hidden: true }];
    raw['!cols'] = [{}, {}, { hidden: true }];
  }
  XLSX.utils.book_append_sheet(wb, raw, 'Raw');
  states.push(b.raw ?? 0);
  XLSX.utils.book_append_sheet(wb, comp, 'Composite');
  states.push(b.comp ?? 0);
  for (const name of b.extraSheets ?? []) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['old result']]), name);
    states.push(0);
  }
  wb.Workbook = { Sheets: states.map((Hidden) => ({ Hidden })) } as XLSX.WBProps;
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function open(app: { goto(): Promise<void>; openTool(n: string): Promise<void> }, page: Page, buffer: Buffer) {
  await app.goto();
  await app.openTool('Composite Check');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'composite.xlsx', mimeType: XLSX_TYPE, buffer });
  await expect(page.locator('select').first().locator('option', { hasText: 'Composite' })).toHaveCount(1);
}

/** Structure Validator → one column ticked → Validate → the downloaded workbook. */
async function validate(page: Page) {
  await page.getByText('1. Product Name', { exact: true }).first().click();
  const pending = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Validate Composite' }).click();
  return XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer', cellStyles: true, cellNF: true });
}

async function mapFinancials(page: Page, retail = true) {
  await page.locator('label:has-text("Raw Sheet SKU Column") + select').selectOption({ label: 'SKU' });
  await page.getByLabel('Raw Sheet: Cost Column').selectOption({ label: 'Cost' });
  await page.getByLabel('Raw Sheet: Name Column').selectOption({ label: 'Name' });
  if (retail) await page.getByLabel('Composite: Retail Price').selectOption({ label: 'Retail Price' });
}

const grid = (wb: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][];
const hidden = (wb: XLSX.WorkBook, name: string) => wb.Workbook?.Sheets?.[wb.SheetNames.indexOf(name)]?.Hidden ?? 0;

test.describe('Composite Check — hidden content', () => {
  test('a hidden lists sheet at the front no longer becomes the Raw sheet: the defaults just work', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook({ lists: 1 }));
    const sel = page.locator('select');
    // Composite picker first, Raw picker second; Lists is still offered, marked hidden.
    await expect(sel.nth(0)).toHaveValue('Composite');
    await expect(sel.nth(1)).toHaveValue('Raw');
    await expect(sel.nth(1).locator('option', { hasText: 'Lists (hidden)' })).toHaveCount(1);
    // No sheet chosen by hand: before, every ingredient was "missing" against Lists.
    const wb = await validate(page);
    expect(wb.SheetNames).not.toContain('Validation Errors');
    expect(grid(wb, 'Valid Products')).toHaveLength(COMPOSITE.length);
  });

  test('hidden rows, hidden columns, a very hidden Composite sheet and a hidden Raw sheet: complete and visible export', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook({ comp: 2, raw: 1, hideRowsCols: true }));
    const sel = page.locator('select');
    await sel.nth(0).selectOption({ label: 'Composite (very hidden)' });
    await sel.nth(1).selectOption({ label: 'Raw (hidden)' });
    const wb = await validate(page);

    // Every row and column, including the hidden ones, reaches the export.
    expect(grid(wb, 'Composite')).toEqual(COMPOSITE.map((r) => r.map(String)).map((r) => r.map((c) => c)));
    expect(grid(wb, 'Valid Products').map((r) => r[1])).toEqual(COMPOSITE.map((r) => r[1]));
    // The validated sheet is the result: visible, with no hidden rows or columns.
    expect(hidden(wb, 'Composite')).toBe(0);
    expect((wb.Sheets.Composite['!rows'] ?? []).some((r) => r?.hidden)).toBe(false);
    expect((wb.Sheets.Composite['!cols'] ?? []).some((c) => c?.hidden)).toBe(false);
    // An unrelated sheet keeps its state.
    expect(hidden(wb, 'Raw')).toBe(1);

    await page.getByRole('button', { name: /logs/i }).first().click();
    await expect(page.getByText("The Composite sheet 'Composite' is very hidden in your file; it was read in full.")).toBeVisible();
    await expect(page.getByText("The validated 'Composite' sheet is visible in the export (it was very hidden in your file).")).toBeVisible();
  });

  test('re-validating an exported file: the result sheets get free names instead of failing', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook({ extraSheets: ['Valid Products', 'Summary'] }));
    const sel = page.locator('select');
    await sel.nth(0).selectOption({ label: 'Composite' });
    await sel.nth(1).selectOption({ label: 'Raw' });
    const wb = await validate(page);
    expect(wb.SheetNames).toEqual(['Raw', 'Composite', 'Valid Products', 'Summary', 'Valid Products (2)', 'Summary (2)']);
    expect(grid(wb, 'Valid Products')).toEqual([['old result']]);
  });
});

test.describe('Composite Check — SKU matching (decision D7)', () => {
  test('an invisible character does not make a SKU missing; leading zeros and case still matter', async ({ app, page }) => {
    test.setTimeout(120_000);
    const ZWSP = String.fromCharCode(0x200b);
    const wb0 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([
      ['SKU', 'Name', 'Cost'],
      [`RAW-100${ZWSP}`, 'Bun', 1],   // invisible character in the Raw sheet
      ['RAW-200', 'Patty', 5],
      ['100', 'Plain hundred', 1],
      [`COMP-009${ZWSP}`, 'Raw twin', 1],
    ]), 'Raw');
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([
      COMPOSITE[0],
      ['Clean', 'COMP-001', 20, 'pc', 'RAW-100', 2, `RAW-200${ZWSP}`, 1],   // both match
      ['Zeros', 'COMP-002', 20, 'pc', '0100', 1, '', ''],                    // 0100 ≠ 100
      ['Case', 'COMP-003', 20, 'pc', 'raw-200', 1, '', ''],                  // case kept
      ['Twin', 'COMP-009', 20, 'pc', 'RAW-200', 1, '', ''],                  // also a Raw SKU
    ]), 'Composite');
    await open(app, page, Buffer.from(XLSX.write(wb0, { type: 'buffer', bookType: 'xlsx' })));
    await page.locator('label:has-text("Raw Sheet SKU Column") + select').selectOption({ label: 'SKU' });
    await page.getByLabel('Raw Sheet: Cost Column').selectOption({ label: 'Cost' });
    const wb = await validate(page);
    const errors = grid(wb, 'Validation Errors').slice(1).map((r) => `${r[1]}: ${r[r.length - 3]}`);
    expect(errors).toEqual([
      "COMP-002: SKU '0100' missing",
      "COMP-003: SKU 'raw-200' missing",
      "COMP-009: Conflict: Composite SKU 'COMP-009' is also defined as a Raw Material",
    ]);
    expect(grid(wb, 'Valid Products').map((r) => r[1])).toEqual(['Product SKU', 'COMP-001']);
    // The structure check and the costing agree on the same ingredient.
    // (Retail Price is not mapped here, so cost only.)
    expect(grid(wb, 'Profit Analysis')[1]).toEqual(['Clean', 'COMP-001', '', 7, '', '', '', 2, 'Retail Price is not mapped']);
  });
});

test.describe('Composite Check — Cost & Profit in the validated export', () => {
  test('mapped: Profit Analysis and Detailed BOM, numbers as numbers, Cost above Retail in Validation Errors', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook());
    await mapFinancials(page);
    const wb = await validate(page);
    expect(wb.SheetNames).toEqual(['Raw', 'Composite', 'Validation Errors', 'Valid Products', 'Summary', 'Profit Analysis', 'Detailed BOM']);

    const profit = grid(wb, 'Profit Analysis');
    expect(profit).toEqual([
      ['Product Name', 'SKU', 'Retail Price', 'Cost', 'Profit', 'Margin %', 'Profit/Loss', 'Source Row', 'Note'],
      ['Burger', 'COMP-001', 20, 9.5, 10.5, 0.525, 'Profit', 2, ''],
      ['Even', 'COMP-002', 7, 7, 0, 0, 'Break-even', 3, ''],
      ['Loser', 'COMP-003', 10, 12.5, -2.5, -0.25, 'Loss', 4, ''],
      ['Saucy', 'COMP-004', 3, 1, 2, 2 / 3, 'Profit', 5, ''],
    ]);
    // Numeric cells with money and percent formats, not text.
    const ws = wb.Sheets['Profit Analysis'];
    expect(ws.D2).toMatchObject({ t: 'n', v: 9.5, z: '#,##0.00' });
    expect(ws.F2).toMatchObject({ t: 'n', v: 0.525, z: '0.00%' });

    expect(grid(wb, 'Detailed BOM').slice(0, 3)).toEqual([
      ['Product Name', 'Product SKU', 'Ingredient SKU', 'Ingredient Name', 'Quantity', 'Unit Cost', 'Line Cost'],
      ['Burger', 'COMP-001', 'RAW-100', 'Bun', 2, 1, 2],
      ['Burger', 'COMP-001', 'RAW-200', 'Patty', 1.5, 5, 7.5],
    ]);

    const errors = grid(wb, 'Validation Errors');
    expect(errors).toHaveLength(2);
    const loser = errors[1];
    expect(loser.slice(0, 3)).toEqual(['Loser', 'COMP-003', '10']);
    expect(loser.slice(-3)).toEqual([
      'Cost is higher than Retail Price (Cost 12.50 > Retail Price 10.00, loss 2.50)',
      'التكلفة أعلى من سعر البيع (التكلفة 12.50 > سعر البيع 10.00، الخسارة 2.50)',
      'C4',
    ]);
    // The loss-making product is still in the financial output, and out of Valid Products.
    expect(grid(wb, 'Valid Products').map((r) => r[1])).toEqual(['Product SKU', 'COMP-001', 'COMP-002', 'COMP-004']);

    await page.getByRole('button', { name: /logs/i }).first().click();
    await expect(page.getByText('Cost & Profit: 4 products: 2 profit, 1 break-even, 1 loss; 1 with Cost above Retail Price (in Validation Errors).')).toBeVisible();
  });

  test('a Retail Price problem: Profit stays blank and the Note says why, as Validation Errors does', async ({ app, page }) => {
    test.setTimeout(120_000);
    const raw = XLSX.utils.aoa_to_sheet(RAW);
    const comp = XLSX.utils.aoa_to_sheet([
      COMPOSITE[0],
      ['Burger', 'COMP-001', 20, 'pc', 'RAW-100', 2, 'RAW-200', 1.5],
      ['NoPrice', 'COMP-005', '', 'pc', 'RAW-100', 2, '', ''],
      ['BadPrice', 'COMP-006', 'free', 'pc', 'RAW-100', 2, '', ''],
      ['NegPrice', 'COMP-007', -5, 'pc', 'RAW-100', 2, '', ''],
      ['ZeroPrice', 'COMP-008', 0, 'pc', 'RAW-100', 2, '', ''],
    ]);
    const wb0 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb0, raw, 'Raw');
    XLSX.utils.book_append_sheet(wb0, comp, 'Composite');
    await open(app, page, Buffer.from(XLSX.write(wb0, { type: 'buffer', bookType: 'xlsx' })));
    await mapFinancials(page);
    const wb = await validate(page);
    expect(grid(wb, 'Profit Analysis').slice(1)).toEqual([
      ['Burger', 'COMP-001', 20, 9.5, 10.5, 0.525, 'Profit', 2, ''],
      ['NoPrice', 'COMP-005', '', 2, '', '', '', 3, 'Missing Retail Price'],
      ['BadPrice', 'COMP-006', '', 2, '', '', '', 4, "Invalid Retail Price 'free'"],
      ['NegPrice', 'COMP-007', '', 2, '', '', '', 5, "Negative Retail Price '-5'"],
      // 0 is a valid Retail Price: kept as 0, Profit calculated, Margin blank, with the reason.
      ['ZeroPrice', 'COMP-008', 0, 2, -2, '', 'Loss', 6, 'Margin cannot be calculated because Retail Price is 0'],
    ]);
    // The cost is still a numeric cell on those rows.
    expect(wb.Sheets['Profit Analysis'].D3).toMatchObject({ t: 'n', v: 2 });
    // The same reasons, unchanged, in Validation Errors.
    expect(grid(wb, 'Validation Errors').slice(1).map((r) => r[r.length - 3])).toEqual([
      'Missing Retail Price', "Invalid Retail Price 'free'", "Negative Retail Price '-5'",
      // 0 is not a Retail Price error; the existing Cost-above-Retail rule applies.
      'Cost is higher than Retail Price (Cost 2.00 > Retail Price 0.00, loss 2.00)',
    ]);
    expect(wb.Sheets['Profit Analysis'].C6).toMatchObject({ t: 'n', v: 0 });
  });

  test('Retail Price not mapped: Cost only, no invented profit, no financial errors', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook());
    await mapFinancials(page, false);
    const wb = await validate(page);
    expect(wb.SheetNames).not.toContain('Validation Errors');
    expect(grid(wb, 'Profit Analysis')[1]).toEqual(['Burger', 'COMP-001', '', 9.5, '', '', '', 2, 'Retail Price is not mapped']);
  });

  test('no Cost mapping: the export is exactly the old one', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook());
    const wb = await validate(page);
    expect(wb.SheetNames).toEqual(['Raw', 'Composite', 'Valid Products', 'Summary']);
  });

  test('the Cost & Profit Analyzer tab and its export are unchanged', async ({ app, page }) => {
    test.setTimeout(120_000);
    await open(app, page, workbook());
    await page.getByRole('button', { name: 'Cost & Profit Analyzer' }).click();
    await page.getByLabel('Raw Sheet: SKU Column').selectOption({ label: 'SKU' });
    await page.getByLabel('Raw Sheet: Cost Column').selectOption({ label: 'Cost' });
    await page.getByLabel('Raw Sheet: Name Column').selectOption({ label: 'Name' });
    await page.getByLabel('Composite: Retail Price').selectOption({ label: 'Retail Price' });
    await page.getByRole('button', { name: 'Analyze Cost & Profit' }).click();
    await expect(page.getByText('Profit Simulator')).toBeVisible();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Default' }).click();
    const wb = XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Profit Analysis', 'Detailed BOM']);
    // The analyzer's own layout: Projected Cost, Margin % as text, At Risk / Profitable at the 30 % target.
    expect(grid(wb, 'Profit Analysis')).toEqual([
      ['Product Name', 'SKU', 'Retail Price', 'Projected Cost', 'Profit', 'Margin %', 'Status'],
      ['Burger', 'COMP-001', 20, 9.5, 10.5, '52.50%', 'Profitable'],
      ['Even', 'COMP-002', 7, 7, 0, '0.00%', 'At Risk'],
      ['Loser', 'COMP-003', 10, 12.5, -2.5, '-25.00%', 'At Risk'],
      ['Saucy', 'COMP-004', 3, 1, 2, '66.67%', 'Profitable'],
    ]);
  });
});
