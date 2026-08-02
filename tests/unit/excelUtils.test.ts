import { describe, it, expect } from 'vitest';
import { cleanEmptyColumns, extractSheets } from '../../utils/excelUtils';

describe('cleanEmptyColumns', () => {
  it('drops columns that are empty from the start row down', () => {
    const data = [
      ['SKU', 'Notes', 'Price'],
      ['A-1', '', '10'],
      ['A-2', '   ', '20'],
    ];
    const { cleanedData, droppedCount, retainedCount } = cleanEmptyColumns(data, 1);

    expect(droppedCount).toBe(1);
    expect(retainedCount).toBe(2);
    expect(cleanedData).toEqual([
      ['SKU', 'Price'],
      ['A-1', '10'],
      ['A-2', '20'],
    ]);
  });

  it('treats whitespace-only cells as empty', () => {
    const data = [['h'], ['  '], ['\t']];
    expect(cleanEmptyColumns(data, 1).droppedCount).toBe(1);
  });

  it('keeps a column when any row below the start row has a value', () => {
    const data = [['h'], [''], ['', 'x']];
    // Column 1 is empty on the header row but populated on the last row.
    expect(cleanEmptyColumns(data, 1).retainedCount).toBe(1);
  });

  it('keeps a column whose only content is above the start row', () => {
    // The header itself is not scanned when starting_row_index is 1, so a
    // header-only column is dropped. This documents intended behaviour: the
    // caller asked to judge emptiness from row 1 down.
    const data = [['SKU', 'Legacy'], ['A-1', ''], ['A-2', '']];
    const { cleanedData, droppedCount } = cleanEmptyColumns(data, 1);
    expect(droppedCount).toBe(1);
    expect(cleanedData[0]).toEqual(['SKU']);
  });

  it('handles ragged rows without throwing', () => {
    const data = [['a', 'b', 'c'], ['1'], ['1', '2']];
    expect(() => cleanEmptyColumns(data, 1)).not.toThrow();
    // Column 2 has no value at or below row 1, so it is dropped.
    expect(cleanEmptyColumns(data, 1).droppedCount).toBe(1);
  });

  it('returns an empty result for empty input rather than throwing', () => {
    expect(cleanEmptyColumns([], 0)).toEqual({
      cleanedData: [],
      droppedCount: 0,
      retainedCount: 0,
    });
  });

  it('preserves zero and false as real values', () => {
    // A regression guard: a truthiness check here would silently drop a
    // price column full of legitimate zeroes.
    const data = [['qty'], [0], [0]];
    expect(cleanEmptyColumns(data as unknown[][], 1).droppedCount).toBe(0);
  });
});

describe('extractSheets', () => {
  it('returns the workbook sheet names', () => {
    expect(extractSheets({ SheetNames: ['Sheet1', 'Data'] })).toEqual(['Sheet1', 'Data']);
  });

  it('returns an empty array when the workbook has no sheet names', () => {
    expect(extractSheets({})).toEqual([]);
  });
});
