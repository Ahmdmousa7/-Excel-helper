/**
 * Duplicate rows, for the Deduplicate tool. Pure — no React, no SheetJS — so
 * which row survives can be tested directly.
 *
 * Moved out of `DeduplicateTool.tsx` unchanged except for two things:
 *
 *   - the key ignores invisible characters (`identifierKey`, decision D7 rule
 *     3): a barcode with a stray zero-width space or trailing kasra is the same
 *     barcode. Leading zeros still count — `00123` is not `123` (D7 rule 2);
 *   - `removed` is the number of rows actually removed. In "remove all
 *     duplicates" mode every row of a group goes, and the count used to say
 *     one fewer, so Original − Duplicates did not equal Surviving.
 */
import { identifierKey } from './identifiers';

export interface DedupeResult {
  /** The data rows that survive, in their original order and unchanged. */
  kept: unknown[][];
  /** Rows removed. `dataRows.length - kept.length`. */
  removed: number;
  /** Keys that occurred more than once. */
  groups: number;
}

export function dedupeRows(dataRows: readonly unknown[][], cols: readonly number[], keepFirst: boolean): DedupeResult {
  const occurrences = new Map<string, number[]>();
  dataRows.forEach((row, rowIdx) => {
    const key = cols.map((c) => identifierKey(row[c]).toLowerCase()).join('|||');
    const list = occurrences.get(key);
    if (list) list.push(rowIdx);
    else occurrences.set(key, [rowIdx]);
  });

  const keep = new Set<number>();
  let groups = 0;
  occurrences.forEach((rowIndices) => {
    if (rowIndices.length > 1) {
      groups++;
      if (keepFirst) keep.add(rowIndices[0]);
      // Remove-all mode keeps none of them.
    } else {
      keep.add(rowIndices[0]);
    }
  });

  const kept = dataRows.filter((_, i) => keep.has(i)) as unknown[][];
  return { kept, removed: dataRows.length - kept.length, groups };
}
