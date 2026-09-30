import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { cleanEmptyColumns, uniqueNames, safeSheetName } from '../../utils/excelUtils';

/**
 * Names and the Clean start row: behaviour adopted from the ExcelDiff AI
 * reference package (2026-09-30).
 */
describe('cleanEmptyColumns: start row past the data', () => {
  it('checks every row instead of dropping every column', () => {
    // Before: nothing was checked, so every column counted as empty and the
    // export was a sheet of empty rows.
    const r = cleanEmptyColumns([['a', 'b', 'c'], ['1', '', '']], 5);
    expect(r.cleanedData).toEqual([['a', 'b', 'c'], ['1', '', '']]);
    expect(r.droppedCount).toBe(0);
  });

  it('a column empty in every row is still removed', () => {
    const r = cleanEmptyColumns([['a', ''], ['1', '']], 9);
    expect(r.cleanedData).toEqual([['a'], ['1']]);
    expect(r.droppedCount).toBe(1);
  });

  it('a start row inside the data behaves exactly as before', () => {
    expect(cleanEmptyColumns([['a', 'b'], ['1', '']], 1).cleanedData).toEqual([['a'], ['1']]);
  });
});

describe('uniqueNames', () => {
  it('keeps the first, numbers the rest, ignoring case, never reusing a name', () => {
    expect(uniqueNames(['a', 'b', 'A', 'a', 'a-2'])).toEqual(['a', 'b', 'A-2', 'a-3', 'a-2-2']);
  });

  it('leaves distinct names alone', () => {
    expect(uniqueNames(['Cleaned_x_S1', 'Cleaned_x_S2'])).toEqual(['Cleaned_x_S1', 'Cleaned_x_S2']);
  });
});

describe('safeSheetName', () => {
  const names = (list: unknown[]) => {
    const taken = new Set<string>();
    return list.map((n) => safeSheetName(n, taken));
  };
  const BACKSLASH = String.fromCharCode(92);

  it('strips the characters Excel rejects, trims apostrophes, falls back to Sheet', () => {
    expect(names(['a:b', "'quoted'", '[x]*?/' + BACKSLASH, '', null])).toEqual(['a b', 'quoted', 'x', 'Sheet', 'Sheet (2)']);
  });

  it('is unique ignoring case, within 31 characters, and keeps Arabic', () => {
    const long = 'x'.repeat(40);
    const out = names(['Sales', 'sales', long, long + 'y', 'مبيعات']);
    expect(out).toEqual(['Sales', 'sales (2)', 'x'.repeat(31), 'x'.repeat(27) + ' (2)', 'مبيعات']);
    expect(out.every((n) => n.length <= 31)).toBe(true);
  });

  it('every result can go into one workbook: the crash Merge had with Sales.csv + Sales.xlsx', () => {
    const wb = XLSX.utils.book_new();
    for (const n of names(['Sales', 'Sales', 'a:b', "'x'", 'x'.repeat(40), 'x'.repeat(40)])) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['v']]), n);
    }
    expect(wb.SheetNames).toHaveLength(6);
    // The same names without the helper throw, which is what Merge did.
    const raw = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(raw, XLSX.utils.aoa_to_sheet([['v']]), 'Sales');
    expect(() => XLSX.utils.book_append_sheet(raw, XLSX.utils.aoa_to_sheet([['v']]), 'Sales')).toThrow();
  });
});
