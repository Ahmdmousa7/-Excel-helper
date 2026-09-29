/**
 * Pure post-processing for OCR Extraction results, applied to the model's rows
 * BEFORE random SKUs are generated and before anything is shown or exported.
 * Kept out of OcrTab so each rule can be tested on plain arrays.
 */
import { HEADER_SYNONYMS, normalizeHeader } from './templateMapping';

type Row = Record<string, unknown>;

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Every column that appears in ANY row, in first-seen order, appended to `prev`.
 *
 * The mapping panel used to offer only the FIRST row's keys. A menu that opens
 * with a simple item therefore hid `Option 1`, `Option 1 Value` and the other
 * variant columns that only later rows carry, and the Variable sheet exported
 * them blank.
 */
export const collectHeaders = (rows: readonly unknown[], prev: readonly string[] = []): string[] => {
  const seen = new Set(prev);
  const out = [...prev];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); out.push(k); }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Price ranges
//
// BUSINESS RULE (product owner, 2026-09-29): a price written as a range is ONE
// row with Price 0 and the range in the Description as "Price range: X to Y".
// It is never split into one row per endpoint and never guessed as either end.
// ---------------------------------------------------------------------------

/** Price columns the rule applies to: Retail Price and the names the AI uses for it. */
const PRICE_HEADERS = new Set(['retail price', ...(HEADER_SYNONYMS['retail price'] ?? [])]);
/** Description columns, in the same way. */
const DESCRIPTION_HEADERS = new Set(['description', ...(HEADER_SYNONYMS['description'] ?? [])]);

const HYPHEN = '-';
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

/** Arabic-Indic (U+0660..) and Extended Arabic-Indic (U+06F0..) digits -> 0-9. */
const toWesternDigits = (s: string): string =>
  s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) & 0xf));

const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
const RANGE_RE = new RegExp(`${NUM}\\s*[${HYPHEN}${EN_DASH}${EM_DASH}]\\s*${NUM}`);

export interface PriceRange { from: string; to: string }

/**
 * The range in a price cell, or null. Text around it (`من 600 - 900 ريال`,
 * `SR 50-100`) is allowed; the endpoints come back exactly as written, with
 * Arabic-Indic digits read as Western ones. A number is never a range.
 */
export const parsePriceRange = (value: unknown): PriceRange | null => {
  if (typeof value !== 'string') return null;
  const m = RANGE_RE.exec(toWesternDigits(value));
  return m ? { from: m[1], to: m[2] } : null;
};

export const rangeDescription = (r: PriceRange): string => `Price range: ${r.from} to ${r.to}`;

const findKey = (row: Row, names: ReadonlySet<string>) =>
  Object.keys(row).find((k) => names.has(normalizeHeader(k)));

/**
 * Write the range text into the row's Description. An existing description is
 * kept and the range text follows it after "; ", so neither is lost. Returns
 * nothing: mutates the (already copied) row.
 */
const describeRange = (row: Row, r: PriceRange): void => {
  const key = findKey(row, DESCRIPTION_HEADERS) ?? 'Description';
  const text = rangeDescription(r);
  const current = hasOwn(row, key) ? String(row[key] ?? '').trim() : '';
  row[key] = !current ? text : current.includes(text) ? current : `${current}; ${text}`;
};

const OPTION_NAME = /^option (\d)$/;
const OPTION_VALUE = /^option (\d) value$/;

/**
 * An option DIMENSION the model invented for a range. Told to split ranges, it
 * did exactly that in the live run of 2026-09-29: `Option 2: "Range | المدى"`
 * with `Small | صغير` / `Large | كبير` on two otherwise identical Long rows.
 */
const RANGE_DIMENSION = /\brange\b|المدى|نطاق/i;

/** Option numbers on this row whose NAME marks them as an invented range dimension. */
const rangeDimensions = (row: Row): Set<string> => {
  const dims = new Set<string>();
  for (const k of Object.keys(row)) {
    const m = OPTION_NAME.exec(normalizeHeader(k));
    if (m && RANGE_DIMENSION.test(String(row[k] ?? ''))) dims.add(m[1]);
  }
  return dims;
};

/**
 * A row's variant identity: the same product, in the same category, with the
 * same option values — ignoring an invented "Range" dimension. Null for rows
 * with NO option value at all: two simple items that share a name are not a
 * split range, and are left alone.
 */
const variantIdentity = (row: Row, priceKey: string): string | null => {
  const opts: string[] = [];
  let product = '';
  let category = '';
  const skip = rangeDimensions(row);
  for (const k of Object.keys(row)) {
    const n = normalizeHeader(k);
    const v = String(row[k] ?? '').trim();
    const opt = OPTION_VALUE.exec(n);
    if (opt) { if (v && !skip.has(opt[1])) opts.push(`${n}=${v}`); }
    else if (n === 'product name' || n === 'name') product ||= v;
    else if (n === 'category') category = v;
  }
  if (!product || opts.length === 0 || !hasOwn(row, priceKey)) return null;
  return JSON.stringify([product, category, opts.sort()]);
};

const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  const n = Number(toWesternDigits(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const fmt = (n: number) => String(n);

export interface PriceRangeResult {
  rows: Row[];
  /** Rows whose price cell held a range. */
  ranges: number;
  /** Rows REMOVED because they were one endpoint of a range the model split. */
  mergedAway: number;
}

/**
 * Apply the price-range rule to extracted rows. Returns new row objects; the
 * input is not modified. Two cases:
 *
 * 1. A price cell holding a range (`600–900`, Arabic text around it allowed)
 *    becomes Price `0` and "Price range: 600 to 900" in the Description.
 * 2. Duplicate-variant protection: the model may still split a range into one
 *    row per endpoint (older prompts told it to). Rows with the same product,
 *    category and option values but DIFFERENT numeric prices are merged back
 *    into the first of them, with Price 0 and "Price range: min to max". An
 *    option dimension the model named "Range" / "المدى" for the split is
 *    ignored when comparing, and cleared on the merged row.
 *    Rows whose prices are equal are left alone — that is not a range.
 *
 * A single price (`600`, or the number 600) is never touched.
 */
export const applyPriceRanges = (input: readonly Row[]): PriceRangeResult => {
  const rows = input.map((r) => ({ ...r }));
  let ranges = 0;

  for (const row of rows) {
    const key = findKey(row, PRICE_HEADERS);
    if (!key) continue;
    const r = parsePriceRange(row[key]);
    if (!r) continue;
    row[key] = 0;
    describeRange(row, r);
    ranges++;
  }

  // Duplicate-variant protection.
  const groups = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = findKey(row, PRICE_HEADERS);
    if (!key) return;
    const id = variantIdentity(row, key);
    if (id === null) return;
    const g = groups.get(id);
    if (g) g.push(i); else groups.set(id, [i]);
  });

  const drop = new Set<number>();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const key = findKey(rows[idx[0]], PRICE_HEADERS)!;
    const prices = idx.map((i) => asNumber(rows[i][key]));
    if (prices.some((p) => p === null)) continue;
    const nums = prices as number[];
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    if (lo === hi) continue; // same price twice: a duplicate, but not a range
    const keep = rows[idx[0]];
    keep[key] = 0;
    // The invented Range dimension goes with the split it described.
    const dims = rangeDimensions(keep);
    for (const k of Object.keys(keep)) {
      const n = normalizeHeader(k);
      const m = OPTION_NAME.exec(n) ?? OPTION_VALUE.exec(n);
      if (m && dims.has(m[1])) keep[k] = '';
    }
    describeRange(keep, { from: fmt(lo), to: fmt(hi) });
    ranges++;
    for (const i of idx.slice(1)) drop.add(i);
  }

  return { rows: rows.filter((_, i) => !drop.has(i)), ranges, mergedAway: drop.size };
};
