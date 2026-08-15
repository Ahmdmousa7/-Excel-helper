/**
 * Composite Check: an ingredient quantity must be strictly greater than zero.
 *
 * Zero and negative both used to pass silently, and silently is the problem.
 * `"0"` and `"-5"` are neither empty nor NaN, so the Missing-Qty and
 * Non-numeric-Qty checks both ignored them, and the row landed in "Valid
 * Products" while declaring that the composite uses none of an ingredient it
 * names — or a negative amount of one, which on import subtracts stock and
 * produces a negative line cost.
 *
 * The numeric edges (0.0, -0, 1e-3, Infinity) are covered directly in
 * `tests/unit/quantityRule.test.ts`, which is fast and exhaustive. This spec
 * exists for the half a unit test cannot reach: that the verdict becomes the
 * right message, in both languages, against the right cell, in the workbook the
 * user actually downloads.
 *
 * No `waitForTimeout` anywhere below: see TD-040.
 */
import { test, expect } from './fixtures';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

/** Four fixed columns (the component's default) then (Ingredient SKU, Qty) pairs. */
function makeCompositeFile() {
  const composite = [
    ['Product Name', 'Product SKU', 'Category', 'Unit', 'Ing SKU 1', 'Qty 1', 'Ing SKU 2', 'Qty 2'],
    // Positive, whole and decimal — the only valid shape.
    ['Burger', 'COMP-001', 'Food', 'pc', 'RAW-100', '2', 'RAW-200', '1.5'],
    // Zero, plain.
    ['Pizza', 'COMP-002', 'Food', 'pc', 'RAW-100', '0', 'RAW-300', '3'],
    // Zero written as a decimal — a string check for "0" would miss it.
    ['Salad', 'COMP-003', 'Food', 'pc', 'RAW-400', '1.5', 'RAW-500', '0.0'],
    // Negative integer.
    ['Wrap', 'COMP-004', 'Food', 'pc', 'RAW-100', '-3', 'RAW-200', '2'],
    // Negative decimal.
    ['Soup', 'COMP-005', 'Food', 'pc', 'RAW-300', '-0.25', 'RAW-400', '1'],
  ];
  const raw = [
    ['SKU', 'Name', 'Cost'],
    ['RAW-100', 'Bun', '1'],
    ['RAW-200', 'Patty', '5'],
    ['RAW-300', 'Cheese', '2'],
    ['RAW-400', 'Lettuce', '1'],
    ['RAW-500', 'Tomato', '1'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(composite), 'Composite');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), 'Raw');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const COLUMNS = [
  '1. Product Name', '2. Product SKU', '3. Category', '4. Unit',
  '5. Ing SKU 1', '6. Qty 1', '7. Ing SKU 2', '8. Qty 2',
];

test.describe('Composite Check — quantity must be greater than zero', () => {
  test('flags zero and negative, and leaves positive alone', async ({ app, page }) => {
    test.setTimeout(120_000);

    await app.goto();
    await app.openTool('Composite Check');

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'composite.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: makeCompositeFile(),
    });

    // Both sheet pickers appear only once the workbook has parsed, so waiting for
    // the option to exist is the signal that parsing finished.
    const sheetSelects = page.locator('select');
    await expect(sheetSelects.first().locator('option', { hasText: 'Composite' })).toHaveCount(1);
    await sheetSelects.nth(0).selectOption({ label: 'Composite' });
    await sheetSelects.nth(1).selectOption({ label: 'Raw' });

    // The tool refuses to run until columns are chosen — it logs
    // "Select columns to validate." and does nothing else.
    for (const label of COLUMNS) {
      await page.getByText(label, { exact: true }).first().click();
    }

    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Validate Composite' }).click();
    const file = await download;

    const wb = XLSX.read(readFileSync((await file.path())!), { type: 'buffer' });
    const errors = XLSX.utils.sheet_to_json(wb.Sheets['Validation Errors'], {
      header: 1,
      raw: false,
    }) as string[][];
    const valid = XLSX.utils.sheet_to_json(wb.Sheets['Valid Products'], {
      header: 1,
      raw: false,
    }) as string[][];

    const errorText = errors.map((r) => r.join(' | ')).join('\n');

    // ZERO, both spellings, each against the quantity cell rather than the row —
    // F3 is Pizza's first quantity, H4 is Salad's second. A reference to the
    // wrong cell is worse than none.
    expect(errorText).toContain("Zero Qty '0'");
    expect(errorText).toContain("Zero Qty '0.0'");
    expect(errorText).toContain('F3');
    expect(errorText).toContain('H4');

    // NEGATIVE, integer and decimal, with their own message — a sign error is a
    // different mistake from a leftover line and deserves a different sentence.
    expect(errorText).toContain("Negative Qty '-3'");
    expect(errorText).toContain("Negative Qty '-0.25'");
    expect(errorText).toContain('F5');
    expect(errorText).toContain('F6');

    // Both Arabic messages: this tool's users read that column.
    expect(errorText).toContain('مقدار الاستخدام من المادة يساوي صفر');
    expect(errorText).toContain('مقدار الاستخدام من المادة بالسالب');

    // SELECTIVE. A rule that flags everything is as useless as one that flags
    // nothing: the all-positive row must come through clean, decimal included.
    expect(valid.map((r) => r[1])).toContain('COMP-001');
    expect(errorText).not.toContain('COMP-001');
    expect(errorText).not.toContain("Qty '2'");
    expect(errorText).not.toContain("Qty '1.5'");

    // Every offending row is reported, and no more than those.
    for (const sku of ['COMP-002', 'COMP-003', 'COMP-004', 'COMP-005']) {
      expect(errorText, `${sku} should be reported`).toContain(sku);
    }
  });
});
