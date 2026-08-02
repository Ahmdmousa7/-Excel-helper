import { describe, it, expect } from 'vitest';
import { compareDatasets, calculateSimilarity } from '../../utils/compareUtils';

const A = [
  ['SKU', 'Price'],
  ['A-1', '10'],
  ['A-2', '20'],
  ['A-3', '30'],
];

const B = [
  ['Code', 'Cost'],
  ['A-1', '10'],   // match
  ['A-2', '99'],   // mismatch
  ['A-4', '40'],   // only in B
];

const MAP = { 1: 1 }; // compare A column 1 against B column 1

describe('calculateSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(calculateSimilarity('widget', 'widget')).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(calculateSimilarity('Widget', 'WIDGET')).toBe(1);
  });

  it('returns 1 when both strings are empty', () => {
    expect(calculateSimilarity('', '')).toBe(1);
  });

  it('scores a near-match high and an unrelated pair low', () => {
    expect(calculateSimilarity('widget', 'widgets')).toBeGreaterThan(0.8);
    expect(calculateSimilarity('widget', 'zzzzzz')).toBeLessThan(0.3);
  });

  it('is symmetric', () => {
    expect(calculateSimilarity('alpha', 'alphb')).toBeCloseTo(
      calculateSimilarity('alphb', 'alpha'),
      10,
    );
  });
});

describe('compareDatasets', () => {
  it('classifies matches, mismatches, and rows missing from each side', () => {
    const { summary } = compareDatasets(A, B, 0, 0, MAP);

    expect(summary).toEqual({
      matches: 1,      // A-1
      mismatches: 1,   // A-2
      missingIn2: 1,   // A-3 is not in B
      missingIn1: 1,   // A-4 is not in A
    });
  });

  it('records which columns differ on a mismatch', () => {
    const { diffs } = compareDatasets(A, B, 0, 0, MAP);
    const mismatch = diffs.find((d) => d.status === 'mismatch');

    expect(mismatch?.key).toBe('a-2');
    expect(mismatch?.mismatchedColumns).toEqual([1]);
  });

  it('emits one diff row per distinct key', () => {
    const { diffs } = compareDatasets(A, B, 0, 0, MAP);
    expect(diffs).toHaveLength(4); // A-1, A-2, A-3, A-4
  });

  it('normalises keys for case and whitespace', () => {
    const left = [['SKU', 'Price'], ['  a-1 ', '10']];
    const right = [['Code', 'Cost'], ['A-1', '10']];

    expect(compareDatasets(left, right, 0, 0, MAP).summary.matches).toBe(1);
  });

  it('decimalTolerance treats a sub-0.05 numeric drift as a match', () => {
    const left = [['SKU', 'Price'], ['A-1', '10.00']];
    const right = [['Code', 'Cost'], ['A-1', '10.04']];

    expect(compareDatasets(left, right, 0, 0, MAP, false, false).summary.mismatches).toBe(1);
    expect(compareDatasets(left, right, 0, 0, MAP, false, true).summary.matches).toBe(1);
  });

  it('decimalTolerance still flags a drift above the threshold', () => {
    const left = [['SKU', 'Price'], ['A-1', '10.00']];
    const right = [['Code', 'Cost'], ['A-1', '10.50']];

    expect(compareDatasets(left, right, 0, 0, MAP, false, true).summary.mismatches).toBe(1);
  });

  it('fuzzyMatch accepts a near-identical string that exact matching rejects', () => {
    const left = [['SKU', 'Name'], ['A-1', 'Blue Widget']];
    const right = [['Code', 'Title'], ['A-1', 'Blue Widgets']];

    expect(compareDatasets(left, right, 0, 0, MAP, false, false).summary.mismatches).toBe(1);
    expect(compareDatasets(left, right, 0, 0, MAP, true, false).summary.matches).toBe(1);
  });

  it('treats null and undefined cells as empty strings rather than throwing', () => {
    const left = [['SKU', 'Price'], ['A-1', null]];
    const right = [['Code', 'Cost'], ['A-1', undefined]];

    expect(() => compareDatasets(left, right, 0, 0, MAP)).not.toThrow();
    expect(compareDatasets(left, right, 0, 0, MAP).summary.matches).toBe(1);
  });

  it('reports everything as missing when one side has only a header', () => {
    const { summary } = compareDatasets(A, [['Code', 'Cost']], 0, 0, MAP);
    expect(summary.missingIn2).toBe(3);
    expect(summary.matches).toBe(0);
  });

  it('an empty column mapping makes every shared key a match', () => {
    const { summary } = compareDatasets(A, B, 0, 0, {});
    expect(summary.matches).toBe(2);   // A-1 and A-2 both present, nothing compared
    expect(summary.mismatches).toBe(0);
  });
});
