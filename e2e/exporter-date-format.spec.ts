/**
 * REPRODUCTION of the exporter date-format loss, end to end.
 *
 * `tests/unit/exporterDateFormat.test.ts` proves the mechanism at the two shared
 * choke points. This proves it reaches a **file a user actually downloads**,
 * through a real module, in a real browser — which is the part a unit test
 * cannot claim.
 *
 * Remove Blanks is the subject because it is the purest case: it reads with
 * `raw: true` and copies every surviving column through
 * `exportToExcelSingleSheet` verbatim, so nothing else can be blamed for the
 * result. See `docs/modules/exporter-date-format-audit.md`.
 *
 * Tracked as **TD-049**.
 *
 * `test.fail()` is deliberate. The assertion inside describes the behaviour we
 * WANT; it does not hold today. Playwright passes an expected-failure test while
 * it fails, so the suite stays green — and **fails the moment someone fixes the
 * exporter**, which is the signal to delete the marker and keep the assertion.
 * A plain `test()` here would leave the gate permanently red for a known,
 * accepted, not-yet-scheduled defect, and a routinely red gate gets bypassed.
 *
 * NO PRODUCTION BEHAVIOUR IS CHANGED BY THIS FILE.
 */
import { test, expect, TOOL, AppShell } from './fixtures';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';

const DATE_SERIAL = 46037; // 2026-01-15
const DATE_FMT = 'yyyy-mm-dd';

/** A workbook with one genuinely date-formatted column and no empty columns. */
function makeDatedWorkbook() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['SKU', 'WhenAdded'],
    ['A-1', DATE_SERIAL],
    ['A-2', DATE_SERIAL + 1],
  ]);
  ws['B2'].z = DATE_FMT;
  ws['B3'].z = DATE_FMT;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }));
}

/** Upload the dated workbook to Remove Blanks and return the exported sheet. */
async function exportThroughRemoveBlanks(app: AppShell, page: Page) {
  await app.goto();
  await app.openTool(TOOL.removeBlanks);

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'dated.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: makeDatedWorkbook(),
  });

  // Two steps: 'Scrub Clean' processes, then 'Download All Files' exports.
  await page.getByRole('button', { name: 'Scrub Clean' }).click();
  const downloadBtn = page.getByRole('button', { name: /Download All Files/i });
  await downloadBtn.waitFor({ state: 'visible', timeout: 30_000 });

  const download = page.waitForEvent('download', { timeout: 60_000 });
  await downloadBtn.click();
  const file = await download;

  // `cellNF: true` is required to read `z` back at all — without it every
  // format assertion reports undefined and looks like a failure when it is not.
  const wb = XLSX.read(readFileSync((await file.path())!), { type: 'buffer', cellNF: true });
  return wb.Sheets[wb.SheetNames[0]];
}

test.describe('Exporter date format — reproduction', () => {
  test('the date VALUE survives the export, so this is formatting loss, not data loss', async ({ app, page }) => {
    test.setTimeout(120_000);
    const sheet = await exportThroughRemoveBlanks(app, page);

    // Find the exported date cell wherever the column landed.
    //
    // This asserts the serial EXACTLY, which is only safe because
    // `playwright.config.ts` pins `timezoneId: 'UTC'`. SheetJS round-trips
    // serials through local time, so in a non-UTC browser the value comes back
    // fractionally heavy (46037.000104… at UTC+3) and this would fail. If the
    // timezone pin is ever removed, compare with Math.floor instead.
    // See tests/unit/exporterDateFormat.test.ts, where the same assumption
    // shipped as a real bug.
    const cells = Object.keys(sheet).filter((k) => !k.startsWith('!'));
    const values = cells.map((k) => sheet[k].v);
    expect(values, 'the date serial is missing from the export entirely').toContain(DATE_SERIAL);
  });

  test.fail('DESIRED: a date column keeps its format through the export', async ({ app, page }) => {
    test.setTimeout(120_000);
    const sheet = await exportThroughRemoveBlanks(app, page);

    const dateCell = Object.keys(sheet)
      .filter((k) => !k.startsWith('!'))
      .map((k) => sheet[k])
      .find((c) => c.v === DATE_SERIAL);

    expect(dateCell, 'no cell holds the date serial').toBeTruthy();
    // The assertion that does not hold today: `aoa_to_sheet` writes the value
    // with no format, so the original `yyyy-mm-dd` comes back as SheetJS's
    // default `m/d/yy`. (An earlier version of this comment claimed Excel shows
    // `46037` — that is the retracted prediction this very file disproved.)
    expect(dateCell.z, 'the number format was dropped on the way out').toBe(DATE_FMT);
  });

  test('CURRENT behaviour: the date renders, but in the DEFAULT format not the original', async ({ app, page }) => {
    test.setTimeout(120_000);
    const sheet = await exportThroughRemoveBlanks(app, page);

    const dateCell = Object.keys(sheet)
      .filter((k) => !k.startsWith('!'))
      .map((k) => sheet[k])
      .find((c) => c.v === DATE_SERIAL);

    // Characterisation. The prediction was that this would read '46037'; it does
    // not — SheetJS hands raw mode a Date object, so a real date is written back
    // with its DEFAULT format. That is the measured defect: 'yyyy-mm-dd' became
    // 'm/d/yy'. See the retraction in the audit document.
    expect(dateCell?.w, 'expected a rendered date, not a serial').toContain('26');
    expect(dateCell?.w, 'the serial should not be visible').not.toBe('46037');
    expect(dateCell?.z, 'the original format should have been replaced').toBe('m/d/yy');
  });
});

test.describe('TD-049 — Separator, the second consumer of exportToExcelSingleSheet', () => {
  /**
   * Remove Blanks is covered above; this covers Separator, the purest of the
   * three — it copies whole rows into one file per sheet with no transformation.
   *
   * **Merge Datasets, the third consumer, is NOT covered end to end.** Its
   * separate-files ZIP mode reaches the same helper, and the helper is unit
   * tested across seven timezones, but no browser test drives Merge's
   * multi-file upload and output-mode selection. Stated rather than implied,
   * because a describe that claims more coverage than it has is how a gap
   * survives review.
   *
   * These assert the FIXED behaviour (TD-049) — exact serial, correct rendered
   * day. Playwright pins `timezoneId: 'UTC'`, where the old code was already
   * correct, so these guard against regression rather than reproducing the bug;
   * the timezone dimension is covered by the unit suite, which is run under
   * seven zones.
   */
  test('Separator: a dated column survives the ZIP export exactly', async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.goto();
    await app.openTool(TOOL.separator);

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'dated.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: makeDatedWorkbook(),
    });

    const btn = page.getByRole('button', { name: /Download ZIP Repository/i });
    await btn.waitFor({ state: 'visible', timeout: 30_000 });
    const download = page.waitForEvent('download', { timeout: 60_000 });
    await btn.click();
    const file = await download;

    // One .xlsx per sheet, inside a ZIP.
    const zip = await JSZip.loadAsync(readFileSync((await file.path())!));
    const entry = Object.keys(zip.files).find((n) => n.endsWith('.xlsx'));
    expect(entry, 'the ZIP contains no .xlsx').toBeTruthy();

    const inner = await zip.files[entry!].async('nodebuffer');
    const wb = XLSX.read(inner, { type: 'buffer', cellNF: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // Match within a day, NOT `Math.floor(...) === DATE_SERIAL`. If the bug
    // returns with NEGATIVE drift (46036.9997, which is what UTC-11 produced)
    // floor gives 46036, the find misses, and the test fails with "no cell holds
    // the date serial" — blaming the wrong thing entirely. A guard that reports
    // the wrong cause when it fires is worse than no guard.
    const cell = Object.keys(sheet)
      .filter((k) => !k.startsWith('!'))
      .map((k) => sheet[k])
      .find((c) => typeof c.v === 'number' && Math.abs(c.v - DATE_SERIAL) < 1);

    expect(cell, 'no cell holds anything near the date serial').toBeTruthy();
    expect(cell.v, 'the serial drifted — TD-049 has regressed').toBe(DATE_SERIAL);
    expect(cell.w, 'the rendered day is wrong — TD-049 has regressed').toContain('15');
  });
});
