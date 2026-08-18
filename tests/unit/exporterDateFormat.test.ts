import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import { appendSheet, createWorkbook } from '../../services/excelService';
import { exportToExcelSingleSheet } from '../../utils/excelUtils';
import { readGrid, writeSheet } from '../../utils/lookupEngine';

/**
 * REPRODUCTION of what exporters actually do to dates. **No exporter behaviour
 * is changed by this file.**
 *
 * It exists because the static audit predicted the wrong failure, twice. Every
 * assertion here was measured, and the corrections are the point:
 *
 *   1. **Nothing exports `46037`.** `sheet_to_json({ raw: true })` returns a JS
 *      `Date` for a date-formatted cell, and `aoa_to_sheet` writes a Date back
 *      as a real date cell. The audit's headline claim was wrong and is retracted.
 *   2. **The real, universal defect is format fidelity:** the original format is
 *      replaced by SheetJS's default `m/d/yy`. That is what matters here, because
 *      a sheet authored `dd/mm/yyyy` comes back `m/d/yy` — 25/12/2026 renders as
 *      12/25/26. The value is right; the reading convention flips.
 *   3. **The two shared writers differ**, which no amount of reading predicted:
 *      the xlsx-js-style writer adds a fractional time component and shifts the
 *      1900 epoch boundary; the plain writer does neither.
 *
 * `it.fails(...)` marks an assertion describing behaviour we WANT that does not
 * hold today. Vitest passes it while the assertion fails, so the suite stays
 * green over a known, accepted, unscheduled defect — and **fails the moment
 * someone fixes it**, which is the signal to drop the marker.
 */

const SERIAL = 46037; // 2026-01-15
const ORIGINAL_FMT = 'yyyy-mm-dd';
const SHEETJS_DEFAULT = 'm/d/yy';

function datedFile(serial = SERIAL, fmt = ORIGINAL_FMT) {
  const ws = XLSX.utils.aoa_to_sheet([['SKU', 'WhenAdded'], ['A-1', serial]]);
  ws.B2.z = fmt;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

/** Parse exactly as `readExcelFile` does. */
const parseLikeTheApp = (buf: any) => XLSX.read(buf, { type: 'buffer', raw: true, cellNF: true });
/** Read exactly as `getSheetData(wb, name, raw)` does. */
const rowsLikeTheApp = (ws: any, raw: boolean) =>
  XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw }) as any[][];
/** `cellNF: true` is required to read `z` back at all. */
const roundTrip = (wb: any) =>
  XLSX.read(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }), { type: 'buffer', cellNF: true });

describe('what a module actually receives for a date cell', () => {
  it('the parsed cell has both value and original format', () => {
    const cell = parseLikeTheApp(datedFile()).Sheets.Data.B2;
    expect(cell.v).toBe(SERIAL);
    expect(cell.z).toBe(ORIGINAL_FMT);
  });

  it('raw mode yields a Date OBJECT, not the serial — the fact the audit missed', () => {
    const row = rowsLikeTheApp(parseLikeTheApp(datedFile()).Sheets.Data, true)[1];
    expect(row[1]).toBeInstanceOf(Date);
  });

  it('text mode yields a display STRING', () => {
    const row = rowsLikeTheApp(parseLikeTheApp(datedFile()).Sheets.Data, false)[1];
    expect(typeof row[1]).toBe('string');
    expect(row[1]).toContain('2026');
  });
});

describe('raw-mode exporters via appendSheet (Compare, Deduplicator, Merge, Salla, Zid)', () => {
  function reExport(serial = SERIAL) {
    const rows = rowsLikeTheApp(parseLikeTheApp(datedFile(serial)).Sheets.Data, true);
    const wb = createWorkbook();
    appendSheet(wb, rows, 'Out');
    return roundTrip(wb).Sheets.Out.B2;
  }

  it('the date SURVIVES as a date — it is NOT exported as 46037', () => {
    // Permanent guard against the retracted claim creeping back into the docs.
    const cell = reExport();
    expect(cell.t).toBe('n');
    expect(cell.w).not.toBe('46037');
    expect(cell.w).toContain('26');
  });

  it('the serial value is preserved exactly on this path', () => {
    expect(reExport().v).toBe(SERIAL);
  });

  it('the 1900 epoch boundary is NOT shifted on this path', () => {
    expect(reExport(1).v).toBe(1);
  });

  it('DEFECT: the original format is replaced by the SheetJS default', () => {
    // The one real, reproducible loss on this path. `yyyy-mm-dd` → `m/d/yy`.
    expect(reExport().z).toBe(SHEETJS_DEFAULT);
  });

  it.fails('DESIRED: the original format survives the export', () => {
    expect(reExport().z).toBe(ORIGINAL_FMT);
  });

  it('DEFECT, stated as a user would see it: a dd/mm sheet comes back m/d', () => {
    // Why this matters more here than it might elsewhere: an audience writing
    // dd/mm/yyyy reads 12/25/26 as an invalid date, or worse, as 12 December.
    const rows = rowsLikeTheApp(parseLikeTheApp(datedFile(SERIAL, 'dd/mm/yyyy')).Sheets.Data, true);
    const wb = createWorkbook();
    appendSheet(wb, rows, 'Out');
    expect(roundTrip(wb).Sheets.Out.B2.z).toBe(SHEETJS_DEFAULT);
  });
});

describe('raw-mode exporters via exportToExcelSingleSheet (Remove Blanks, Separator)', () => {
  function reExport(serial = SERIAL) {
    const rows = rowsLikeTheApp(parseLikeTheApp(datedFile(serial)).Sheets.Data, true);
    const buf = exportToExcelSingleSheet(rows, 'Out');
    return XLSX.read(buf, { type: 'array', cellNF: true }).Sheets.Out.B2;
  }

  it('the date survives, and the calendar day is right for a realistic date', () => {
    expect(reExport().w).toContain('26');
  });

  it('DEFECT: the format is replaced, same as the other writer', () => {
    expect(reExport().z).toBe(SHEETJS_DEFAULT);
  });

  it('DEFECT unique to this writer: the value gains a fractional time component', () => {
    // 46037 → 46037.000104…, roughly 9 seconds. The calendar day is unaffected
    // (an integer plus 9s stays the same day), but the cell is no longer a clean
    // date serial, so an exact comparison against a date will now miss.
    const v = reExport().v as number;
    expect(Math.floor(v)).toBe(SERIAL);
    expect(v).toBeGreaterThan(SERIAL);
  });

  it('DEFECT unique to this writer: the 1900 epoch boundary shifts by a day', () => {
    // Serial 1 → 2. Not a realistic business date, but it proves this path is
    // lossy rather than merely reformatting — and it is the path used by the two
    // pure pass-through tools.
    expect(reExport(1).v).toBe(2);
  });

  it.fails('DESIRED: the serial is untouched by a round trip', () => {
    expect(reExport().v).toBe(SERIAL);
  });
});

describe('text-mode exporters (Composite, Unpivot, Product Variants, Files Validation, Translator, Sheets Import)', () => {
  function reExport() {
    const rows = rowsLikeTheApp(parseLikeTheApp(datedFile()).Sheets.Data, false);
    const wb = createWorkbook();
    appendSheet(wb, rows, 'Out');
    return roundTrip(wb).Sheets.Out.B2;
  }

  it('DEFECT: the date becomes a TEXT cell', () => {
    // This half of the audit was correct. A text cell left-aligns, sorts
    // alphabetically, and breaks date arithmetic downstream.
    expect(reExport().t).toBe('s');
  });

  it.fails('DESIRED: a date read in text mode still exports as a date', () => {
    expect(reExport().t).toBe('n');
  });
});

describe('the shared choke points, in isolation', () => {
  it('appendSheet has no channel for a format — a plain number gets General', () => {
    // `services/excelService.ts:175`. Note `z` is 'General', not undefined —
    // the format is explicitly the default rather than absent.
    const wb = createWorkbook();
    appendSheet(wb, [['Price'], [1200]], 'Out');
    const cell = roundTrip(wb).Sheets.Out.A2;
    expect(cell.v).toBe(1200);
    expect(cell.z).toBe('General');
  });

  it('exportToExcelSingleSheet behaves the same for a plain number', () => {
    // `utils/excelUtils.ts:58`.
    const buf = exportToExcelSingleSheet([['Price'], [1200]], 'Out');
    const cell = XLSX.read(buf, { type: 'array', cellNF: true }).Sheets.Out.A2;
    expect(cell.v).toBe(1200);
    expect(cell.z).toBe('General');
  });

  it('both go out through a style-capable writer, so a fix would survive', () => {
    // `XLSX.write` from the plain library drops cell styles; a format-carrying
    // fix must be written by xlsx-js-style, which both `saveWorkbook` and
    // `exportToExcelSingleSheet` already use.
    expect(typeof XLSX_STYLE.write).toBe('function');
  });
});

describe('Smart Lookup shows the shape a fix would take', () => {
  it('readGrid + writeSheet preserves the ORIGINAL format and the exact serial', () => {
    // The TD-045 reference implementation. It reads cells rather than values, so
    // it never goes through the Date conversion and never loses `z`.
    const grid = readGrid(XLSX, parseLikeTheApp(datedFile()).Sheets.Data);
    const out = writeSheet(XLSX, ['SKU', 'WhenAdded'], grid.slice(1));
    const wb = createWorkbook();
    XLSX.utils.book_append_sheet(wb, out, 'Out');

    const cell = roundTrip(wb).Sheets.Out.B2;
    expect(cell.v).toBe(SERIAL);
    expect(cell.z).toBe(ORIGINAL_FMT);
    expect(cell.w).toContain('2026-01-15');
  });

  it('carries an arbitrary format, so the mechanism is not date-specific', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Price'], [1200]]);
    ws.A2.z = '0.00%';
    const out = writeSheet(XLSX, ['Price'], readGrid(XLSX, ws).slice(1));
    expect(out.A2.z).toBe('0.00%');
  });
});
