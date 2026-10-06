import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { workbookCopy, applyGridChanges } from '../../utils/translateOutput';
import { getSheetData } from '../../services/excelService';
import { readWorkbookBytes } from '../../services/workbookBytes';

/**
 * The AI Translator's download is the user's own workbook with the
 * translation written in — not a new workbook opening on an untouched copy.
 */

/** A workbook as the app reads an upload (round-tripped, cellNF on). */
function upload(sheets: Record<string, unknown[][]>, hidden: number[] = []): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  if (hidden.length) wb.Workbook = { Sheets: wb.SheetNames.map((_, i) => ({ Hidden: hidden[i] ?? 0 })) } as XLSX.WBProps;
  const ws = wb.Sheets[wb.SheetNames[0]];
  ws.C2.z = '0.00';               // a number format on a price
  ws.D2 = { t: 'n', v: 80, f: 'C2*2' }; // a formula
  return readWorkbookBytes(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'x.xlsx', { raw: true, cellNF: true });
}

const ROWS = [
  ['Product Name', 'Product SKU', 'Retail Price', 'Double'],
  ['حبة شواية', 'A1', 40, ''],
  ['نصف حبة شواية', 'A2', 21, 42],
  ['', 'A3', 5, 10],
];

/** What the translator produces for In-Place Update on column A. */
function translateInPlace(grid: unknown[][]): unknown[][] {
  return grid.map((row, r) => (r === 0 || !row[0] ? row : [`${row[0]} | EN(${row[0]})`, ...row.slice(1)]));
}

describe('applyGridChanges on a workbookCopy', () => {
  it('writes the translated cells into the user\'s own sheet; everything else is the original cell', () => {
    const src = upload({ 'rewaa-import-simple': ROWS, Notes: [['note'], ['keep me']] });
    const before = getSheetData(src, 'rewaa-import-simple');
    const out = workbookCopy(src);
    expect(applyGridChanges(XLSX, out, 'rewaa-import-simple', before, translateInPlace(before))).toBe(2);
    const ws = out.Sheets['rewaa-import-simple'];
    // Translated, in place: column A.
    expect([ws.A2.v, ws.A3.v]).toEqual(['حبة شواية | EN(حبة شواية)', 'نصف حبة شواية | EN(نصف حبة شواية)']);
    expect(ws.A2.v).not.toBe('حبة شواية');
    // Header, blank cell, other columns: untouched — types, formats, formulas included.
    expect(ws.A1.v).toBe('Product Name');
    expect(ws.A4).toBe(src.Sheets['rewaa-import-simple'].A4);
    expect(ws.C2).toBe(src.Sheets['rewaa-import-simple'].C2);
    expect(ws.C2).toMatchObject({ t: 'n', v: 40, z: '0.00' });
    expect(ws.D2).toMatchObject({ t: 'n', f: 'C2*2' });
    expect(ws.B3).toBe(src.Sheets['rewaa-import-simple'].B3);
    // Same rows, same range.
    expect(ws['!ref']).toBe(src.Sheets['rewaa-import-simple']['!ref']);
    // Every sheet, in its order, with its name.
    expect(out.SheetNames).toEqual(['rewaa-import-simple', 'Notes']);
    expect(out.Sheets.Notes).toBe(src.Sheets.Notes);
  });

  it('the uploaded workbook itself is never modified', () => {
    const src = upload({ Menu: ROWS });
    const snapshot = JSON.stringify(src);
    const before = getSheetData(src, 'Menu');
    const out = workbookCopy(src);
    applyGridChanges(XLSX, out, 'Menu', before, translateInPlace(before));
    XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([['Row']]), 'Translation Summary');
    expect(JSON.stringify(src)).toBe(snapshot);
    expect(src.SheetNames).toEqual(['Menu']);
    expect(src.Sheets.Menu.A2.v).toBe('حبة شواية');
  });

  it('nothing to change → nothing rewritten (a failed run leaves the sheet exactly as it was)', () => {
    const src = upload({ Menu: ROWS });
    const before = getSheetData(src, 'Menu');
    const out = workbookCopy(src);
    expect(applyGridChanges(XLSX, out, 'Menu', before, before.map((r) => [...r]))).toBe(0);
    for (const ref of Object.keys(src.Sheets.Menu)) expect(out.Sheets.Menu[ref]).toEqual(src.Sheets.Menu[ref]);
  });

  it('a new output column (New Column mode) extends the range; a blanked cell is removed', () => {
    const src = upload({ Menu: ROWS });
    const before = getSheetData(src, 'Menu');
    const after = before.map((r, i) => [...r, i === 0 ? 'Product Name_TR' : i === 3 ? '' : `T${i}`]);
    after[2][1] = '';
    const out = workbookCopy(src);
    applyGridChanges(XLSX, out, 'Menu', before, after);
    const ws = out.Sheets.Menu;
    expect([ws.E1.v, ws.E2.v, ws.E3.v, ws.E4]).toEqual(['Product Name_TR', 'T1', 'T2', undefined]);
    expect(ws.B3).toBeUndefined();
    expect(ws['!ref']).toBe('A1:E4');
  });

  it('a sheet whose data starts below / right of A1 is written at the right cells', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.sheet_add_aoa(XLSX.utils.aoa_to_sheet([]), [['Name'], ['شاي']], { origin: 'C3' });
    XLSX.utils.book_append_sheet(wb, ws, 'Offset');
    const src = readWorkbookBytes(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'x.xlsx', { raw: true, cellNF: true });
    const before = getSheetData(src, 'Offset');
    const out = workbookCopy(src);
    // Change the one cell holding the text, wherever the grid puts it.
    const after = before.map((row) => row.map((v) => (v === 'شاي' ? 'شاي | Tea' : v)));
    expect(applyGridChanges(XLSX, out, 'Offset', before, after)).toBe(1);
    expect(out.Sheets.Offset.C4.v).toBe('شاي | Tea');
    expect(out.Sheets.Offset.C3.v).toBe('Name');
    expect(out.Sheets.Offset.A1).toBeUndefined();
  });

  it('sheet visibility is kept, and an unknown sheet is an error', () => {
    const src = upload({ Menu: ROWS, Lists: [['x']] }, [0, 1]);
    const out = workbookCopy(src);
    expect(out.Workbook?.Sheets?.map((s) => s.Hidden)).toEqual([0, 1]);
    expect(() => applyGridChanges(XLSX, out, 'Nope', [], [])).toThrow('Sheet "Nope" is not in the workbook.');
  });
});
