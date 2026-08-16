import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  readGrid,
  normalizeKey,
  buildLookup,
  writeSheet,
  formatCell,
  type Grid,
  type CellInfo,
  type LookupOptions,
} from '../../utils/lookupEngine';

/**
 * Smart Lookup had no tests of any kind (TD-044), which is why four defects
 * survived in it — including one where the preview and the exported file
 * disagreed (TD-043).
 *
 * These cover the engine both callers now share. The preview/export agreement
 * itself is asserted end to end in `e2e/smart-lookup.spec.ts`; here the job is
 * the join, and every input shape a spreadsheet can produce.
 */

/** Build a grid from plain values, the way a sheet of text and numbers reads. */
const grid = (rows: any[][]): Grid =>
  rows.map((r) => r.map((v) => ({ v, t: typeof v === 'number' ? 'n' : 's' })));

const opts = (over: Partial<LookupOptions> = {}): LookupOptions => ({
  matchCol: 0,
  lookupCol: 0,
  returnCols: [1],
  smartMode: true,
  hasHeaders: true,
  notFoundValue: 'Not Found',
  ...over,
});

const REF = grid([
  ['Key', 'Value'],
  ['A-1', 'alpha'],
  ['A-2', 'beta'],
]);

describe('normalizeKey', () => {
  it('is case-insensitive and trims, as the tool always has been', () => {
    // Both are MORE lenient than Excel's VLOOKUP, deliberately — pinned so the
    // leniency is a decision rather than something that drifts.
    expect(normalizeKey({ v: '  A-1  ' }, false)).toBe('a-1');
    expect(normalizeKey({ v: 'A-1' }, false)).toBe(normalizeKey({ v: 'a-1' }, false));
  });

  it('strips leading zeros only in Smart Match, and only for all-digit keys', () => {
    expect(normalizeKey({ v: '007' }, true)).toBe('7');
    expect(normalizeKey({ v: 7 }, true)).toBe('7');
    // The guard that stops "Item-01" becoming "item-1".
    expect(normalizeKey({ v: 'Item-01' }, true)).toBe('item-01');
    expect(normalizeKey({ v: '007' }, false)).toBe('007');
  });

  it('refuses to key on an ERROR cell', () => {
    // TD-047. With raw values an error arrives as SheetJS's numeric code, so
    // `#N/A` could normalise to "15" and match a genuine key of 15 — a wrong row
    // reported as a successful match.
    expect(normalizeKey({ v: 15, t: 'e' }, true)).toBeNull();
    expect(normalizeKey({ v: 42, t: 'e' }, false)).toBeNull();
    // The same number as a real value is still a key.
    expect(normalizeKey({ v: 15, t: 'n' }, true)).toBe('15');
  });

  it('refuses to key on blanks and nullish values', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(normalizeKey({ v }, true), String(v)).toBeNull();
    }
    expect(normalizeKey(undefined, true)).toBeNull();
  });
});

describe('buildLookup', () => {
  it('matches exactly and appends the return column', () => {
    const source = grid([['SKU'], ['A-1'], ['A-2']]);
    const r = buildLookup(source, REF, opts());
    expect(r.found).toBe(2);
    expect(r.missing).toBe(0);
    expect(r.rows.map((row) => row[1].v)).toEqual(['alpha', 'beta']);
  });

  it('takes the FIRST row for a duplicated key, as Excel does', () => {
    // The heart of TD-043. Both VLOOKUP and XLOOKUP return the first match; the
    // old export returned the last.
    const dupRef = grid([
      ['Key', 'Value'],
      ['A-1', 'FIRST'],
      ['A-1', 'LAST'],
    ]);
    const source = grid([['SKU'], ['A-1']]);
    const r = buildLookup(source, dupRef, opts());
    expect(r.rows[0][1].v).toBe('FIRST');
  });

  it('flags which rows missed, so the preview need not guess from the text', () => {
    // The preview used to decide this by comparing against the literal string
    // "Not Found", which broke the moment the marker became configurable and
    // localised — an Arabic user lost the red highlighting entirely.
    const source = grid([['SKU'], ['A-1'], ['A-9'], ['A-2']]);
    const r = buildLookup(source, REF, opts({ notFoundValue: 'anything at all' }));
    expect(r.missingFlags).toEqual([false, true, false]);
    expect(r.missingFlags).toHaveLength(r.rows.length);
  });

  it('reports a miss without inventing a row', () => {
    const source = grid([['SKU'], ['A-9']]);
    const r = buildLookup(source, REF, opts());
    expect(r.found).toBe(0);
    expect(r.missing).toBe(1);
    expect(r.rows[0][1].v).toBe('Not Found');
  });

  it('uses the caller\'s not-found value, including an empty one', () => {
    const source = grid([['SKU'], ['A-9']]);
    expect(buildLookup(source, REF, opts({ notFoundValue: '' })).rows[0][1].v).toBe('');
    expect(buildLookup(source, REF, opts({ notFoundValue: '—' })).rows[0][1].v).toBe('—');
  });

  it('matches a number against its text spelling under Smart Match', () => {
    const numRef = grid([['Key', 'Value'], [7, 'seven']]);
    const source = grid([['SKU'], ['007']]);
    expect(buildLookup(source, numRef, opts()).rows[0][1].v).toBe('seven');
    // …and not when Smart Match is off.
    expect(buildLookup(source, numRef, opts({ smartMode: false })).rows[0][1].v).toBe('Not Found');
  });

  it('leaves a blank lookup key unmatched rather than matching a blank row', () => {
    const source = grid([['SKU'], ['']]);
    const r = buildLookup(source, REF, opts());
    expect(r.missing).toBe(1);
  });

  it('never indexes a blank reference key', () => {
    const blankRef = grid([['Key', 'Value'], ['', 'should not match']]);
    const source = grid([['SKU'], ['']]);
    expect(buildLookup(source, blankRef, opts()).rows[0][1].v).toBe('Not Found');
  });

  it('returns several columns in the order they were chosen', () => {
    const wide = grid([
      ['Key', 'A', 'B', 'C'],
      ['A-1', 'a', 'b', 'c'],
    ]);
    const source = grid([['SKU'], ['A-1']]);
    const r = buildLookup(source, wide, opts({ returnCols: [3, 1] }));
    expect(r.rows[0].slice(1).map((c) => c.v)).toEqual(['c', 'a']);
    expect(r.header).toEqual(['SKU', 'C', 'A']);
  });

  it('can return a column to the LEFT of the key, which VLOOKUP cannot', () => {
    const leftRef = grid([
      ['Name', 'Key'],
      ['Widget', 'A-1'],
    ]);
    const source = grid([['SKU'], ['A-1']]);
    const r = buildLookup(source, leftRef, opts({ matchCol: 1, returnCols: [0] }));
    expect(r.rows[0][1].v).toBe('Widget');
  });

  it('carries the number FORMAT of the matched cell', () => {
    // TD-045. A date is a number plus a format; dropping `z` is what turned a
    // returned date into 46037.
    const dated: Grid = [
      [{ v: 'Key' }, { v: 'When' }],
      [{ v: 'A-1' }, { v: 46037, t: 'n', z: 'm/d/yy' }],
    ];
    const source = grid([['SKU'], ['A-1']]);
    const cell = buildLookup(source, dated, opts()).rows[0][1];
    expect(cell.v).toBe(46037);
    expect(cell.z, 'the date format was dropped').toBe('m/d/yy');
  });

  it('does not match an error cell in the reference against a number', () => {
    const errRef: Grid = [
      [{ v: 'Key' }, { v: 'Value' }],
      [{ v: 15, t: 'e' }, { v: 'from an error row' }],
    ];
    const source = grid([['SKU'], [15]]);
    expect(buildLookup(source, errRef, opts()).rows[0][1].v).toBe('Not Found');
  });

  it('does not match an error cell in the SOURCE against a number', () => {
    const numRef = grid([['Key', 'Value'], [15, 'fifteen']]);
    const source: Grid = [[{ v: 'SKU' }], [{ v: 15, t: 'e' }]];
    expect(buildLookup(source, numRef, opts()).rows[0][1].v).toBe('Not Found');
  });

  it('treats every row as data when there are no headers', () => {
    // The first record used to be eaten as a header with no way to say otherwise.
    const source = grid([['A-1'], ['A-2']]);
    const noHeadRef = grid([['A-1', 'alpha'], ['A-2', 'beta']]);
    const r = buildLookup(source, noHeadRef, opts({ hasHeaders: false }));
    expect(r.rows).toHaveLength(2);
    expect(r.found).toBe(2);
    expect(r.header).toBeNull();
  });

  it('preserves booleans and numbers as themselves', () => {
    const typed: Grid = [
      [{ v: 'Key' }, { v: 'Num' }, { v: 'Flag' }],
      [{ v: 'A-1' }, { v: 42, t: 'n' }, { v: true, t: 'b' }],
    ];
    const source = grid([['SKU'], ['A-1']]);
    const r = buildLookup(source, typed, opts({ returnCols: [1, 2] }));
    expect(r.rows[0][1].v).toBe(42);
    expect(r.rows[0][2].v).toBe(true);
  });

  it('handles a reference row shorter than the return column', () => {
    const ragged: Grid = [
      [{ v: 'Key' }, { v: 'Value' }],
      [{ v: 'A-1' }],
    ];
    const source = grid([['SKU'], ['A-1']]);
    expect(() => buildLookup(source, ragged, opts())).not.toThrow();
    expect(buildLookup(source, ragged, opts()).rows[0][1].v).toBe('');
  });

  it('scales to thousands of rows and keeps first-match order', () => {
    const ref: Grid = [[{ v: 'Key' }, { v: 'Value' }]];
    for (let i = 0; i < 5000; i++) ref.push([{ v: `K-${i}` }, { v: `v${i}` }]);
    // A second block of duplicates, all of which must lose to the first block.
    for (let i = 0; i < 5000; i++) ref.push([{ v: `K-${i}` }, { v: `DUP${i}` }]);

    const source: Grid = [[{ v: 'SKU' }]];
    for (let i = 0; i < 5000; i++) source.push([{ v: `K-${i}` }]);

    const r = buildLookup(source, ref, opts());
    expect(r.found).toBe(5000);
    expect(r.rows[0][1].v).toBe('v0');
    expect(r.rows[4999][1].v).toBe('v4999');
  });
});

describe('writeSheet', () => {
  const rows = (): CellInfo[][] => [
    [{ v: 'A-1' }, { v: 46037, t: 'n', z: 'yyyy-mm-dd' }],
  ];

  it('reapplies each cell\'s number format', () => {
    // TD-045. `aoa_to_sheet` writes values only, so without this a date is the
    // number 46037 in the exported file.
    const ws = writeSheet(XLSX, ['Key', 'When'], rows());
    expect(ws['B2'].v).toBe(46037);
    expect(ws['B2'].z).toBe('yyyy-mm-dd');
  });

  it('does NOT throw when a header title is empty', () => {
    // TD-046. `aoa_to_sheet` creates no cell for a blank header, and the old code
    // dereferenced it — the download failed with "Cannot read properties of
    // undefined" and no way round it but renaming the column.
    expect(() => writeSheet(XLSX, ['Key', ''], rows())).not.toThrow();
    expect(() => writeSheet(XLSX, ['', ''], rows())).not.toThrow();
  });

  it('styles the header cells that exist', () => {
    const ws = writeSheet(XLSX, ['Key', 'When'], rows());
    expect(ws['A1'].s?.font?.bold).toBe(true);
  });

  it('writes data with no header row at all', () => {
    const ws = writeSheet(XLSX, null, rows());
    expect(ws['A1'].v).toBe('A-1');
    expect(ws['B1'].z).toBe('yyyy-mm-dd');
  });

  it('survives a ragged row without inventing cells', () => {
    const ragged: CellInfo[][] = [[{ v: 'only' }], [{ v: 'a' }, { v: 'b' }]];
    expect(() => writeSheet(XLSX, null, ragged)).not.toThrow();
  });
});

describe('formatCell', () => {
  it('renders a formatted number through its format', () => {
    expect(formatCell(XLSX, { v: 46037, t: 'n', z: 'yyyy-mm-dd' })).toBe('2026-01-15');
  });

  it('leaves an unformatted value alone', () => {
    expect(formatCell(XLSX, { v: 46037, t: 'n' })).toBe('46037');
    expect(formatCell(XLSX, { v: 'text' })).toBe('text');
  });

  it('falls back to the raw value on an unusable format string', () => {
    // A preview is not worth failing over a format SheetJS cannot render.
    expect(formatCell(XLSX, { v: 1, t: 'n', z: '[[[' })).toBe('1');
  });

  it('renders blanks as empty rather than "undefined"', () => {
    expect(formatCell(XLSX, undefined)).toBe('');
    expect(formatCell(XLSX, { v: null })).toBe('');
  });
});

describe('readGrid', () => {
  it('reads values, types and formats off a real worksheet', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Key', 'When'],
      ['A-1', 46037],
    ]);
    ws['B2'].z = 'm/d/yy';
    const g = readGrid(XLSX, ws);
    expect(g[1][0].v).toBe('A-1');
    expect(g[1][1].v).toBe(46037);
    expect(g[1][1].z).toBe('m/d/yy');
  });

  it('fills a missing cell rather than leaving a hole', () => {
    const ws = XLSX.utils.aoa_to_sheet([['A', 'B'], ['only']]);
    const g = readGrid(XLSX, ws);
    expect(g[1]).toHaveLength(2);
    expect(g[1][1].v).toBe('');
  });

  it('returns nothing for an empty or missing sheet', () => {
    expect(readGrid(XLSX, undefined)).toEqual([]);
    expect(readGrid(XLSX, {})).toEqual([]);
  });
});
