/**
 * TD-050, end to end: an Arabic CSV WITHOUT a byte-order mark — what Google
 * Sheets exports — must come out of the app still Arabic.
 *
 * Two different read paths, because the defect lived in more than one place:
 *   - Remove Blanks reads through the shared `readExcelFile`;
 *   - Files Validation has its OWN reader, which parsed a binary string.
 * Both used to hand SheetJS raw bytes, which decodes a CSV as Latin-1 and turns
 * `حوار بلدي` into mojibake. Assertions are on the file the user downloads.
 */
import { test, expect, TOOL } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const NAME = 'حوار بلدي الكيلو';
const CATEGORY = 'اللحوم الطازجة';

/** UTF-8 with NO BOM — TextEncoder never writes one. */
const csvBytes = (text: string) => Buffer.from(new TextEncoder().encode(text));

/**
 * `which` matters. The app's SHARED uploader is the first file input and reads
 * through readExcelFile; Files Validation also renders its OWN input, later in
 * the DOM, with its own reader. Both have the same `accept`, so position is the
 * only handle — and a mutation test is what proves each test hits its path.
 */
async function upload(page: Page, text: string, which: 'shared' | 'module' = 'shared') {
  const inputs = page.locator('input[type="file"]');
  await (which === 'shared' ? inputs.first() : inputs.last()).setInputFiles({
    name: 'products.csv', mimeType: 'text/csv', buffer: csvBytes(text),
  });
}

async function downloadVia(page: Page, button: RegExp): Promise<XLSX.WorkBook> {
  const btn = page.getByRole('button', { name: button });
  await btn.waitFor({ state: 'visible', timeout: 30_000 });
  const pending = page.waitForEvent('download', { timeout: 60_000 });
  await btn.click();
  return XLSX.read(readFileSync((await (await pending).path())!), { type: 'buffer' });
}

const allText = (wb: XLSX.WorkBook) =>
  wb.SheetNames.flatMap((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) as unknown[][])
    .flat().map(String);

test.describe('TD-050 — Arabic CSVs survive upload', () => {
  test('through the shared reader (Remove Blanks)', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.goto();
    await app.openTool(TOOL.removeBlanks);
    await upload(page, `Product Name,Category,Price\n${NAME},${CATEGORY},75\n`);
    await page.getByRole('button', { name: 'Scrub Clean' }).click();

    const text = allText(await downloadVia(page, /Download All Files/i));
    expect(text).toContain(NAME);
    expect(text).toContain(CATEGORY);
  });

  test('through Files Validation’s OWN reader, not the shared one', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.goto();
    await app.openToolMatching(/Files Validation/);
    await upload(page, `Name,SKU,Barcode,Retail Price,Cost\n${NAME},S-1,6287013210006,75,50\n`, 'module');
    await page.getByRole('button', { name: /Run Validation/i }).click();

    const text = allText(await downloadVia(page, /Export Report/i));
    expect(text).toContain(NAME);
  });
});
