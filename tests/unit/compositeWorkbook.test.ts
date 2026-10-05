import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readWorkbookBytes } from '../../services/workbookBytes';
import { getSheetData, cloneWorkbook } from '../../services/excelService';
import { sheetVisibility, sheetLabel, defaultSheets, showSheet } from '../../utils/compositeWorkbook';
import { buildCostIndex, productFinancials } from '../../utils/compositeFinancials';
import { safeSheetName } from '../../utils/excelUtils';

/**
 * Hidden rows, columns and worksheets in Composite Check, read exactly as an
 * upload is read (`readExcelFile` → `readWorkbookBytes(…, { raw: true, cellNF: true })`).
 */
const COMPOSITE = [
  ['Product Name', 'Product SKU', 'Retail Price', 'Unit', 'Ing SKU 1', 'Qty 1', 'Ing SKU 2', 'Qty 2'],
  ['Burger', 'COMP-001', 20, 'pc', 'RAW-100', 2, 'RAW-200', 1],
  ['Pizza', 'COMP-002', 9, 'pc', 'RAW-300', 3, '', ''],
  ['Wrap', 'COMP-003', 4, 'pc', 'RAW-100', 1, 'RAW-300', 1],
  ['Soup', 'COMP-004', 15, 'pc', 'RAW-200', 2, '', ''],
];
const RAW = [['SKU', 'Name', 'Cost'], ['RAW-100', 'Bun', 1], ['RAW-200', 'Patty', 5], ['RAW-300', 'Cheese', 2]];

/** Hidden rows first / middle / last, hidden columns first / middle / last, and the sheet states asked for. */
function upload(opts: { compHidden?: 0 | 1 | 2; rawHidden?: 0 | 1 | 2; helperFirst?: 0 | 1 | 2 } = {}) {
  const wb = XLSX.utils.book_new();
  const states: number[] = [];
  if (opts.helperFirst !== undefined) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Units'], ['pc'], ['kg']]), 'Lists');
    states.push(opts.helperFirst);
  }
  const comp = XLSX.utils.aoa_to_sheet(COMPOSITE);
  // Rows: the header's neighbour (first data row), a middle one, the last one.
  comp['!rows'] = [{}, { hidden: true }, {}, { hidden: true }, { hidden: true }];
  // Columns: the first (Product Name), a middle one (Retail Price), the last (Qty 2).
  comp['!cols'] = [{ hidden: true }, {}, { hidden: true }, {}, {}, {}, {}, { hidden: true }];
  const raw = XLSX.utils.aoa_to_sheet(RAW);
  raw['!rows'] = [{}, { hidden: true }, {}, { hidden: true }];
  raw['!cols'] = [{}, {}, { hidden: true }];
  XLSX.utils.book_append_sheet(wb, comp, 'Composite');
  states.push(opts.compHidden ?? 0);
  XLSX.utils.book_append_sheet(wb, raw, 'Raw');
  states.push(opts.rawHidden ?? 0);
  wb.Workbook = { Sheets: states.map((Hidden) => ({ Hidden })) } as XLSX.WBProps;
  const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  // The source really carries the hidden flags (checked with a style-aware read).
  const check = XLSX.read(bytes, { type: 'array', cellStyles: true });
  expect(check.Sheets.Composite['!rows']![1]).toMatchObject({ hidden: true });
  expect(check.Sheets.Composite['!cols']![0]).toMatchObject({ hidden: true });
  return readWorkbookBytes(bytes, 'composite.xlsx', { raw: true, cellNF: true });
}

describe('hidden rows and columns: every value is read', () => {
  it('hidden rows (first, middle, last) and columns (first, middle, last) all reach the data', () => {
    const wb = upload();
    expect(getSheetData(wb, 'Composite')).toEqual(COMPOSITE.map((r) => r.map((c) => (c === '' ? '' : String(c)))));
    expect(getSheetData(wb, 'Raw', true)).toEqual(RAW);
  });

  it('required data in hidden rows and columns feeds the financials', () => {
    const wb = upload();
    const map = { rawSkuCol: 0, costCol: 2, rawNameCol: 1, retailPriceCol: 2 };
    const index = buildCostIndex(getSheetData(wb, 'Raw').slice(1), map);
    const rows = getSheetData(wb, 'Composite').slice(1);
    // Retail Price (a hidden column), Cost (a hidden column), Burger and Soup (hidden rows).
    expect(rows.map((r) => productFinancials(r, 4, index, map)).map((p) => [p.sku, p.cost, p.retailPrice, p.profit])).toEqual([
      ['COMP-001', 7, 20, 13],
      ['COMP-002', 6, 9, 3],
      ['COMP-003', 3, 4, 1],
      ['COMP-004', 10, 15, 5],
    ]);
  });

  it('the shared reader keeps no row/column visibility, so nothing generated from it is hidden', () => {
    const wb = upload();
    expect(wb.Sheets.Composite['!rows']).toBeUndefined();
    expect(wb.Sheets.Composite['!cols']).toBeUndefined();
  });
});

describe('hidden and very hidden sheets', () => {
  it('visibility is read from the workbook', () => {
    const wb = upload({ compHidden: 1, rawHidden: 2 });
    expect(sheetVisibility(wb, 'Composite')).toBe('hidden');
    expect(sheetVisibility(wb, 'Raw')).toBe('veryHidden');
    expect(sheetVisibility(wb, 'Nope')).toBe('visible');
    expect(sheetLabel(wb, 'Composite')).toBe('Composite (hidden)');
    expect(sheetLabel(wb, 'Raw')).toBe('Raw (very hidden)');
  });

  it('a completely hidden sheet with the required data is read in full', () => {
    const wb = upload({ compHidden: 2, rawHidden: 1 });
    expect(getSheetData(wb, 'Composite')).toHaveLength(COMPOSITE.length);
    expect(getSheetData(wb, 'Raw')).toHaveLength(RAW.length);
  });

  it('defaults skip hidden sheets: a hidden lists sheet at the front no longer becomes the Raw sheet', () => {
    const wb = upload({ helperFirst: 1 });
    // The old rule — sheets[0] and sheets[1] — picked Lists (hidden) as Raw.
    expect([wb.SheetNames[0], wb.SheetNames[1]]).toEqual(['Lists', 'Composite']);
    expect(defaultSheets(wb)).toEqual({ raw: 'Composite', composite: 'Raw' });
    expect(defaultSheets(upload({ helperFirst: 2 }))).toEqual({ raw: 'Composite', composite: 'Raw' });
  });

  it('defaults keep the old first/second rule when nothing is hidden', () => {
    expect(defaultSheets(upload())).toEqual({ raw: 'Composite', composite: 'Raw' });
  });

  it('with too few visible sheets, hidden ones fill the defaults', () => {
    expect(defaultSheets(upload({ compHidden: 1 }))).toEqual({ raw: 'Raw', composite: 'Composite' });
    expect(defaultSheets(upload({ compHidden: 1, rawHidden: 2 }))).toEqual({ raw: 'Composite', composite: 'Raw' });
    expect(defaultSheets({ SheetNames: ['Only'] })).toEqual({ raw: 'Only', composite: '' });
  });

  it('showSheet changes the GENERATED copy only; the uploaded workbook keeps its state', () => {
    const source = upload({ compHidden: 2, rawHidden: 1 });
    const out = cloneWorkbook(source);
    expect(showSheet(out, 'Composite')).toBe('veryHidden');
    expect(sheetVisibility(out, 'Composite')).toBe('visible');
    expect(sheetVisibility(out, 'Raw')).toBe('hidden'); // unrelated: unchanged
    expect(sheetVisibility(source, 'Composite')).toBe('veryHidden');
    expect(sheetVisibility(source, 'Raw')).toBe('hidden');
    // And it survives being written and read back.
    const back = XLSX.read(XLSX.write(out, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(sheetVisibility(back, 'Composite')).toBe('visible');
    expect(showSheet(out, 'Composite')).toBe('visible');
  });
});

describe('result sheet names', () => {
  it('a workbook that already has the result sheets: SheetJS throws on a duplicate, safeSheetName picks a free one', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Validation Errors');
    expect(() => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['y']]), 'Validation Errors')).toThrow();
    const taken = new Set(wb.SheetNames.map((n) => n.toLowerCase()));
    expect(safeSheetName('Validation Errors', taken)).toBe('Validation Errors (2)');
    expect(safeSheetName('Profit Analysis', taken)).toBe('Profit Analysis');
  });
});
