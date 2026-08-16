/**
 * The Smart Lookup engine: one exact-match join, in one place.
 *
 * It exists because there were two of it. `runLookup` built an index keyed on
 * the FIRST row for a duplicated key and `handleDownload` rebuilt it keeping the
 * LAST, so the preview a user approved and the file they downloaded disagreed —
 * with nothing on screen to say the download re-ran the join rather than saving
 * what was shown (TD-043). The component now calls this once and exports what it
 * already has.
 *
 * It works on CELLS rather than bare values. That is not decoration: the value
 * alone cannot tell you that `46037` is a date rather than a number (TD-045), or
 * that a key is `#N/A` rather than the number 15 (TD-047). Both are cell facts —
 * `z` and `t` — and both were lost the moment the old code flattened a sheet to
 * an array of values.
 */

export interface CellInfo {
  /** The raw value: number, string, boolean, or SheetJS's error code. */
  v: any;
  /** SheetJS cell type. `'e'` is an error cell, `'n'` number, `'s'` string. */
  t?: string;
  /** Number format. Carrying this is what keeps a date a date on the way out. */
  z?: string;
}

export type Grid = CellInfo[][];

export interface LookupOptions {
  /** Column index in the reference grid whose values are the keys. */
  matchCol: number;
  /** Column index in the source grid holding the values to look up. */
  lookupCol: number;
  /** Column indexes in the reference grid to append to each source row. */
  returnCols: number[];
  /**
   * Ignore type and leading zeros — `"007"` matches `7`, `"1"` matches `1`.
   * A superset of Excel, and the reason this tool exists; off, matching is still
   * case- and whitespace-insensitive, which Excel's `VLOOKUP` is not.
   */
  smartMode: boolean;
  /** Treat row 0 as headers. When false, every row is data. */
  hasHeaders: boolean;
  /** What to write when nothing matched. */
  notFoundValue: string;
}

export interface LookupResult {
  /** Header row for the output, or null when `hasHeaders` is false. */
  header: string[] | null;
  /** Every output row, source columns followed by the return columns. */
  rows: CellInfo[][];
  /**
   * `true` where that row found no match, aligned to `rows`.
   *
   * The preview used to decide this by comparing the cell text to the literal
   * string "Not Found", which stopped being true the moment the marker became
   * configurable and localised — a user with a custom marker, or reading Arabic,
   * lost the red highlighting entirely. A fact from the join should not have to
   * be re-derived from its own output.
   */
  missingFlags: boolean[];
  found: number;
  missing: number;
}

/** Read a worksheet into cells, preserving what the values alone cannot carry. */
export function readGrid(XLSX: any, worksheet: any): Grid {
  if (!worksheet || !worksheet['!ref']) return [];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const grid: Grid = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: CellInfo[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      // `v: ""` for a missing cell, matching the `defval: ""` the rest of the app
      // reads sheets with, so a short row does not become `undefined` holes.
      row.push(cell ? { v: cell.v, t: cell.t, z: cell.z } : { v: '' });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * The matching rule. `null` means "this cell cannot be a key".
 *
 * An ERROR cell returns null. With raw values, `#N/A` arrives as SheetJS's
 * numeric error code, so it used to normalise to a digit string and could match
 * a genuine key of that number — a wrong row reported as a successful match,
 * which is the worst way for a lookup to fail (TD-047). Excel propagates the
 * error; refusing to key on it is the same refusal.
 */
export function normalizeKey(cell: CellInfo | undefined, smartMode: boolean): string | null {
  if (!cell) return null;
  if (cell.t === 'e') return null;
  if (cell.v === null || cell.v === undefined) return null;

  const str = String(cell.v).trim();
  if (str === '') return null;

  // Leading zeros only when the whole string is digits, so "Item-01" survives.
  if (smartMode && /^\d+$/.test(str)) return String(Number(str));
  return str.toLowerCase();
}

/**
 * Join the source grid to the reference grid.
 *
 * FIRST match wins for a duplicated key, which is what `VLOOKUP` and `XLOOKUP`
 * both do. The old export kept the last; this is the half that was correct.
 */
export function buildLookup(source: Grid, ref: Grid, options: LookupOptions): LookupResult {
  const { matchCol, lookupCol, returnCols, smartMode, hasHeaders, notFoundValue } = options;
  const firstDataRow = hasHeaders ? 1 : 0;

  const index = new Map<string, CellInfo[]>();
  for (let i = firstDataRow; i < ref.length; i++) {
    const key = normalizeKey(ref[i][matchCol], smartMode);
    // `!index.has(key)` is the first-match rule. Without it the last duplicate
    // wins, which is the bug this engine replaced.
    if (key !== null && !index.has(key)) index.set(key, ref[i]);
  }

  const header = hasHeaders && source.length > 0
    ? [
        ...source[0].map((c) => String(c.v ?? '')),
        ...returnCols.map((i) => String(ref[0]?.[i]?.v ?? '')),
      ]
    : null;

  const rows: CellInfo[][] = [];
  const missingFlags: boolean[] = [];
  let found = 0;
  let missing = 0;

  for (let i = firstDataRow; i < source.length; i++) {
    const key = normalizeKey(source[i][lookupCol], smartMode);
    const match = key === null ? undefined : index.get(key);
    const out: CellInfo[] = [...source[i]];

    if (match) {
      found++;
      // The matched cell wholesale — `z` included, which is what makes a
      // returned date still a date rather than the number 46037.
      for (const c of returnCols) out.push(match[c] ?? { v: '' });
    } else {
      missing++;
      for (const _ of returnCols) out.push({ v: notFoundValue, t: 's' });
    }
    rows.push(out);
    missingFlags.push(!match);
  }

  return { header, rows, missingFlags, found, missing };
}

/**
 * Display text for one cell, for the preview table.
 *
 * Applies the number format when there is one, because the preview's whole job
 * is to show what the file will contain. Without this the screen showed `46037`
 * while the exported file showed `2026-01-15` — the same data, but a user
 * checking one against the other has no way to know that.
 */
export function formatCell(XLSX: any, cell: CellInfo | undefined): string {
  if (!cell || cell.v === null || cell.v === undefined) return '';
  if (cell.t === 'n' && cell.z) {
    try {
      return XLSX.SSF.format(cell.z, cell.v);
    } catch {
      // A format string SheetJS cannot render is not worth failing a preview
      // over; the raw value is still true.
    }
  }
  return String(cell.v);
}

/**
 * Turn result rows into a worksheet, carrying number formats across.
 *
 * Shared by the single-file and batch-ZIP exports, which used to build their
 * sheets separately — and only one of them styled the header, so a batch file
 * looked different from a single file for no reason anyone chose.
 *
 * Two fixes live here:
 *
 * **Formats (TD-045).** `aoa_to_sheet` writes values only, so a date — a number
 * plus a format — came out as `46037`. Each cell's `z` is reapplied afterwards,
 * which fixes dates and, for free, currency and percent.
 *
 * **The header-styling crash (TD-046).** `if (!ws[ref].s)` dereferenced a cell
 * that `aoa_to_sheet` never creates for a blank header, so choosing a return
 * column with no header title made the download fail with "Cannot read
 * properties of undefined" and no way round it but renaming the column.
 */
export function writeSheet(
  XLSX: any,
  header: string[] | null,
  rows: CellInfo[][],
  styleHeader = true,
): any {
  const aoa: any[][] = [];
  if (header) aoa.push(header);
  for (const row of rows) aoa.push(row.map((c) => c.v));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const offset = header ? 1 : 0;

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const z = rows[r][c]?.z;
      if (!z) continue;
      const cell = ws[XLSX.utils.encode_cell({ r: r + offset, c })];
      if (cell) cell.z = z;
    }
  }

  if (header && styleHeader) {
    for (let c = 0; c < header.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      // The guard. A blank header title produces no cell at all.
      if (!cell) continue;
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F46E5' } },
      };
    }
  }

  return ws;
}
