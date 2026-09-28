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
 * Tracked as **TD-049**.
 *
 * `it.fails(...)` marks an assertion describing behaviour we WANT that does not
 * hold today. Vitest passes it while the assertion fails, so the suite stays
 * green over a known, accepted, unscheduled defect — and **fails the moment
 * someone fixes it**, which is the signal to drop the marker.
 */

const SERIAL = 46037; // 2026-01-15
const ORIGINAL_FMT = 'yyyy-mm-dd';
const SHEETJS_DEFAULT = 'm/d/yy';

/**
 * SheetJS converts between serials and `Date` objects through local time, so
 * anything asserting an exact serial after a round trip is timezone-dependent.
 * CI runs UTC; this file was written on a UTC+3 machine and two assertions
 * passed only there.
 *
 * `IS_UTC` gates the one assertion that is only *meaningful* under UTC. It is
 * deliberately NOT used to predict drift in other zones: a first attempt did
 * that (`offset === 0 ? exact : drifts`) and the predicate does not hold —
 * whether a zone drifts depends on the offset **at the 1900 epoch** versus at
 * the target date, so a zone sitting at offset 0 today can still drift, and a
 * non-zero zone need not. Assert invariants; skip what cannot be asserted.
 */
const IS_UTC = new Date(Date.UTC(2026, 0, 15)).getTimezoneOffset() === 0;

function datedFile(serial = SERIAL, fmt = ORIGINAL_FMT) {
  const ws = XLSX.utils.aoa_to_sheet([['SKU', 'WhenAdded'], ['A-1', serial]]);
  ws.B2.z = fmt;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

/** Parse exactly as `readExcelFile` does. */
const parseLikeTheApp = (buf: Buffer): XLSX.WorkBook =>
  XLSX.read(buf, { type: 'buffer', raw: true, cellNF: true });
/** Read exactly as `getSheetData(wb, name, raw)` does. */
const rowsLikeTheApp = (ws: XLSX.WorkSheet, raw: boolean): unknown[][] =>
  XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw }) as unknown[][];
/** `cellNF: true` is required to read `z` back at all. */
const roundTrip = (wb: XLSX.WorkBook): XLSX.WorkBook =>
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

  it('FIXED (TD-049): the serial is EXACT, in every timezone', () => {
    // Was `Math.round(...)`, a hedge that existed only because the value drifted.
    // Rounding was also what HID the corruption, since Excel truncates rather
    // than rounds for display. Now the value is exact and the hedge is gone.
    expect(reExport().v).toBe(SERIAL);
  });

  it('FIXED (TD-049): the rendered day is correct, and this is the assertion that matters', () => {
    // What this used to do, and why it is the most important test in the file.
    //
    // Measured 2026-09-21 on the OLD code path, across six timezones:
    //
    //   UTC, Europe/London, America/New_York  -> 46037          rendered 1/15/26  ok
    //   Asia/Riyadh (+3)                      -> 46037.000602   rendered 1/15/26  ok
    //   Asia/Kolkata (+5:30)                  -> 46037.000116   rendered 1/15/26  ok
    //   Pacific/Kiritimati (+14)              -> 46036.999769   rendered 1/14/26  WRONG
    //   Pacific/Midway (-11)                  -> 46036.999444   rendered 1/14/26  WRONG
    //
    // Excel TRUNCATES a serial for display, so once drift went negative the cell
    // showed the previous day — a wrong date, silently, depending on where the
    // user sat. Invisible under UTC, so CI could never have caught it.
    //
    // Assert on `w`, the rendered text, not on a rounded number: rounding is
    // what concealed this for two rounds of analysis.
    expect(reExport().w).toBe('1/15/26');
  });

  it('FIXED (TD-049): there is no drift left to bound', () => {
    // This assertion went through three wrong versions before the fix, each one
    // assuming rather than measuring: `toBeGreaterThan(SERIAL)` (passed only at
    // UTC+3), then a branch on `getTimezoneOffset() === 0` (which does not
    // predict drift), then a sub-day bound (true, but it tolerated the very
    // corruption that mattered). With the builder swapped there is nothing to
    // hedge: the round trip is exact everywhere.
    expect(reExport().v as number).toBe(SERIAL);
  });

  it('FIXED (TD-049): the 1900 epoch boundary no longer shifts', () => {
    // Serial 1 came back as 2 in EVERY timezone, UTC included — the one half of
    // this defect that CI could have caught, had anything asserted it.
    expect(reExport(1).v).toBe(1);
  });

  it('the history of this block, kept deliberately', () => {
    // Four assertions in this describe were wrong before they were right, and
    // every one failed the same way: asserting what I expected instead of
    // measuring what happened. An `it.fails()` that already passed under UTC, a
    // `toBeGreaterThan` that only held at UTC+3, an offset predicate that does
    // not predict drift, a `Math.round` that hid a wrong date. The fix is one
    // line; finding out what to fix took three corrections.
    //
    // This test asserts the one thing that ties them together: the exported cell
    // must be a real date cell, not a string and not a hedge.
    expect(reExport().t).toBe('n');
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

describe('TD-049: the proposed fix, pinned before it is implemented', () => {
  /**
   * **No production code is changed by this block.** It inlines the candidate so
   * the properties are locked in before anyone edits `exportToExcelSingleSheet`,
   * and so the choice is justified by measurement rather than argument.
   *
   * The defect is not in this repository's code. `exportToExcelSingleSheet`
   * builds its sheet with `XLSX_STYLE.utils.aoa_to_sheet` — xlsx-js-style, which
   * sits on the SheetJS 0.18.5 base (TD-022) and converts `Date` → serial through
   * local time incorrectly. `appendSheet` uses the maintained fork's
   * `aoa_to_sheet` and is exact in every timezone measured.
   *
   * The candidate is therefore one line: **build with the plain library, write
   * with the styled one.** The Date → serial conversion happens in
   * `aoa_to_sheet`, not in `write`, so the styled writer never sees a Date.
   */
  const rows = () => rowsLikeTheApp(parseLikeTheApp(datedFile()).Sheets.Data, true);
  const rowsAt = (serial: number) =>
    rowsLikeTheApp(parseLikeTheApp(datedFile(serial)).Sheets.Data, true);

  /** Today's implementation, inlined from `utils/excelUtils.ts:56`. */
  function currentPath(data: unknown[][]) {
    const wb = XLSX_STYLE.utils.book_new();
    const ws = XLSX_STYLE.utils.aoa_to_sheet(data as never);
    XLSX_STYLE.utils.book_append_sheet(wb, ws, 'Out');
    return XLSX_STYLE.write(wb, { bookType: 'xlsx', type: 'array' });
  }
  /** The candidate: the ONLY difference is which library builds the sheet. */
  function candidatePath(data: unknown[][]) {
    const wb = XLSX_STYLE.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data as never);
    XLSX_STYLE.utils.book_append_sheet(wb, ws, 'Out');
    return XLSX_STYLE.write(wb, { bookType: 'xlsx', type: 'array' });
  }
  const back = (buf: unknown) =>
    XLSX.read(buf, { type: 'array', cellNF: true }).Sheets.Out.B2;

  it('the candidate round-trips the serial EXACTLY — no drift to depend on a timezone', () => {
    expect(back(candidatePath(rows())).v).toBe(SERIAL);
  });

  it('the candidate fixes the 1900 epoch boundary, which is wrong in EVERY timezone today', () => {
    // The one half of this defect that is reproducible under CI: serial 1 comes
    // back as 2 on the current path, in every zone measured including UTC.
    expect(back(currentPath(rowsAt(1))).v).toBe(2);   // today, everywhere
    expect(back(candidatePath(rowsAt(1))).v).toBe(1); // with the fix
  });

  it('the candidate is no worse on formats — both paths lose `z` the same way', () => {
    // Format fidelity is a SEPARATE half of TD-049 that this candidate does not
    // address. Stated explicitly so nobody ships it believing the job is done.
    expect(back(currentPath(rows())).z).toBe(SHEETJS_DEFAULT);
    expect(back(candidatePath(rows())).z).toBe(SHEETJS_DEFAULT);
  });

  it('a sheet built by the plain library is still writable by the styled one', () => {
    // The compatibility question the candidate turns on. If this throws or
    // produces an unreadable file, the candidate is dead.
    const wsOut = XLSX.read(candidatePath([['H'], ['v']]), { type: 'array' }).Sheets.Out;
    expect(wsOut.A1.v).toBe('H');
    expect(wsOut.A2.v).toBe('v');
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
