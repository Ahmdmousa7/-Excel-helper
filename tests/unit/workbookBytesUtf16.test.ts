import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readWorkbookBytes, decodeTextBytes } from '../../services/workbookBytes';

/**
 * UTF-16 text files with a byte-order mark: Excel's "Unicode Text" export.
 * Found through the reference package's `test.tsv` (2026-09-30). Before the
 * fix, `FF FE` failed UTF-8, fell through to Windows-1256, and every letter
 * came out with a NUL beside it; SheetJS alone had read the file correctly.
 */
const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const text = ['name' + TAB + 'sku', 'حمص' + TAB + '00123', ''].join(NL);
const units = Array.from(text).map((ch) => ch.charCodeAt(0));
const le = new Uint8Array([0xff, 0xfe, ...units.flatMap((c) => [c & 0xff, c >> 8])]);
const be = new Uint8Array([0xfe, 0xff, ...units.flatMap((c) => [c >> 8, c & 0xff])]);
const rows = (wb: XLSX.WorkBook) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });

describe('UTF-16 with a byte-order mark', () => {
  it('decodes little- and big-endian, dropping the mark', () => {
    expect(decodeTextBytes(le)).toBe(text);
    expect(decodeTextBytes(be)).toBe(text);
  });

  it('parses as SheetJS parses the bytes itself, leading zeros kept', () => {
    const expected = [['name', 'sku'], ['حمص', '00123']];
    expect(rows(readWorkbookBytes(le, 'x.tsv', { raw: true }))).toEqual(expected);
    expect(rows(readWorkbookBytes(le, 'x.csv', { raw: true }))).toEqual(expected);
    expect(rows(XLSX.read(le, { type: 'array', raw: true }))).toEqual(expected);
  });

  it('UTF-8, with or without a BOM, is unaffected', () => {
    const utf8 = new TextEncoder().encode('a,b');
    expect(decodeTextBytes(utf8)).toBe('a,b');
    expect(decodeTextBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe('a,b');
  });
});
