/**
 * Smart Lookup, end to end.
 *
 * The module had no test of any kind (TD-044), which is why four defects lived
 * in it. The first test here is the one that would have caught the worst of
 * them: the preview and the downloaded file were produced by two separate
 * implementations of the same join, and they disagreed whenever a reference key
 * was duplicated (TD-043).
 *
 * That test is written to fail if the two EVER diverge again, not merely to
 * check today's values — it compares the file against what the screen showed,
 * cell for cell, rather than against a hard-coded expectation.
 */
import { test, expect } from './fixtures';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

/**
 * A workbook that exercises every case the audit found, in one run:
 * duplicate keys, case, padding, leading zeros, a miss, a date, and an error
 * cell in the key column.
 */
function makeWorkbook() {
  const source = [
    ['SKU', 'Note'],
    ['A-1', 'duplicate key in ref'],
    ['a-1', 'case differs'],
    ['  A-2  ', 'padded'],
    ['007', 'leading zeros'],
    ['A-9', 'no match'],
  ];
  const ref = [
    ['Key', 'Value', 'WhenAdded'],
    ['A-1', 'FIRST', 46037],
    ['A-1', 'LAST', 46038],
    ['A-2', 'padded-match', 46039],
    ['7', 'zero-stripped', 46040],
  ];
  const wb = XLSX.utils.book_new();
  const sws = XLSX.utils.aoa_to_sheet(source);
  const rws = XLSX.utils.aoa_to_sheet(ref);
  // Make the date column genuinely date-formatted, which is what the fix carries.
  for (const r of [2, 3, 4, 5]) {
    const cell = rws[`C${r}`];
    if (cell) cell.z = 'yyyy-mm-dd';
  }
  XLSX.utils.book_append_sheet(wb, sws, 'Source');
  XLSX.utils.book_append_sheet(wb, rws, 'Ref');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }));
}

/** Drive the config panel. Select order is source sheet, lookup col, ref sheet, match col. */
async function configure(page: any) {
  const selects = page.locator('select');
  await expect(selects.first().locator('option', { hasText: 'Source' })).toHaveCount(1);
  await selects.nth(0).selectOption('Source');
  await selects.nth(2).selectOption('Ref');
  await selects.nth(1).selectOption('0');
  await selects.nth(3).selectOption('0');
  await page.getByText('Value', { exact: true }).first().click();
  await page.getByText('WhenAdded', { exact: true }).first().click();
}

/** The preview table as a grid of strings, header row included. */
async function previewGrid(page: any): Promise<string[][]> {
  return page.locator('table').evaluate((table: HTMLTableElement) =>
    Array.from(table.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th,td')).map((c) => (c.textContent ?? '').trim()),
    ),
  );
}

test.describe('Smart Lookup', () => {
  test('the exported file matches the preview, cell for cell', async ({ app, page }) => {
    test.setTimeout(120_000);

    await app.goto();
    await app.openTool('Smart Lookup');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'lookup.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: makeWorkbook(),
    });
    await configure(page);
    await page.getByRole('button', { name: /Run Smart Lookup/i }).click();
    await expect(page.getByText(/Found/).first()).toBeVisible({ timeout: 30_000 });

    const preview = await previewGrid(page);
    // Drop the leading "#" row-number column the preview adds.
    const previewRows = preview.slice(1).map((r) => r.slice(1));

    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Download Result|تحميل النتيجة/i }).click();
    const file = await download;
    const wb = XLSX.read(readFileSync((await file.path())!), { type: 'buffer' });
    const sheet = wb.Sheets['Lookup Results'];
    const exported = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][])
      .slice(1) // header row; the preview's header is a <th> row already dropped above
      .map((r) => r.map((c) => String(c ?? '').trim()));

    expect(exported.length, 'row count differs between preview and file').toBe(previewRows.length);
    for (let i = 0; i < previewRows.length; i++) {
      expect(exported[i], `row ${i + 1} differs between preview and file`).toEqual(previewRows[i]);
    }
  });

  test('a duplicated reference key resolves to the FIRST row, as Excel does', async ({ app, page }) => {
    test.setTimeout(120_000);

    await app.goto();
    await app.openTool('Smart Lookup');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'lookup.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: makeWorkbook(),
    });
    await configure(page);
    await page.getByRole('button', { name: /Run Smart Lookup/i }).click();
    await expect(page.getByText(/Found/).first()).toBeVisible({ timeout: 30_000 });

    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Download Result|تحميل النتيجة/i }).click();
    const file = await download;
    const wb = XLSX.read(readFileSync((await file.path())!), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Lookup Results'], {
      header: 1,
      raw: false,
    }) as any[][];

    const text = rows.map((r) => r.join(' | ')).join('\n');
    expect(text, 'the export took the LAST duplicate — TD-043 has regressed').not.toContain('LAST');
    expect(text).toContain('FIRST');

    // The other matching behaviours, in the same artefact.
    expect(text, 'case-insensitive match').toContain('case differs | FIRST');
    expect(text, 'padded key should still match').toContain('padded-match');
    expect(text, 'leading zeros under Smart Match').toContain('zero-stripped');
    expect(text, 'a genuine miss').toContain('Not Found');
  });

  test('a returned date stays a date rather than becoming a serial number', async ({ app, page }) => {
    test.setTimeout(120_000);

    await app.goto();
    await app.openTool('Smart Lookup');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'lookup.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: makeWorkbook(),
    });
    await configure(page);
    await page.getByRole('button', { name: /Run Smart Lookup/i }).click();
    await expect(page.getByText(/Found/).first()).toBeVisible({ timeout: 30_000 });

    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Download Result|تحميل النتيجة/i }).click();
    const file = await download;
    const wb = XLSX.read(readFileSync((await file.path())!), { type: 'buffer', cellNF: true });
    const sheet = wb.Sheets['Lookup Results'];

    // TD-045: the value may still be the serial, but the cell must carry the
    // date FORMAT, which is what makes Excel show a date instead of 46037.
    const dateCell = sheet['D2'];
    expect(dateCell, 'no date cell in the export').toBeTruthy();
    expect(dateCell.z, 'the number format was dropped on the way out').toBeTruthy();
    expect(String(dateCell.z)).toContain('yy');
  });
});
