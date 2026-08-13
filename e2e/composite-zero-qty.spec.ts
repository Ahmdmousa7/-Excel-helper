/**
 * Composite Check: an ingredient quantity of zero is an error.
 *
 * It used to pass silently, and silently is the problem. `"0"` is not empty, so
 * the Missing-Qty check ignored it; `Number("0")` is not NaN, so the
 * Non-numeric-Qty check ignored it too. The row landed in "Valid Products"
 * while declaring that the composite uses NONE of an ingredient it names — a
 * typo or a half-deleted line, which on import becomes a BOM entry contributing
 * nothing at a line cost of zero.
 *
 * Driven end to end rather than unit-tested because the rule lives inline in
 * `CompositeTab`'s validation pass, and the thing worth protecting is what
 * reaches the exported workbook — which is where a user actually meets it.
 *
 * No `waitForTimeout` anywhere below: see TD-040, where a fixed sleep followed
 * by a single measurement was the one flake in this suite that was ever proven.
 */
import { test, expect } from './fixtures';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

/** Four fixed columns (the component's default) then (Ingredient SKU, Qty) pairs. */
function makeCompositeFile() {
  const composite = [
    ['Product Name', 'Product SKU', 'Category', 'Unit', 'Ing SKU 1', 'Qty 1', 'Ing SKU 2', 'Qty 2'],
    ['Burger', 'COMP-001', 'Food', 'pc', 'RAW-100', '2', 'RAW-200', '1'],
    // Plain zero.
    ['Pizza', 'COMP-002', 'Food', 'pc', 'RAW-100', '0', 'RAW-300', '3'],
    // Zero written as a decimal — a string check for "0" would miss this one.
    ['Salad', 'COMP-003', 'Food', 'pc', 'RAW-400', '1.5', 'RAW-500', '0.0'],
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

test.describe('Composite Check — zero quantity', () => {
  test('reports a zero ingredient quantity and keeps the valid row valid', async ({ app, page }) => {
    test.setTimeout(120_000);

    await app.goto();
    await app.openTool('Composite Check');

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'composite.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: makeCompositeFile(),
    });

    // Both sheet pickers appear only once the workbook has parsed, so waiting
    // for the option to exist is the signal that parsing finished.
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

    // Both zeroes are caught, and the cell reference points at the QUANTITY
    // cell rather than the row — F3 is Pizza's first quantity, H4 is Salad's
    // second. A reference to the wrong cell is worse than none.
    expect(errorText).toContain("Zero Qty '0'");
    expect(errorText).toContain("Zero Qty '0.0'");
    expect(errorText).toContain('F3');
    expect(errorText).toContain('H4');
    // The Arabic column is not decoration: this tool's users read that one.
    expect(errorText).toContain('مقدار الاستخدام من المادة يساوي صفر');

    // The point of the check is that it is SELECTIVE. A rule that flags
    // everything is as useless as one that flags nothing.
    expect(valid.map((r) => r[1])).toContain('COMP-001');
    expect(errorText).not.toContain('COMP-001');

    // And it must not have swallowed the pre-existing rules on the way past:
    // a real quantity is still a quantity.
    expect(errorText).not.toContain("Zero Qty '2'");
    expect(errorText).not.toContain("Zero Qty '1.5'");
  });
});
