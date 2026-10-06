/**
 * The AI Translator's download: the user's OWN workbook with the translated
 * cells written in (product owner, 2026-10-06).
 *
 * WHY. The download used to be a new workbook whose FIRST sheet was "Original
 * File" — an untouched copy — then "Translated File", then the summary. Opening
 * it showed the original column unchanged, so a run that had translated every
 * row looked like it had done nothing (reproduced on the user's real file with
 * First column / Auto ⇄ / | / In-Place Update). It also dropped every other
 * sheet of the file, and rebuilt the sheet from display TEXT, so prices and
 * other numbers came back as text.
 *
 * NOW. Every sheet in its own order and name; on the translated sheet only the
 * cells the translation changed are rewritten (as text); every other cell is
 * the original cell object — same type, number format, formula. The uploaded
 * workbook is never mutated: the copy shares untouched cells and replaces, never
 * edits, the ones that change.
 *
 * Pure: the spreadsheet library is passed in.
 */
import type * as XLSXNS from 'xlsx';

type Lib = Pick<typeof XLSXNS, 'utils'>;

/**
 * A copy of the workbook that can be changed without touching the original:
 * new SheetNames / Sheets / visibility containers; sheet objects themselves are
 * shared until `applyGridChanges` replaces one.
 */
export function workbookCopy(wb: XLSXNS.WorkBook): XLSXNS.WorkBook {
  return {
    ...wb,
    SheetNames: [...wb.SheetNames],
    Sheets: { ...wb.Sheets },
    Workbook: wb.Workbook ? { ...wb.Workbook, Sheets: wb.Workbook.Sheets?.map((s) => ({ ...s })) } : wb.Workbook,
  };
}

const asText = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export interface OverwrittenCell {
  /** Excel reference, e.g. `B3`. */
  ref: string;
  /** The column's header (row 1 of the grid), '' when it has none. */
  header: string;
  previous: string;
  written: string;
}

/**
 * Non-empty cells OUTSIDE the selected columns that the translation replaced —
 * an output column (New Column, Consolidate, Template) that was pointed at real
 * data. The download is the user's own workbook (no "Original File" copy), so
 * these are listed in the summary with their previous value instead of being
 * lost without a trace. In-Place Update only writes the selected columns and
 * never appears here. `rowOffset` / `colOffset` are where the grid starts on the
 * sheet (its used range).
 */
export function overwrittenCells(
  lib: Lib,
  before: readonly (readonly unknown[])[],
  after: readonly (readonly unknown[])[],
  selectedCols: readonly number[],
  rowOffset = 0,
  colOffset = 0,
): OverwrittenCell[] {
  const out: OverwrittenCell[] = [];
  after.forEach((row, r) => {
    (row ?? []).forEach((value, c) => {
      if (selectedCols.includes(c)) return;
      const previous = asText(before[r]?.[c]);
      const written = asText(value);
      if (previous === '' || previous === written) return;
      out.push({ ref: lib.utils.encode_cell({ r: rowOffset + r, c: colOffset + c }), header: asText(before[0]?.[c]), previous, written });
    });
  });
  return out;
}

/**
 * Write `after` over the sheet `name` of `wb` (a `workbookCopy`), cell by cell
 * where it differs from `before` — the grid the translation started from, as
 * read by `getSheetData` (display text). Unchanged cells are not touched.
 * Returns how many cells were rewritten.
 */
export function applyGridChanges(lib: Lib, wb: XLSXNS.WorkBook, name: string, before: readonly (readonly unknown[])[], after: readonly (readonly unknown[])[]): number {
  const source = wb.Sheets[name];
  if (!source) throw new Error(`Sheet "${name}" is not in the workbook.`);
  // A new sheet object: the original one (shared with the uploaded workbook) is left as it is.
  const ws: XLSXNS.WorkSheet = { ...source };
  const range = lib.utils.decode_range(ws['!ref'] ?? 'A1');
  // `before`/`after` are read from the sheet's used range, which may not start at A1.
  const r0 = range.s.r;
  const c0 = range.s.c;
  let changed = 0;
  after.forEach((row, r) => {
    (row ?? []).forEach((value, c) => {
      const next = asText(value);
      if (next === asText(before[r]?.[c])) return;
      const ref = lib.utils.encode_cell({ r: r0 + r, c: c0 + c });
      if (next === '') delete ws[ref];
      else ws[ref] = { t: 's', v: next };
      changed++;
      if (r0 + r > range.e.r) range.e.r = r0 + r;
      if (c0 + c > range.e.c) range.e.c = c0 + c;
    });
  });
  ws['!ref'] = lib.utils.encode_range(range);
  wb.Sheets[name] = ws;
  return changed;
}
