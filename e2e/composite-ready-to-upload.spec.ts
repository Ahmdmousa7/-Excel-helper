/**
 * Composite Check → Ready to upload, in a real browser: the Raw sheet into
 * Rewaa's Simple template, the VALID composites into Rewaa's Composite template
 * (ingredient N → ProductN), and the Identical check in the validated workbook.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const template = (f: string) =>
  XLSX.utils.sheet_to_json(XLSX.read(readFileSync(new URL(`../tests/fixtures/ready-to-upload/${f}`, import.meta.url)), { type: 'buffer' }).Sheets.data, { header: 1, defval: '' }) as string[][];
const SIMPLE_T = template('simple-template.xlsx');
const COMPOSITE_T = template('composite-template.xlsx');

const RAW_H = ['اسم المادة الخام + اسم الوحدة المستخدمة', 'الرقم التعريفي للمنتج (SKU)', 'سعر التكلفة غير شامل الضريبة للوحدة الواحدة', 'الكمية حسب الوحدة المستخدمة', 'الفئة'];
const COMP_H = ['اسم المنتج المجمع', 'رمز المنتج المجمع', 'فئة المنتج', 'سعر البيع',
  ...Array.from({ length: 30 }, (_, i) => [`الرمز التعريفي للمادة الخام رقم ${i + 1} مطابق لرمز المرفوع علي النظام`, `مقدار الاستخدام من المادة ${i + 1}`]).flat()];

/** Composite row: name, sku, category, retail, then 30 (sku, rate) slots. */
const compRow = (name: string, sku: string, cat: string, retail: number, slots: Record<number, [string, number]>) => {
  const row: unknown[] = [name, sku, cat, retail];
  for (let n = 1; n <= 30; n++) row.push(slots[n]?.[0] ?? '', slots[n]?.[1] ?? '');
  return row;
};

function workbook(extraRaw: unknown[][] = [], extraComp: unknown[][] = []) {
  const raw = [RAW_H,
    ['زيت دوار الشمس', '843258536022', 6.05, 24, 'خام'],
    ['سكر', '844429818874', 2.1, 65, 'خام'],
    ['Sauce', '00123', 0.5, 10, 'خام'],
    ['Last', 'RAW-30', 3, 1, 'خام'],
    ['', '', '', '', 'خام'],                        // a pre-filled template line
    // Thirty distinct materials for the 30-ingredient product (a SKU twice in
    // one product is a validation error). RAW-30 is above.
    ...Array.from({ length: 29 }, (_, i) => [`Material ${i + 1}`, `RAW-${i + 1}`, 1, 1, 'خام']),
    ...extraRaw];
  const comp = [COMP_H,
    compRow('Cake', 'C-1', 'Cakes', 230, { 1: ['843258536022', 0.5], 2: ['844429818874', 0.7] }),
    compRow('Gap', 'C-2', 'Cakes', 100, { 2: ['00123', 0.5], 3: ['843258536022', 1] }),
    compRow('Full', 'C-3', 'Cakes', 9999, Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, [`RAW-${i + 1}`, i + 1]]))),
    // Invalid: cost 1 × 6.05 = 6.05 > retail 5 → Validation Errors, not uploaded.
    compRow('Loser', 'C-4', 'Cakes', 5, { 1: ['843258536022', 1] }),
    ...extraComp];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), 'الخامات');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(comp), 'المنتج المجمع');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function validate(app: { goto(): Promise<void>; openTool(n: string): Promise<void> }, page: Page, buffer: Buffer, before?: () => Promise<void>) {
  await app.goto();
  await app.openTool('Composite Check');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'menu.xlsx', mimeType: XLSX_TYPE, buffer });
  await expect(page.locator('select').first().locator('option').nth(1)).toBeAttached();
  if (before) await before();
  await page.getByText(/^1\. /).first().click();
  const pending = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Validate Composite' }).click();
  return XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
}

async function ready(page: Page, which: 'Simple' | 'Composite') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: `Ready to upload - ${which}` }).click();
  const d = await pending;
  expect(d.suggestedFilename()).toBe(`Ready to upload - ${which} - menu.xlsx`);
  return XLSX.read(readFileSync((await d.path())!), { type: 'buffer' });
}

const grid = (wb: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as unknown[][];
const at = (rows: unknown[][], r: number, header: string) => rows[r][(rows[0] as string[]).indexOf(header)];

test.describe('Composite Check — Ready to upload', () => {
  test('Simple + Composite → two files on the exact templates, valid rows only, ProductN kept in place, all Identical', async ({ app, page }) => {
    test.setTimeout(120_000);
    const validated = await validate(app, page, workbook());

    // The panel: counts at a glance.
    await expect(page.getByLabel('Ready to upload')).toContainText('Simple: 33 raw materials (33 identical, 0 not). Composite: 3 valid products (3 identical, 0 not).');

    // ── Simple ──
    const simpleWb = await ready(page, 'Simple');
    expect(simpleWb.SheetNames).toEqual(['data']);
    const s = grid(simpleWb, 'data');
    expect(s[0]).toEqual(SIMPLE_T[0]);                  // headers: names and order
    expect(s[1]).toEqual(SIMPLE_T[1]);                  // the template's spec row
    expect(s).toHaveLength(2 + 33);                     // the template line was skipped
    expect([at(s, 2, 'Product Name'), at(s, 2, 'Product SKU'), at(s, 2, 'Cost'), at(s, 2, 'DEF Quantity'), at(s, 2, 'Category')])
      .toEqual(['زيت دوار الشمس', '843258536022', 6.05, 24, 'خام']);
    expect(at(s, 4, 'Product SKU')).toBe('00123');
    expect(simpleWb.Sheets.data[XLSX.utils.encode_cell({ r: 2, c: (s[0] as string[]).indexOf('Cost') })].t).toBe('n');

    // ── Composite ──
    const compWb = await ready(page, 'Composite');
    const c = grid(compWb, 'data');
    expect(c[0]).toEqual(COMPOSITE_T[0]);
    expect(c[1]).toEqual(COMPOSITE_T[1]);
    expect(c.slice(2).map((r) => r[1])).toEqual(['C-1', 'C-2', 'C-3']);   // C-4 failed validation
    expect([at(c, 2, 'Product Name'), at(c, 2, 'Category'), at(c, 2, 'Retail Price'), at(c, 2, 'Product1 SKU'), at(c, 2, 'Product1 Rate'), at(c, 2, 'Product2 SKU')])
      .toEqual(['Cake', 'Cakes', 230, '843258536022', 0.5, '844429818874']);
    // Slot 1 empty: Product1 stays empty, Product2/3 stay 2/3.
    expect([at(c, 3, 'Product1 SKU'), at(c, 3, 'Product1 Rate'), at(c, 3, 'Product2 SKU'), at(c, 3, 'Product2 Rate'), at(c, 3, 'Product3 SKU')])
      .toEqual([null, null, '00123', 0.5, '843258536022']);
    // All 30 pairs, each SKU and rate in its own slot; Product30 is RAW-30.
    for (let n = 1; n <= 30; n++) {
      expect(at(c, 4, `Product${n} SKU`)).toBe(`RAW-${n}`);
      expect(at(c, 4, `Product${n} Rate`)).toBe(n);
    }

    // ── The checks, in the validated workbook ──
    expect(validated.SheetNames.slice(-3)).toEqual(['Ready Mapping Audit', 'Ready Simple Check', 'Ready Composite Check']);
    const audit = grid(validated, 'Ready Mapping Audit');
    expect(audit).toHaveLength(1 + 5 + 4 + 60);
    expect(audit.slice(1).every((r) => r[5] === 'PASS')).toBe(true);
    expect(audit.find((r) => r[3] === 'DEF Quantity')).toEqual(['الخامات', 'الكمية حسب الوحدة المستخدمة', 'Simple', 'DEF Quantity', 'automatic', 'PASS']);
    expect(audit.find((r) => r[3] === 'Product30 Rate')).toEqual(['المنتج المجمع', 'مقدار الاستخدام من المادة 30', 'Composite', 'Product30 Rate', 'automatic', 'PASS']);
    expect(grid(validated, 'Ready Simple Check').slice(1).every((r) => r[3] === 'yes')).toBe(true);
    expect(grid(validated, 'Ready Composite Check').slice(1).map((r) => [r[1], r[3]])).toEqual([['C-1', 'yes'], ['C-2', 'yes'], ['C-3', 'yes']]);
  });

  test('a missing raw material and an unreadable cost are shown as not Identical, with the reason', async ({ app, page }) => {
    test.setTimeout(120_000);
    // "RAW-77" is in the Raw sheet only as a NAME. With "Auto-Detect / All Columns"
    // the structure check accepts it, so the row is valid — but it is not a material.
    const buffer = workbook([['RAW-77', 'X-5', 'abc', 1, 'خام']], [compRow('Odd', 'C-5', 'Cakes', 50, { 1: ['RAW-77', 1] })]);
    const validated = await validate(app, page, buffer, async () => {
      await page.locator('label:has-text("Raw Sheet SKU Column") + select').selectOption('-1');
      // No Cost & Profit here, so the Cost-above-Retail row (C-4) is valid too.
      await page.getByLabel('Raw Sheet: Cost Column').selectOption('-1');
    });
    await expect(page.getByLabel('Ready to upload')).toContainText('Simple: 34 raw materials (33 identical, 1 not). Composite: 5 valid products (4 identical, 1 not).');
    expect(grid(validated, 'Ready Simple Check').slice(1).find((r) => r[1] === 'X-5')).toEqual([36, 'X-5', 'RAW-77', 'no', "Cost 'abc' is not a number"]);
    expect(grid(validated, 'Ready Composite Check').slice(1).find((r) => r[1] === 'C-5'))
      .toEqual([6, 'C-5', 'Odd', 'no', "Product1 SKU 'RAW-77' is not a raw material in the Simple upload"]);
    // Nothing is invented in the upload file either: the cost stays the text it was.
    const s = grid(await ready(page, 'Simple'), 'data');
    expect(at(s, 35, 'Cost')).toBe('abc');
  });

  test('no numbered ingredient columns: no Ready to upload, and the validated export is exactly as before', async ({ app, page }) => {
    test.setTimeout(120_000);
    const wb0 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([['SKU', 'Name', 'Cost'], ['RAW-100', 'Bun', 1]]), 'Raw');
    XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([['Name', 'SKU', 'Retail Price', 'Unit', 'Ing SKU 1', 'Qty 1'], ['Burger', 'C-1', 20, 'pc', 'RAW-100', 2]]), 'Composite');
    const validated = await validate(app, page, Buffer.from(XLSX.write(wb0, { type: 'buffer', bookType: 'xlsx' })));
    expect(validated.SheetNames).toEqual(['Raw', 'Composite', 'Valid Products', 'Summary', 'Profit Analysis', 'Detailed BOM']);
    await expect(page.getByLabel('Ready to upload')).toHaveCount(0);
    await page.getByRole('button', { name: /logs/i }).first().click();
    await expect(page.getByText(/Ready to upload was not built: Composite sheet: no numbered ingredient columns were recognised/)).toBeVisible();
  });
});
