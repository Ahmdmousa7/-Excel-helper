/**
 * OCR review: find the rows of an OCR → Rewaa extraction a person should look at
 * before the file is used, so they check a handful of rows instead of all of them.
 *
 * Two kinds of check:
 *
 *   1. Static checks on the table itself (no AI): missing / non-numeric / zero
 *      price, a price far from the rest of its category, the same row twice,
 *      an empty name.
 *   2. A cross-check against a SECOND, independent reading of the same file
 *      (a much simpler prompt: item name + price only). A row whose price the
 *      second reading confirms is trusted; a different price is flagged with
 *      the second reading's price as a one-click fix; an item only the second
 *      reading found is offered as a missing row.
 *
 * Pure functions — the OCR tab keeps the second readings in state and
 * recomputes the review whenever the table changes.
 */
import { priceNumber, type Row } from './ocrRewaaExport';

export type ReviewLevel = 'error' | 'warn';

export type ReviewCode =
  | 'no-name' | 'no-price' | 'bad-price' | 'zero-price' | 'outlier' | 'duplicate'
  | 'price-mismatch' | 'unconfirmed';

export interface ReviewFlag {
  row: Row;
  level: ReviewLevel;
  code: ReviewCode;
  /** Prices to offer as a one-click fix (from the second reading, or a digit-converted price). */
  suggestions?: number[];
  /** Extra detail for the message, e.g. the category median. */
  detail?: string;
}

export interface SecondReadItem { name: string; price: number }

export interface MissingItem { sourceFile: string; name: string; price: number; key: string }

export interface ReviewResult {
  flags: ReviewFlag[];
  missing: MissingItem[];
}

/** The prompt for the second reading — deliberately different from, and simpler than, the main extraction. */
export const SECOND_READ_PROMPT = [
  'Read this menu / price list and list every price printed on it.',
  'Return ONLY a JSON array, no markdown: [{"name": "...", "price": 12}].',
  'Rules:',
  '- One entry for every price printed. If one item has several prices (sizes or options), add one entry per price and append the size/option label to the name (e.g. "Latte Large").',
  '- Copy the item name exactly as printed, in the same language. Do NOT translate.',
  '- Skip section titles and anything without a price.',
  '- "price" is a plain number with Western digits (convert ٠١٢٣٤٥٦٧٨٩). For a range like "20 - 30" use the first number.',
].join('\n');

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Arabic-Indic / Persian digits and the Arabic decimal separator → a plain number string. */
export function westernDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/٫/g, '.');
}

/** A price as the second reading or a fix would read it: digits converted, currency and spaces dropped. */
export function looseNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const m = westernDigits(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

/** The model's answer → `{name, price}` entries. Tolerates a ```json fence or an object wrapping the array. */
export function parseSecondRead(answer: string): SecondReadItem[] {
  const clean = answer.trim().replace(/```json|```/g, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(clean); } catch {
    const a = clean.indexOf('['), b = clean.lastIndexOf(']');
    if (a < 0 || b <= a) return [];
    try { parsed = JSON.parse(clean.slice(a, b + 1)); } catch { return []; }
  }
  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
    parsed = Object.values(parsed as Record<string, unknown>).find(Array.isArray) ?? [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SecondReadItem[] = [];
  for (const it of parsed) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const name = String(o.name ?? o['Product Name'] ?? o.item ?? '').trim();
    const price = looseNumber(o.price ?? o['Retail Price']);
    if (name && price !== undefined) out.push({ name, price });
  }
  return out;
}

/** Name normalisation for matching: case, Arabic letter forms, diacritics, punctuation. */
export function normName(s: string): string {
  return westernDigits(s)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // tashkeel, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** The comparable parts of a cell: `English | Arabic` → both, normalised; the `A`/`B` duplicate suffix dropped. */
export function nameParts(v: unknown): string[] {
  return String(v ?? '')
    .split('|')
    .map((p) => normName(p.replace(/\s[A-Z]\d*$/, '')))
    .filter((p) => p.length > 0);
}

const tokens = (s: string) => new Set(s.split(' ').filter(Boolean));

/** A normalised name with its word set, built once so matching allocates nothing per comparison. */
interface Prepared { s: string; t: Set<string> }
const prep = (s: string): Prepared => ({ s, t: tokens(s) });

function matchPrepared(a: Prepared, b: Prepared): boolean {
  if (!a.s || !b.s) return false;
  if (a.s === b.s) return true;
  const [short, long] = a.s.length <= b.s.length ? [a.s, b.s] : [b.s, a.s];
  if (short.length >= 3 && (` ${long} `).includes(` ${short} `)) return true;
  let shared = 0;
  a.t.forEach((t) => { if (b.t.has(t)) shared++; });
  return shared > 0 && shared / Math.min(a.t.size, b.t.size) >= 0.75 && shared / Math.max(a.t.size, b.t.size) >= 0.5;
}

/** Same item? Equal, one containing the other (≥ 3 letters), or most words shared. */
export const namesMatch = (a: string, b: string): boolean => matchPrepared(prep(a), prep(b));

const RANGE = /\d\s*[-–—]\s*\d/;
const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/** A price range row: the pipeline writes Price 0 and keeps the range in the Description on purpose. */
export const isRangeRow = (r: Row) => priceNumber(r['Retail Price']) === 0 && RANGE.test(String(r['Description'] ?? ''));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const OPTION_VALUES = ['Option 1 Value', 'Option 2 Value', 'Option 3 Value'];

/** Checks on the table alone. */
export function staticChecks(rows: readonly Row[]): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const byCat = new Map<string, number[]>();
  for (const r of rows) {
    const p = priceNumber(r['Retail Price']);
    if (p !== undefined && p > 0) {
      const c = String(r['Category'] ?? '');
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push(p);
    }
  }
  const seen = new Map<string, Row>();
  for (const r of rows) {
    if (blank(r['Product Name'])) { flags.push({ row: r, level: 'error', code: 'no-name' }); continue; }
    const raw = r['Retail Price'];
    const p = priceNumber(raw);
    if (blank(raw)) flags.push({ row: r, level: 'error', code: 'no-price' });
    else if (p === undefined) {
      const fix = looseNumber(raw);
      flags.push({ row: r, level: 'error', code: 'bad-price', suggestions: fix !== undefined ? [fix] : undefined });
    } else if (p === 0 && !isRangeRow(r)) flags.push({ row: r, level: 'warn', code: 'zero-price' });
    else if (p > 0) {
      const cat = byCat.get(String(r['Category'] ?? '')) ?? [];
      if (cat.length >= 4) {
        const m = median(cat);
        if (p > m * 5 || p < m / 5) flags.push({ row: r, level: 'warn', code: 'outlier', detail: String(m) });
      }
    }
    const key = [r['Product Name'], ...OPTION_VALUES.map((k) => r[k]), String(raw ?? '')].map((x) => String(x ?? '').trim()).join('\u0001');
    if (seen.has(key)) flags.push({ row: r, level: 'warn', code: 'duplicate' });
    else seen.set(key, r);
  }
  return flags;
}

/**
 * Compare the rows that came from one file with that file's second reading.
 * `secondReads` maps a Source File name to its entries; files without an entry
 * (text inputs, or a second reading that failed) are not cross-checked.
 */
export function crossCheck(rows: readonly Row[], secondReads: Readonly<Record<string, SecondReadItem[]>>): ReviewResult {
  const flags: ReviewFlag[] = [];
  const missing: MissingItem[] = [];
  for (const [src, entries] of Object.entries(secondReads)) {
    const fileRows = rows.filter((r) => String(r['Source File'] ?? '') === src);
    const entryNames = entries.map((e) => prep(normName(e.name)));
    const matched = new Array(entries.length).fill(false);
    for (const r of fileRows) {
      const parts = nameParts(r['Product Name']).map(prep);
      if (!parts.length) continue;
      const cand: number[] = [];
      entryNames.forEach((en, i) => { if (parts.some((p) => matchPrepared(p, en))) cand.push(i); });
      cand.forEach((i) => { matched[i] = true; });
      if (isRangeRow(r)) continue;
      const p = priceNumber(r['Retail Price']);
      if (p === undefined) continue; // the static checks already flag it
      if (!cand.length) { flags.push({ row: r, level: 'warn', code: 'unconfirmed' }); continue; }
      const prices = [...new Set(cand.map((i) => entries[i].price))];
      if (!prices.includes(p)) flags.push({ row: r, level: 'error', code: 'price-mismatch', suggestions: prices.slice(0, 4) });
    }
    entries.forEach((e, i) => {
      if (!matched[i]) missing.push({ sourceFile: src, name: e.name, price: e.price, key: `${src}\u0001${e.name}\u0001${e.price}` });
    });
  }
  return { flags, missing };
}

/** Both checks; a row flagged by both keeps both flags (the UI groups them per row). */
export function reviewRows(rows: readonly Row[], secondReads: Readonly<Record<string, SecondReadItem[]>>): ReviewResult {
  const cross = crossCheck(rows, secondReads);
  return { flags: [...staticChecks(rows), ...cross.flags], missing: cross.missing };
}

/** A row for an item only the second reading found: Simple, its name and price, the file it came from. */
export function missingItemRow(item: MissingItem): Row {
  return {
    'Product Name': item.name, 'Category': '', 'Type': 'Simple', 'Enable stock management': 'no',
    'Retail Price': item.price, 'Source File': item.sourceFile,
  };
}
