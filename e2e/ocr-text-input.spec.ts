/**
 * OCR Extraction with spreadsheet and Word input — the whole pipeline, in a
 * real browser, with the model call intercepted instead of reaching Gemini.
 *
 * Intercepting it lets the test check both ends of the claim these formats
 * join the SAME pipeline as images and PDFs:
 *   - the file's CONTENT really reaches the model, inside the tab's own prompt;
 *   - the model's answer then flows through the ordinary post-processing and
 *     export into the downloaded workbook.
 *
 * No real key or network: the fixture seeds a placeholder key, and every
 * `generateContent` request is answered here.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';

/** What the "model" returns. Deliberately different from the input text, so a
 *  row in the export proves the answer was used, not merely echoed. */
const ANSWER = [
  { 'Product Name': 'شاي | Tea', 'Retail Price': 13, Category: 'Drinks', Type: 'Simple' },
  { 'Product Name': 'قهوة | Coffee', 'Retail Price': 15, Category: 'Drinks', Type: 'Simple' },
];

/** Answer every model call with ANSWER, recording what was sent. */
async function interceptModel(page: Page): Promise<string[]> {
  const sent: string[] = [];
  await page.route('**/*:generateContent*', async (route) => {
    sent.push(JSON.stringify(route.request().postDataJSON()));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(ANSWER) }] } }],
      }),
    });
  });
  return sent;
}

function menuXlsx(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([['Item', 'Price'], ['Hibiscus Tea', 9], ['كركديه', 9]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Menu');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function menuDocx(): Promise<Buffer> {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const cell = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  const body = `<w:p><w:r><w:t>Summer Menu</w:t></w:r></w:p>`
    + `<w:tbl><w:tr>${cell('Mango Juice')}${cell('12')}</w:tr><w:tr>${cell('عصير مانجو')}${cell('12')}</w:tr></w:tbl>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

/** The OCR tab's own input: the only one whose accept list includes .docx. */
const ocrInput = (page: Page) => page.locator('input[type="file"][accept*=".docx"]');

async function openOcr(app: any, page: Page) {
  await app.goto();
  await app.openToolMatching(/OCR Extraction/);
  await expect(ocrInput(page)).toHaveCount(1);
}

/**
 * Extract, and take the workbook the OCR → Rewaa run downloads BY ITSELF
 * (D9 reversed for this workflow, 2026-09-30). Then confirm it downloaded
 * exactly once: there is no event for "no second download", so the absence
 * check is a short bounded wait after the first.
 */
async function extractAndDownload(page: Page, stem: string): Promise<XLSX.WorkBook> {
  const auto = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: /Start Extraction/i }).click();
  const download = await auto;
  expect(download.suggestedFilename()).toMatch(/^OCR-Rewaa-.+-\d{8}-\d{6}\.xlsx$/);
  expect(download.suggestedFilename().startsWith(`OCR-Rewaa-${stem}-`)).toBe(true);
  let extra = 0;
  page.on('download', () => { extra++; });
  await expect(page.getByTestId('ocr-rewaa-result')).toContainText('File downloaded automatically');
  await page.waitForTimeout(1_500);
  expect(extra, 'the run downloaded more than once').toBe(0);
  return XLSX.read(readFileSync((await download.path())!), { type: 'buffer' });
}

const namesIn = (wb: XLSX.WorkBook) =>
  (XLSX.utils.sheet_to_json(wb.Sheets['Generic All Data']) as Record<string, unknown>[]).map((r) => r['Product Name']);

test.describe('OCR Extraction — spreadsheet and Word input', () => {
  test('.xlsx: its cells reach the model, and the answer reaches the export', async ({ app, page }) => {
    test.setTimeout(120_000);
    const sent = await interceptModel(page);
    await openOcr(app, page);
    await ocrInput(page).setInputFiles({
      name: 'menu.xlsx', buffer: menuXlsx(),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const wb = await extractAndDownload(page, 'menu');

    expect(sent, 'the file was never sent to the model').toHaveLength(1);
    expect(sent[0]).toContain('Hibiscus Tea');   // the spreadsheet's content …
    expect(sent[0]).toContain('كركديه');          // … Arabic included
    expect(sent[0]).not.toContain('inlineData');  // sent as TEXT, not as an opaque media blob
    // English first on every bilingual cell, whatever order the model used.
    expect(namesIn(wb)).toEqual(['Tea | شاي', 'Coffee | قهوة']);
  });

  test('.docx: paragraphs and table cells reach the model as text', async ({ app, page }) => {
    test.setTimeout(120_000);
    const sent = await interceptModel(page);
    await openOcr(app, page);
    await ocrInput(page).setInputFiles({
      name: 'menu.docx', buffer: await menuDocx(),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const wb = await extractAndDownload(page, 'menu');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('Summer Menu');
    expect(sent[0]).toContain('عصير مانجو');
    // The table row arrives as columns: cell, TAB, cell. (JSON-escaped here.)
    expect(sent[0]).toContain('Mango Juice\\t12');
    expect(namesIn(wb)).toHaveLength(2);
  });

  test('legacy .doc is refused with an explanation, and nothing is sent', async ({ app, page }) => {
    test.setTimeout(60_000);
    const sent = await interceptModel(page);
    await openOcr(app, page);
    await ocrInput(page).setInputFiles({
      name: 'old.doc', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), mimeType: 'application/msword',
    });
    // Logs sit behind a toggle on this tab, as every other message does.
    await page.getByRole('button', { name: /Show Logs/i }).click();
    await expect(page.getByText(/legacy Word \.doc files cannot be read/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Extraction/i })).toBeDisabled();
    expect(sent).toHaveLength(0);
  });
});
