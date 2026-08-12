import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { getSheetData } from '../../services/excelService';

/**
 * TD-038 regression, driven through the REAL `getSheetData` against a REAL file.
 *
 * `tests/unit/cellText.test.ts` covers the per-cell rule in isolation. This
 * covers the thing that actually broke: the whole path from a committed `.xlsx`
 * to the array the tools index into. A unit test on the helper would have passed
 * happily while `getSheetData` still reached for `w`.
 *
 * The wrong values asserted against below are not invented — they are the
 * verbatim output of the pre-fix implementation on this exact file, recorded in
 * tests/fixtures/README.md. Reverting the fix fails these by name.
 */

const FIXTURE = join(__dirname, '..', 'fixtures', 'scientific-notation-barcodes.xlsx');

function loadFixture() {
  return XLSX.read(readFileSync(FIXTURE), { type: 'buffer' });
}

/** SKU -> [true barcode, the wrong value the old code produced] */
const CASES: Array<[string, string, string | null]> = [
  ['COMP-001', '1234567890123', '1234570000000'],
  ['COMP-002', '1234567890123456', '1234570000000000'],
  ['COMP-003', '9876543210987', '9876540000000'],
  // 11 digits — under Excel's 12-digit scientific threshold, so it was never
  // corrupted. Included because it is why spot-checking a short barcode made the
  // bug look absent.
  ['COMP-004', '12345678901', null],
  ['000456', '1112223334445', '1112220000000'],
  ['AB-0012-X', '5556667778889', '5556670000000'],
];

describe('getSheetData preserves long barcodes (TD-038)', () => {
  const rows = getSheetData(loadFixture(), 'Composite') as string[][];
  const header = rows[0];
  const numberCol = header.indexOf('Barcode (stored as number)');
  const textCol = header.indexOf('Barcode (stored as text)');
  const byKey = new Map(rows.slice(1).map((r) => [String(r[0]), r]));

  it('reads the fixture and finds the expected shape', () => {
    // Guards the test itself: if the fixture or the header text ever changes,
    // fail here rather than silently asserting on undefined columns.
    expect(numberCol, 'number-barcode column not found').toBeGreaterThan(-1);
    expect(textCol, 'text-barcode column not found').toBeGreaterThan(-1);
    expect(byKey.size).toBe(CASES.length);
  });

  for (const [sku, expected, oldWrong] of CASES) {
    it(`${sku}: returns the stored barcode, not the scientific display`, () => {
      const row = byKey.get(sku);
      expect(row, `row ${sku} missing from the fixture`).toBeTruthy();
      expect(row![numberCol]).toBe(expected);
    });

    if (oldWrong) {
      it(`${sku}: never returns the pre-fix value ${oldWrong}`, () => {
        const got = byKey.get(sku)![numberCol];
        expect(got).not.toBe(oldWrong);
        // Belt and braces: the failure mode was a rounded value, so assert the
        // full digit count survived rather than only that one string differs.
        expect(got).toHaveLength(expected.length);
      });
    }
  }

  it('agrees with the same digits stored as text', () => {
    // The strongest available oracle: column C holds each barcode as text, which
    // Excel never mangles. Number and text columns must now match exactly.
    for (const [sku] of CASES) {
      const row = byKey.get(sku)!;
      expect(row[numberCol], `${sku}: number and text forms disagree`)
        .toBe(row[textCol]);
    }
  });

  it('never emits scientific notation anywhere in the sheet', () => {
    const sci = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/;
    for (const row of rows) {
      for (const cell of row) {
        expect(sci.test(String(cell).trim()), `scientific notation leaked: ${cell}`)
          .toBe(false);
      }
    }
  });
});

describe('getSheetData does not regress the cases that always worked', () => {
  const rows = getSheetData(loadFixture(), 'Composite') as string[][];
  const byKey = new Map(rows.slice(1).map((r) => [String(r[0]), r]));

  it('keeps a leading-zero SKU as text', () => {
    // Text cells were always returned verbatim; this asserts the fix did not
    // start coercing them to numbers.
    expect(byKey.has('000456')).toBe(true);
  });

  it('keeps an alphanumeric SKU intact', () => {
    expect(byKey.has('AB-0012-X')).toBe(true);
  });

  it('does not round prices to three decimal places', () => {
    // The second defect in the old code: toLocaleString without
    // maximumFractionDigits turned 1234.5678 into "1234.568".
    const priceCol = rows[0].indexOf('Price');
    expect(priceCol).toBeGreaterThan(-1);
    expect(byKey.get('COMP-001')![priceCol]).toBe('1234.5678');
  });

  it('returns the other sheet independently', () => {
    const raw = getSheetData(loadFixture(), 'Raw') as string[][];
    expect(raw[0]).toEqual(['SKU', 'Cost']);
    expect(raw.length).toBe(3);
  });

  it('returns an empty array for a sheet that does not exist', () => {
    expect(getSheetData(loadFixture(), 'NoSuchSheet')).toEqual([]);
  });
});

describe('raw mode is untouched', () => {
  it('still returns numbers as numbers', () => {
    // Compare, Merge, Dedupe, Duplicates and Clean pass raw:true and do
    // arithmetic on the result. The fix must not have turned those into strings.
    const rows = getSheetData(loadFixture(), 'Composite', true) as unknown[][];
    const priceCol = (rows[0] as string[]).indexOf('Price');
    const comp001 = rows.slice(1).find((r) => r[0] === 'COMP-001')!;
    expect(typeof comp001[priceCol]).toBe('number');
    expect(comp001[priceCol]).toBe(1234.5678);
  });

  it('carries the full barcode digits, since raw values never held the display text', () => {
    const rows = getSheetData(loadFixture(), 'Composite', true) as unknown[][];
    const numberCol = (rows[0] as string[]).indexOf('Barcode (stored as number)');
    const comp001 = rows.slice(1).find((r) => r[0] === 'COMP-001')!;
    expect(String(comp001[numberCol])).toBe('1234567890123');
  });
});
