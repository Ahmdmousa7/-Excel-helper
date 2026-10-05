/**
 * Hidden worksheets in Composite Check.
 *
 * What hidden content does to this module (measured 2026-10-05 in the real app):
 *
 *   - Hidden ROWS and COLUMNS never lose data. The shared reader
 *     (`readExcelFile`) does not parse row/column visibility at all, and
 *     `getSheetData` reads every cell, so hidden rows and columns are processed
 *     like any other. The generated export is built from those values, so it
 *     has no hidden rows or columns either.
 *   - Hidden and veryHidden SHEETS are read in full too, but they caused two
 *     real failures, both fixed here:
 *       1. the sheet pickers defaulted to the first two sheets, hidden or not —
 *          a hidden "lists" sheet at the front became the Raw sheet and every
 *          ingredient was reported missing;
 *       2. the export kept the Composite sheet's hidden state, so the validated
 *          sheet — the result — was invisible (and for veryHidden, Excel's own
 *          Unhide menu cannot show it).
 *
 * The uploaded workbook is never changed: visibility is changed only on the
 * generated copy.
 */

export type SheetVisibility = 'visible' | 'hidden' | 'veryHidden';

interface WorkbookLike {
  SheetNames: string[];
  Workbook?: { Sheets?: { Hidden?: number }[] };
}

/** SheetJS: `Hidden` 0 = visible, 1 = hidden, 2 = veryHidden. */
export function sheetVisibility(wb: WorkbookLike, name: string): SheetVisibility {
  const i = wb.SheetNames.indexOf(name);
  const hidden = i < 0 ? 0 : wb.Workbook?.Sheets?.[i]?.Hidden ?? 0;
  return hidden === 2 ? 'veryHidden' : hidden === 1 ? 'hidden' : 'visible';
}

/** The picker label: the sheet name, marked when the sheet is hidden. */
export function sheetLabel(wb: WorkbookLike, name: string): string {
  const v = sheetVisibility(wb, name);
  return v === 'visible' ? name : `${name} (${v === 'veryHidden' ? 'very hidden' : 'hidden'})`;
}

/**
 * The default Raw and Composite sheets: the first and second sheet, as before,
 * but counting VISIBLE sheets first. Hidden sheets are only used when there are
 * not enough visible ones, and stay selectable in the pickers either way.
 */
export function defaultSheets(wb: WorkbookLike): { raw: string; composite: string } {
  const visible = wb.SheetNames.filter((n) => sheetVisibility(wb, n) === 'visible');
  const ordered = [...visible, ...wb.SheetNames.filter((n) => !visible.includes(n))];
  return { raw: ordered[0] ?? '', composite: ordered.length > 1 ? ordered[1] : '' };
}

/** Make one sheet visible in a GENERATED workbook. Returns what it was. */
export function showSheet(wb: WorkbookLike, name: string): SheetVisibility {
  const before = sheetVisibility(wb, name);
  const i = wb.SheetNames.indexOf(name);
  if (i >= 0 && before !== 'visible' && wb.Workbook?.Sheets?.[i]) wb.Workbook.Sheets[i].Hidden = 0;
  return before;
}
