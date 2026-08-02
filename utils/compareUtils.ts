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
     map1.set(String(row[keyCol1]).trim().toLowerCase(), row);
  }

  for(let i=1; i<data2.length; i++) {
    const row = data2[i];
    if (!row || row[keyCol2] === undefined) continue;
    map2.set(String(row[keyCol2]).trim().toLowerCase(), row);
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
           
           if (decimalTolerance) {
               const n1 = Number(val1);
               const n2 = Number(val2);
               if (!isNaN(n1) && !isNaN(n2)) {
                   if (Math.abs(n1 - n2) > 0.05) {
                       isMismatch = true;
                       mismatchedCols.push(col1);
                   }
                   return; // Continue to next column
               }
           }
           
           if (fuzzyMatch) {
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
