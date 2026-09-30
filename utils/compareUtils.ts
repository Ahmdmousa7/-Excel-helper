import { identifierKey } from './identifiers';

export interface CompareSummary {
  matches: number;
  mismatches: number;
  missingIn1: number;
  missingIn2: number;
}

export interface DiffRow {
  key: string;
  status: 'match' | 'mismatch' | 'missing_in_1' | 'missing_in_2';
  data1?: any[];
  data2?: any[];
  mismatchedColumns?: number[]; // indices of original file 1 columns that differ
}

/**
 * Calculates similarities between two strings for fuzzy matching
 */
export const calculateSimilarity = (s1: string, s2: string): number => {
  let longer = s1.toLowerCase();
  let shorter = s2.toLowerCase();
  if (s1.length < s2.length) {
    longer = s2.toLowerCase();
    shorter = s1.toLowerCase();
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
};

const editDistance = (s1: string, s2: string): number => {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

/**
 * A plain number as written in a cell — `10`, `-3.5`, `6287013210006`.
 * Blank is NOT a number: `Number('')` is 0, which would make an empty price
 * equal a price of 0.
 */
const isNumeric = (v: string): boolean => v !== '' && Number.isFinite(Number(v));

/**
 * The key two rows are matched on: the cell as text, with invisible
 * characters removed (zero-width spaces, direction marks, a trailing kasra —
 * `identifierKey`, decision D7 rule 3), then trimmed and lower-cased as
 * before. Leading zeros and punctuation are kept: `00123` is not `123`.
 */
const compareKey = (v: unknown): string => identifierKey(v).toLowerCase();

/**
 * Compares two datasets based on a primary key and mapped columns.
 */
export const compareDatasets = (
  data1: any[][],
  data2: any[][],
  keyCol1: number,
  keyCol2: number,
  columnMapping: Record<number, number>, // File 1 Col Index -> File 2 Col Index
  fuzzyMatch: boolean = false,
  decimalTolerance: boolean = false
): { diffs: DiffRow[], summary: CompareSummary } => {
  
  const map1 = new Map<string, any[]>();
  const map2 = new Map<string, any[]>();
  
  // Skip headers if present, assume row 0 is header.
  for(let i=1; i<data1.length; i++) {
     const row = data1[i];
     if (!row || row[keyCol1] === undefined) continue;
     map1.set(compareKey(row[keyCol1]), row);
  }

  for(let i=1; i<data2.length; i++) {
    const row = data2[i];
    if (!row || row[keyCol2] === undefined) continue;
    map2.set(compareKey(row[keyCol2]), row);
  }

  let matches = 0;
  let mismatches = 0;
  let missingIn2 = 0;
  let missingIn1 = 0;
  
  const diffs: DiffRow[] = [];

  // Check everything in map1 against map2
  map1.forEach((row1, key) => {
    if (map2.has(key)) {
       const row2 = map2.get(key)!;
       let isMismatch = false;
       const mismatchedCols: number[] = [];

       Object.entries(columnMapping).forEach(([col1Str, col2]) => {
           const col1 = Number(col1Str);
           const val1 = String(row1[col1] ?? '').trim();
           const val2 = String(row2[col2] ?? '').trim();
           
           // Tolerance applies to two numbers only — never to a blank, which
           // `Number('')` would otherwise read as 0.
           if (decimalTolerance) {
               const n1 = Number(val1);
               const n2 = Number(val2);
               if (isNumeric(val1) && isNumeric(val2)) {
                   if (Math.abs(n1 - n2) > 0.05) {
                       isMismatch = true;
                       mismatchedCols.push(col1);
                   }
                   return; // Continue to next column
               }
           }
           
           // Fuzzy similarity is for text. Two numbers are compared exactly:
           // barcodes `6287013210006` and `6287013210007` are 92% similar,
           // and a fuzzy match would report two different products as equal.
           if (fuzzyMatch && !(isNumeric(val1) && isNumeric(val2))) {
               if (calculateSimilarity(val1, val2) < 0.85) {
                   isMismatch = true;
                   mismatchedCols.push(col1);
               }
           } else {
               if (val1 !== val2) {
                   isMismatch = true;
                   mismatchedCols.push(col1);
               }
           }
       });

       if (isMismatch) {
           mismatches++;
           diffs.push({ key, status: 'mismatch', data1: row1, data2: row2, mismatchedColumns: mismatchedCols });
       } else {
           matches++;
           diffs.push({ key, status: 'match', data1: row1, data2: row2 });
       }
       map2.delete(key); // Remove so we know what's missing in map1
    } else {
       missingIn2++;
       diffs.push({ key, status: 'missing_in_2', data1: row1 });
    }
  });

  // Whatever is left in map2 is missing in map1
  map2.forEach((row2, key) => {
     missingIn1++;
     diffs.push({ key, status: 'missing_in_1', data2: row2 });
  });

  return {
      diffs,
      summary: { matches, mismatches, missingIn1, missingIn2 }
  };
};

/**
 * The comparison report as rows: a header, then one row per diff.
 *
 * The File1_/File2_ cells keep the value AS READ — a number stays a number,
 * a date stays a date — so the exported workbook can be summed and filtered.
 * They used to be converted to text, which Excel flags on every cell and
 * which turned dates into strings such as `Mon Sep 29 2026 …`.
 */
export const buildCompareExport = (
  diffs: readonly DiffRow[],
  headers1: readonly unknown[],
  headers2: readonly unknown[],
  columnMapping: Readonly<Record<number, number>>,
): unknown[][] => {
  const out: unknown[][] = [
    ['Status', 'Key', 'Differences', 'Differences Description', ...headers1.map((h) => `File1_${h}`), ...headers2.map((h) => `File2_${h}`)],
  ];
  for (const diff of diffs) {
    let diffNames = '';
    let diffDesc = '';
    if (diff.status === 'missing_in_1') diffDesc = 'Row missing in File 1';
    else if (diff.status === 'missing_in_2') diffDesc = 'Row missing in File 2';
    else if (diff.status === 'match') diffDesc = 'Rows perfectly match';
    else {
      const cols = (diff.mismatchedColumns || []).map((c) => headers1[c] || `Col ${c}`).filter(Boolean).join(' , ');
      diffNames = cols;
      const detail = (diff.mismatchedColumns || []).map((c1) => {
        const c2 = columnMapping[c1];
        const colName = headers1[c1] || `Col ${c1}`;
        const val1 = diff.data1 ? String(diff.data1[c1] ?? '') : '';
        const val2 = (diff.data2 && c2 !== undefined && c2 !== -1) ? String(diff.data2[c2] ?? '') : '';
        return `${colName}: ${val1} > ${val2}`;
      }).join(' - ');
      diffDesc = detail || `Mismatched values in: ${cols}`;
    }
    out.push([
      diff.status.toUpperCase(),
      diff.key,
      diffNames,
      diffDesc,
      ...(diff.data1 || new Array(headers1.length).fill('')).map((c) => c ?? ''),
      ...(diff.data2 || new Array(headers2.length).fill('')).map((c) => c ?? ''),
    ]);
  }
  return out;
};

/** RFC 4180-style CSV: every cell quoted, quotes doubled. `#`, commas and Arabic pass through. */
export const toCsv = (rows: readonly (readonly unknown[])[]): string =>
  rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

/** The AI Insights sheet: one line of the analysis per row, not the whole text in one cell. */
export const aiInsightsRows = (analysis: string): string[][] =>
  [['AI Insights'], ...analysis.split(/\r?\n/).map((line) => [line])];
