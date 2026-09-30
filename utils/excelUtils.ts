import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';

/**
 * CleanTool utility
 * Removes columns that contain only empty spaces or nulls from a starting row downwards.
 */
export const cleanEmptyColumns = (data: any[][], starting_row_index: number): { cleanedData: any[][], droppedCount: number, retainedCount: number } => {
  if (!data || data.length === 0) return { cleanedData: [], droppedCount: 0, retainedCount: 0 };
  const rowCount = data.length;
  let colCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] && data[i].length > colCount) colCount = data[i].length;
  }

  // A start row past the last row used to leave nothing to check, so every
  // column counted as empty and the whole sheet was dropped. Check every row
  // instead, as the reference implementation does: a column that is empty
  // everywhere still goes, and nothing with data is lost.
  const firstRow = starting_row_index < rowCount ? starting_row_index : 0;

  const colsToDrop = new Set<number>();
  for (let c = 0; c < colCount; c++) {
    let isEmpty = true;
    for (let r = firstRow; r < rowCount; r++) {
      if (!data[r]) continue;
      const val = data[r][c];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) {
      colsToDrop.add(c);
    }
  }

  const cleanedData = data.map(row => {
    const newRow: any[] = [];
    for (let c = 0; c < colCount; c++) {
      if (!colsToDrop.has(c)) {
        newRow.push(row ? row[c] : undefined);
      }
    }
    return newRow;
  });

  return {
    cleanedData,
    droppedCount: colsToDrop.size,
    retainedCount: colCount - colsToDrop.size
  };
};

/**
 * SplitterTool utility
 */
export const extractSheets = (workbook: any): string[] => {
  return workbook.SheetNames || [];
};

export const exportToExcelSingleSheet = (data: any[][], sheetName: string): ArrayBuffer => {
  const wb = XLSX_STYLE.utils.book_new();
  // Build with the PLAIN library, write with the styled one. TD-049.
  //
  // `xlsx-js-style` sits on the SheetJS 0.18.5 base (TD-022), whose
  // `aoa_to_sheet` converts a JS `Date` to a serial through local time
  // incorrectly. The error is small but signed, and Excel TRUNCATES a serial for
  // display — so at UTC+14 and UTC-11 the drift went negative and 15 Jan was
  // rendered as `1/14/26`. A wrong date, silently, depending on where the user
  // sat. It is invisible under UTC, so CI could never have caught it.
  //
  // `aoa_to_sheet` is where Date → serial happens; `write` only serialises what
  // it is given. So building with the maintained fork and writing with the
  // styled library keeps full style support while the styled library never sees
  // a `Date`. Verified by XML inspection in
  // `tests/unit/exporterStyleCharacterization.test.ts`: cell styles, number
  // formats, column widths and plain-cell output are byte-identical either way.
  //
  // This does NOT address format fidelity — `dd/mm/yyyy` still exports as
  // `m/d/yy`. That is the other half of TD-049 and a larger change.
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX_STYLE.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  const buffer = XLSX_STYLE.write(wb, { bookType: 'xlsx', type: 'array' });
  return buffer;
};

/**
 * The same names, made unique for use as file names in one ZIP: the first
 * `Cleaned_a_Sheet1` stays as it is, the next becomes `Cleaned_a_Sheet1-2`,
 * and so on. Compared case-insensitively, as Windows and macOS file systems
 * do. Without this, a second entry with the same name silently REPLACED the
 * first inside the archive.
 */
export function uniqueNames(names: readonly string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    let candidate = name;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name}-${n}`;
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

/**
 * A worksheet name Excel accepts, unique within `taken` (which it updates).
 *
 * Excel rejects `: \ / ? * [ ]`, a leading or trailing apostrophe, names over
 * 31 characters, and two sheets whose names differ only in case — SheetJS
 * throws on each, which is how `Sales.csv` + `Sales.xlsx` crashed Merge's
 * download. Clashes get ` (2)`, ` (3)` …, still within 31 characters. Arabic and
 * other text is kept as it is.
 */
export function safeSheetName(raw: unknown, taken: Set<string>): string {
  const cleaned = String(raw ?? '')
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '')
    .trim();
  const base = (cleaned || 'Sheet').slice(0, 31);
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = `${base.slice(0, 31 - suffix.length).trimEnd()}${suffix}`;
  }
  taken.add(name.toLowerCase());
  return name;
}
