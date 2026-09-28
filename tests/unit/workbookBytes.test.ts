import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import {
  readWorkbookBytes, decodeTextBytes, isBinaryWorkbook, isDelimitedTextName,
} from '../../services/workbookBytes';

/**
 * TD-050: CSV decoding for every upload path that parses bytes itself —
 * readExcelFile, FileValidationTab, ProjectSummaryTab and SupportChat.
 */

const utf8 = (s: string) => new TextEncoder().encode(s);
const withBom = (b: Uint8Array) => new Uint8Array([0xef, 0xbb, 0xbf, ...b]);
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));
const firstCell = (wb: XLSX.WorkBook) => {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][];
};

// "شاي" in Windows-1256, the legacy Arabic code page: sheen, alef, yeh.
const TEA_1256 = new Uint8Array([0xd4, 0xc7, 0xed]);

describe('decodeTextBytes', () => {
  it('BOM-less UTF-8 Arabic decodes correctly — the TD-050 case', () => {
    expect(decodeTextBytes(utf8('حوار بلدي'))).toBe('حوار بلدي');
  });

  it('a UTF-8 BOM is consumed, not passed into the first header', () => {
    expect(decodeTextBytes(withBom(utf8('Product Name')))).toBe('Product Name');
  });

  it('invalid UTF-8 falls back to Windows-1256, the legacy Arabic code page', () => {
    expect(decodeTextBytes(TEA_1256)).toBe('شاي');
  });

  it('plain ASCII is unchanged', () => {
    expect(decodeTextBytes(utf8('SKU,Price\nA-1,10\n'))).toBe('SKU,Price\nA-1,10\n');
  });
});

describe('isBinaryWorkbook — sniff the bytes before trusting the name', () => {
  it('recognises an .xlsx (ZIP) and a legacy .xls (OLE)', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a']]), 'S');
    expect(isBinaryWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })))).toBe(true);
    expect(isBinaryWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xls' })))).toBe(true);
  });

  it('text is not a binary workbook', () => {
    expect(isBinaryWorkbook(utf8('SKU,Price'))).toBe(false);
  });

  it('isDelimitedTextName is by extension, case-insensitive', () => {
    expect(isDelimitedTextName('Data.CSV')).toBe(true);
    expect(isDelimitedTextName('data.tsv')).toBe(true);
    expect(isDelimitedTextName('data.xlsx')).toBe(false);
  });
});

describe('readWorkbookBytes — the fix', () => {
  it('THE REAL TEMPLATE: Arabic survives, where the old byte path turned it to mojibake', () => {
    const bytes = fixture('rewaa-simple-template.csv');
    const before = firstCell(XLSX.read(bytes, { type: 'array', raw: true, cellNF: true }));
    const after = firstCell(readWorkbookBytes(bytes, 'template.csv', { raw: true, cellNF: true }));
    expect(/\p{Script=Arabic}/u.test(String(before[2][0]))).toBe(false); // the defect, measured
    expect(String(after[2][0])).toContain('حوار بلدي الكيلو');           // fixed
  });

  it('a Windows-1256 CSV decodes as Arabic too', () => {
    const bytes = new Uint8Array([...utf8('Name\n'), ...TEA_1256, 0x0a]);
    expect(String(firstCell(readWorkbookBytes(bytes, 'legacy.csv'))[1][0])).toBe('شاي');
  });

  it('an .xlsx misnamed .csv is still parsed as a workbook', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['شاي', 13]]), 'S');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(firstCell(readWorkbookBytes(bytes, 'mislabelled.csv'))[0]).toEqual(['شاي', '13']);
  });

  it('a real .xlsx is read exactly as before', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['SKU', 'Price'], ['A-1', 10.5]]), 'S');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    const opts = { raw: true, cellNF: true } as const;
    expect(readWorkbookBytes(bytes, 'f.xlsx', opts).Sheets.S).toEqual(XLSX.read(bytes, { type: 'array', ...opts }).Sheets.S);
  });

  it('TSV is decoded and split on tabs', () => {
    const rows = firstCell(readWorkbookBytes(utf8('اسم\tسعر\nشاي\t13\n'), 'f.tsv'));
    expect(rows).toEqual([['اسم', 'سعر'], ['شاي', '13']]);
  });
});

/**
 * The fix must change DECODING and nothing else. For ASCII content, where the
 * old paths were already correct, every cell must come out identical — value,
 * type and formatted text — under each caller's own options.
 */
describe('EQUIVALENCE — ASCII CSVs parse exactly as each old path did', () => {
  const CSV = 'SKU,Barcode,Price,When,Flag\nA-1,6287013210006,10.50,2026-01-15,TRUE\nB,00123,7,1/2/2026,no\n';
  const bytes = utf8(CSV);
  const cellsOf = (wb: XLSX.WorkBook) => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    return Object.keys(ws).filter((k) => !k.startsWith('!')).sort()
      .map((k) => ({ k, v: ws[k].v instanceof Date ? ws[k].v.toISOString() : ws[k].v, t: ws[k].t, w: ws[k].w }));
  };

  it('readExcelFile’s options ({raw, cellNF}), was type:array', () => {
    const opts = { raw: true, cellNF: true } as const;
    expect(cellsOf(readWorkbookBytes(bytes, 'f.csv', opts))).toEqual(cellsOf(XLSX.read(bytes, { type: 'array', ...opts })));
  });

  it('FileValidationTab’s options ({cellDates, …}), was a BINARY string', () => {
    const opts = { cellDates: true, cellNF: false, cellText: false } as const;
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    expect(cellsOf(readWorkbookBytes(bytes, 'f.csv', opts))).toEqual(cellsOf(XLSX.read(binary, { type: 'binary', ...opts })));
  });

  it('ProjectSummaryTab and SupportChat (default options), were type:array', () => {
    expect(cellsOf(readWorkbookBytes(bytes, 'f.csv'))).toEqual(cellsOf(XLSX.read(bytes, { type: 'array' })));
  });
});

describe('the ZIP sniff uses the full signature, not just "PK"', () => {
  it('a CSV whose first header starts with "PK" is still read as text', () => {
    // A primary-key column is a common first header. Sniffing only the two
    // bytes `PK` mistook such a file for a workbook.
    const bytes = utf8('PK,Name\n1,شاي\n');
    expect(isBinaryWorkbook(bytes)).toBe(false);
    expect(firstCell(readWorkbookBytes(bytes, 'keys.csv'))).toEqual([['PK', 'Name'], ['1', 'شاي']]);
  });

  it('a real ZIP container is still recognised', () => {
    expect(isBinaryWorkbook(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(isBinaryWorkbook(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });
});
