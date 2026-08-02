import { describe, it, expect } from 'vitest';
import { mergeDatasets } from '../../utils/mergeUtils';

// Row 0 is the header in every fixture — mergeDatasets assumes that.
const LEFT = [
  ['SKU', 'Name'],
  ['A-1', 'Widget'],
  ['A-2', 'Gadget'],
  ['A-3', 'Doohickey'],
];

const RIGHT = [
  ['Code', 'Price', 'Name'],
  ['A-1', '10'],
  ['A-2', '20'],
  ['A-9', '90'],
];

describe('mergeDatasets', () => {
  it('inner join keeps only rows present in both', () => {
    const out = mergeDatasets(LEFT, RIGHT, 0, 0, 'inner');

    expect(out[0]).toEqual(['SKU', 'Name', 'Price']); // 'Name' is deduped
    expect(out.slice(1)).toEqual([
      ['A-1', 'Widget', '10'],
      ['A-2', 'Gadget', '20'],
    ]);
  });

  it('left join keeps unmatched left rows and pads the added columns', () => {
    const out = mergeDatasets(LEFT, RIGHT, 0, 0, 'left');

    expect(out.slice(1)).toEqual([
      ['A-1', 'Widget', '10'],
      ['A-2', 'Gadget', '20'],
      ['A-3', 'Doohickey', ''],
    ]);
  });

  it('outer join also brings in unmatched right rows', () => {
    const out = mergeDatasets(LEFT, RIGHT, 0, 0, 'outer');
    const keys = out.slice(1).map((r) => r[0]);

    expect(keys).toContain('A-3'); // left-only
    expect(keys).toContain('A-9'); // right-only
    expect(out.slice(1)).toHaveLength(4);
  });

  it('matches keys case-insensitively and ignores surrounding whitespace', () => {
    const left = [['SKU'], ['  a-1  ']];
    const right = [['Code', 'Price'], ['A-1', '10']];

    const out = mergeDatasets(left, right, 0, 0, 'inner');
    expect(out.slice(1)).toEqual([['  a-1  ', '10']]);
  });

  it('does not duplicate a column whose header already exists on the left', () => {
    // 'Name' appears in both headers; only 'Price' should be appended.
    const out = mergeDatasets(LEFT, RIGHT, 0, 0, 'inner');
    expect(out[0].filter((h) => h === 'Name')).toHaveLength(1);
  });

  it('returns the non-empty side when one input is empty', () => {
    expect(mergeDatasets(LEFT, [], 0, 0, 'inner')).toBe(LEFT);
    expect(mergeDatasets([], RIGHT, 0, 0, 'inner')).toBe(RIGHT);
  });

  it('skips right rows whose key cell is undefined', () => {
    const right = [['Code', 'Price'], [undefined, '99'], ['A-1', '10']];
    const out = mergeDatasets(LEFT, right, 0, 0, 'inner');
    expect(out.slice(1)).toEqual([['A-1', 'Widget', '10']]);
  });

  it('joins on a non-zero key column', () => {
    const left = [['Name', 'SKU'], ['Widget', 'A-1']];
    const right = [['Price', 'Code'], ['10', 'A-1']];

    const out = mergeDatasets(left, right, 1, 1, 'inner');
    expect(out[0]).toEqual(['Name', 'SKU', 'Price']);
    expect(out[1]).toEqual(['Widget', 'A-1', '10']);
  });
});
