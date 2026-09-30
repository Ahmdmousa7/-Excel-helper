import { describe, it, expect } from 'vitest';
import { dedupeRows } from '../../utils/dedupe';

/**
 * Deduplicate: which row survives, and the counts. Before 2026-09-30 this
 * logic lived inline in DeduplicateTool.tsx with no behavioural test.
 */
describe('dedupeRows', () => {
  const rows = [['A', 1], ['B', 2], ['A', 3], ['C', 4], ['A', 5]];

  it('keep-first keeps the first row of each group, in order, unchanged', () => {
    const r = dedupeRows(rows, [0], true);
    expect(r.kept).toEqual([['A', 1], ['B', 2], ['C', 4]]);
    expect([r.removed, r.groups]).toEqual([2, 1]);
  });

  it('remove-all removes every row of a group, and the count says so', () => {
    // Before: the count was 2 (group size minus 1) while 3 rows were removed.
    const r = dedupeRows(rows, [0], false);
    expect(r.kept).toEqual([['B', 2], ['C', 4]]);
    expect([r.removed, r.groups]).toEqual([3, 1]);
    expect(rows.length - r.removed).toBe(r.kept.length);
  });

  it('matches across invisible characters, keeping the original value', () => {
    const kasra = '6287013210006' + String.fromCharCode(0x0650);
    const zwsp = String.fromCharCode(0x200b) + '6287013210006';
    const rlm = '6287013210006' + String.fromCharCode(0x200f);
    const r = dedupeRows([[kasra, 'first'], ['6287013210006', 'b'], [zwsp, 'c'], [rlm, 'd']], [0], true);
    expect(r.kept).toEqual([[kasra, 'first']]);
    expect(r.removed).toBe(3);
  });

  it('does not strip leading zeros or punctuation (D7 rule 2)', () => {
    expect(dedupeRows([['00123'], ['123'], ['X-1'], ['X1']], [0], true).removed).toBe(0);
  });

  it('is case-insensitive and trims, as before; a multi-column key needs every column', () => {
    expect(dedupeRows([[' abc '], ['ABC']], [0], true).removed).toBe(1);
    expect(dedupeRows([['A', 1], ['A', 2], ['A', 1]], [0, 1], true).kept).toEqual([['A', 1], ['A', 2]]);
  });
});
