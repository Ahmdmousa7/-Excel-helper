/**
 * Grouping Files Validation errors and fixes into one output sheet each.
 *
 * Pure functions: the component decides what a row looks like and how a sheet
 * is styled; this decides which rows go on which sheet, and what it is called.
 */

/**
 * The error a message is an instance of.
 *
 * Messages carry per-row detail — `Loss Alert: Cost (12.00) > Retail (10.00)`
 * has different numbers on every row, and category messages quote the value
 * that clashed. Grouping on the raw text would produce one sheet per row. So:
 *   - drop a leading `[Column]: ` — the column is visible in the sheet itself;
 *   - keep only the part before a `:` (`Loss Alert`, `Pack 1 Mismatch`);
 *   - remove quoted values and parenthesised detail;
 *   - tidy the spacing and trailing punctuation left behind.
 */
export function errorCategory(message: string): string {
  let s = String(message ?? '').trim();
  s = s.replace(/^\[[^\]]*\]:\s*/, '');
  const colon = s.indexOf(':');
  if (colon > 0) s = s.slice(0, colon);
  s = s.replace(/\([^)]*\)/g, ' ').replace(/'[^']*'/g, ' ');
  s = s.replace(/\s+/g, ' ').replace(/\s+([.,;])/g, '$1').replace(/[\s.,;:]+$/, '').trim();
  return s || 'Other';
}

/**
 * The fix an action log entry is an instance of. Parenthesised detail is the
 * field name (`Normalized Boolean (Sellable)`) and is dropped for the same
 * reason as above; the rows on the sheet show which field changed.
 */
export function fixCategory(action: string): string {
  const s = String(action ?? '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return s || 'Other';
}

/** Characters Excel forbids in a sheet name. */
const FORBIDDEN = /[\\/?*[\]:]/g;
const MAX_SHEET_NAME = 31;

/**
 * A valid, unique sheet name: forbidden characters removed, cut to Excel's
 * 31-character limit, and suffixed ` (2)`, ` (3)` … when two categories would
 * otherwise truncate to the same name. `used` is compared case-insensitively,
 * as Excel does, and is updated.
 */
export function sheetNameFor(prefix: string, category: string, used: Set<string>): string {
  const clean = `${prefix}${category}`.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim();
  const fits = (s: string) => s.slice(0, MAX_SHEET_NAME).trim();
  let name = fits(clean);
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = `${clean.slice(0, MAX_SHEET_NAME - suffix.length).trim()}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

export type IssueGroup = {
  kind: 'error' | 'fix';
  category: string;
  /** Row indices into the processed data, ascending, each at most once. */
  rows: number[];
};

/**
 * One group per error category and per fix category, restricted to `inScope`
 * rows — the whole file for a single export, one chunk for a ZIP part.
 *
 * Errors come before fixes, and within each kind categories are sorted, so the
 * sheet order is stable across runs rather than depending on which row
 * happened to fail first.
 */
export function groupIssues(
  errors: ReadonlyArray<{ rowIndex: number; msg: string }>,
  actions: ReadonlyArray<readonly string[] | undefined>,
  inScope: (rowIndex: number) => boolean = () => true,
): IssueGroup[] {
  const collect = (entries: Iterable<[number, string]>) => {
    const byCat = new Map<string, Set<number>>();
    for (const [rowIndex, category] of entries) {
      if (!inScope(rowIndex)) continue;
      if (!byCat.has(category)) byCat.set(category, new Set());
      byCat.get(category)!.add(rowIndex);
    }
    return [...byCat.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, set]) => ({ category, rows: [...set].sort((x, y) => x - y) }));
  };

  const errorEntries = errors.map((e) => [e.rowIndex, errorCategory(e.msg)] as [number, string]);
  const fixEntries: [number, string][] = [];
  actions.forEach((list, rowIndex) => {
    for (const a of list ?? []) fixEntries.push([rowIndex, fixCategory(a)]);
  });

  return [
    ...collect(errorEntries).map((g) => ({ kind: 'error' as const, ...g })),
    ...collect(fixEntries).map((g) => ({ kind: 'fix' as const, ...g })),
  ];
}

/**
 * Rows listed per issue sheet. Every row on an issue sheet is a COPY of a row
 * already in Validated Data, so without a limit a large file in which most rows
 * share one issue would roughly double the export's size and build time. The
 * cap is visible — see issueCapNote — never a silent truncation.
 */
export const MAX_ISSUE_SHEET_ROWS = 10_000;

export function capIssueRows(
  rows: readonly number[],
  max: number = MAX_ISSUE_SHEET_ROWS,
): { shown: number[]; hidden: number } {
  return { shown: rows.slice(0, max), hidden: Math.max(0, rows.length - max) };
}

/** The last row of a capped sheet, saying exactly how much is missing and where it is. */
export const issueCapNote = (hidden: number, max: number = MAX_ISSUE_SHEET_ROWS): string =>
  `… ${hidden} more row${hidden === 1 ? '' : 's'} not listed here (this sheet shows the first ${max}). ` +
  `Every row is in "Validated Data".`;
