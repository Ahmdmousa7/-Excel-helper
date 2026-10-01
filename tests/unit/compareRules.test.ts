import { describe, it, expect } from 'vitest';
import { compareDatasets, buildCompareExport, toCsv, aiInsightsRows, neutraliseFormula } from '../../utils/compareUtils';

/**
 * Compare behaviour adopted from the ExcelDiff AI reference package
 * (2026-09-30). Every test here fails on the code before that change.
 */
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

describe('compareDatasets: matching rules from the reference package', () => {
  const sheet = (rows: unknown[][]) => [['Key', 'Value'], ...rows];
  const run = (a: unknown[][], b: unknown[][], fuzzy = false, tol = false) =>
    compareDatasets(sheet(a), sheet(b), 0, 0, { 1: 1 }, fuzzy, tol).summary;

  it('fuzzy match does not treat numbers that differ by one digit as equal', () => {
    // Before: 92% similar, so two different barcodes were a "match".
    expect(run([['A', '6287013210006']], [['A', '6287013210007']], true).mismatches).toBe(1);
    expect(run([['A', '10000.5']], [['A', '10000.9']], true).mismatches).toBe(1);
    expect(run([['A', '6287013210006']], [['A', '6287013210006']], true).matches).toBe(1);
  });

  it('fuzzy match still forgives small differences in text', () => {
    expect(run([['A', 'Blue Widget']], [['A', 'Blue Widgets']], true).matches).toBe(1);
  });

  it('decimal tolerance does not equate an empty cell with a number', () => {
    // Before: Number('') is 0, so a blank price matched 0 and 0.03.
    expect(run([['A', '']], [['A', '0']], false, true).mismatches).toBe(1);
    expect(run([['A', '']], [['A', '0.03']], false, true).mismatches).toBe(1);
    expect(run([['A', '10.00']], [['A', '10.04']], false, true).matches).toBe(1);
    expect(run([['A', '']], [['A', '']], false, true).matches).toBe(1);
  });

  it('keys ignore invisible characters (D7 rule 3) but not leading zeros (D7 rule 2)', () => {
    const kasra = '6287013210006' + String.fromCharCode(0x0650);
    const zwsp = String.fromCharCode(0x200b) + 'SKU-1';
    const r = compareDatasets(
      sheet([[kasra, 'x'], [zwsp, 'y'], ['00123', 'z']]),
      sheet([['6287013210006', 'x'], ['SKU-1', 'y'], ['123', 'z']]),
      0, 0, { 1: 1 },
    );
    expect(r.summary.matches).toBe(2);
    expect(r.summary.missingIn1).toBe(1); // 123
    expect(r.summary.missingIn2).toBe(1); // 00123
  });
});

describe('buildCompareExport, toCsv, aiInsightsRows', () => {
  const date = new Date(Date.UTC(2026, 8, 29));
  const diffs = [
    { key: 'a', status: 'mismatch' as const, data1: ['a', 12.5, date], data2: ['a', 13, null], mismatchedColumns: [1] },
    { key: 'b', status: 'missing_in_2' as const, data1: ['b', 7, null] },
  ];
  const out = buildCompareExport(diffs, ['Key', 'Price', 'Date'], ['Key', 'Price', 'Date'], { 1: 1, 2: 2 });

  it('keeps cell values as read: numbers stay numbers, dates stay dates', () => {
    // Before: every File1_/File2_ cell went through String(...) and was text in Excel.
    expect(out[0]).toEqual(['Status', 'Key', 'Differences', 'Differences Description',
      'File1_Key', 'File1_Price', 'File1_Date', 'File2_Key', 'File2_Price', 'File2_Date']);
    expect(out[1].slice(0, 4)).toEqual(['MISMATCH', 'a', 'Price', 'Price: 12.5 > 13']);
    expect(out[1][5]).toBe(12.5);
    expect(out[1][6]).toBe(date);
    expect(out[1][9]).toBe('');
    expect(out[2].slice(0, 4)).toEqual(['MISSING_IN_2', 'b', '', 'Row missing in File 2']);
    expect(out[2].slice(7)).toEqual(['', '', '']);
  });

  it('CSV keeps #, quotes, commas and Arabic intact', () => {
    // Before: a data: URI through encodeURI, so the file ended at the first `#`.
    const csv = toCsv([['Item #3', 'say "hi"', 'a,b', 'حمص'], [1, null]]);
    expect(csv).toBe(['"Item #3","say ""hi""","a,b","حمص"', '"1",""'].join(NL));
  });

  it('AI Insights: one line per row', () => {
    expect(aiInsightsRows(['one', 'two' + CR, 'three'].join(NL))).toEqual([['AI Insights'], ['one'], ['two'], ['three']]);
  });
});

describe('CSV formula injection (OWASP "CSV injection")', () => {
  const TAB = String.fromCharCode(9);
  const CRC = String.fromCharCode(13);

  it.each([
    ['=SUM(A1:A9)', "'=SUM(A1:A9)"],
    ['=HYPERLINK("http://example.com","x")', `'=HYPERLINK("http://example.com","x")`],
    ["+cmd|'/C calc'!A0", "'+cmd|'/C calc'!A0"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['-', "'-"],
    ['-Infinity', "'-Infinity"],
    [TAB + '=1+1', "'" + TAB + '=1+1'],
    [CRC + '=1+1', "'" + CRC + '=1+1'],
  ])('neutralises %j', (input, output) => {
    expect(neutraliseFormula(input)).toBe(output);
  });

  it.each([
    [12.5, '12.5'], [-5, '-5'], [0, '0'],           // real numbers
    ['-5', '-5'], ['+3.5', '+3.5'], ['-1e5', '-1e5'], ['+966501234567', '+966501234567'], // plain numbers as text
    ['0.03', '0.03'], ['00123', '00123'],         // leading zeros kept (D7)
    ['Item #3', 'Item #3'], ['a=b', 'a=b'], [' =x', ' =x'], // `=` not first
    ['حمص', 'حمص'], ['say "hi"', 'say "hi"'], ['', ''], [null, ''], [undefined, ''],
  ])('leaves %j exactly as it is', (input, output) => {
    expect(neutraliseFormula(input)).toBe(output);
  });

  it('a date is written as before', () => {
    const d = new Date(Date.UTC(2026, 8, 29));
    expect(neutraliseFormula(d)).toBe(String(d));
  });

  it('toCsv neutralises inside correct quoting, and ordinary cells are byte-for-byte as before', () => {
    expect(toCsv([['=1+1', '="x"', '-5', 'Item #3', 'حمص', 'say "hi"', 7]])).toBe(
      `"'=1+1","'=""x""","-5","Item #3","حمص","say ""hi""","7"`,
    );
  });
});

describe('compareKey normalisation, as documented', () => {
  const keyMatch = (a: string, b: string) =>
    compareDatasets([['K', 'V'], [a, 'x']], [['K', 'V'], [b, 'x']], 0, 0, { 1: 1 }).summary.matches === 1;

  it('a combining Latin accent (decomposed) is removed, so `e` + U+0301 matches `e`', () => {
    expect(keyMatch('cafe' + String.fromCharCode(0x0301), 'cafe')).toBe(true);
  });

  it('a precomposed letter is kept: `é` (U+00E9) does not match `e`', () => {
    expect(keyMatch('caf' + String.fromCharCode(0x00e9), 'cafe')).toBe(false);
  });

  it('case is ignored for Compare keys', () => {
    expect(keyMatch('SKU-A', 'sku-a')).toBe(true);
  });
});
