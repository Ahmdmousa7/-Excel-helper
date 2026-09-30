/**
 * OCR → Rewaa export: the six-sheet workbook and the ZIP bundle.
 *
 * The CONTRACT is `tests/fixtures/ocr-rewaa/correct-output.xlsx`, supplied by
 * the product owner on 2026-09-30 together with the input it came from
 * (`source.xlsx`) and the file the app produced before this module existed
 * (`wrong-output.xlsx`). `tests/unit/ocrRewaaExport.test.ts` runs the source's
 * extraction through this module and compares every cell with that file.
 *
 * Three cells differ from it ON PURPOSE (product owner, 2026-09-30):
 *   - Rewaa Variable `Option 1` carries the real option name (`Size | الحجم`),
 *     as Rewaa's own template sample does — the fixture wrote the literal text
 *     `Option 1` on every row, which loses the option name on import;
 *   - the audit sheet's `File Size` is the real size (the fixture said `0.0 KB`);
 *   - its `Verification Notes` say how many rows differ instead of claiming
 *     "verified parity" while five rows were marked not identical.
 *
 * Pure: no React, no DOM, and the spreadsheet and ZIP libraries are passed in,
 * as `parseCsvTemplate` does, so the unit suite exercises exactly this code.
 */

import type * as XLSXNS from 'xlsx';
import type JSZipNS from 'jszip';
import { toYesNo, isVariableRow, resolveSourceKey, normalizeHeader } from './templateMapping';
import { applyPriceRanges } from './ocrPostProcess';

export type Row = Record<string, unknown>;

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

const text = (v: unknown): string => (isBlank(v) ? '' : String(v).trim());

// ---------------------------------------------------------------------------
// 1. Normalisation of the model's rows
// ---------------------------------------------------------------------------

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-z]/;

/** Text fields the prompt asks the model to make bilingual. */
export const BILINGUAL_FIELDS = [
  'Product Name', 'Category', 'Description',
  'Option 1', 'Option 1 Value', 'Option 2', 'Option 2 Value', 'Option 3', 'Option 3 Value',
] as const;

/**
 * `Arabic | English` → `English | Arabic`, the order the contract uses on every
 * bilingual cell. The prompt asks for it too, but the model follows the
 * source's language first often enough (178 of 180 rows in the wrong file)
 * that the order has to be fixed here, deterministically.
 *
 * Deliberately narrow: exactly two parts, the first with Arabic letters and no
 * Latin ones, the second the reverse. Anything else — one language, mixed
 * text, three parts — is returned unchanged rather than guessed at. The parts
 * themselves are not touched: no trimming, no digit conversion.
 */
export function englishFirst(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const parts = value.split(' | ');
  if (parts.length !== 2) return value;
  const [a, b] = parts;
  const arabicOnly = ARABIC.test(a) && !LATIN.test(a);
  const latinOnly = LATIN.test(b) && !ARABIC.test(b);
  return arabicOnly && latinOnly ? `${b} | ${a}` : value;
}

export function normalizeBilingual(rows: readonly Row[]): Row[] {
  return rows.map((row) => {
    const out: Row = { ...row };
    for (const f of BILINGUAL_FIELDS) if (f in out) out[f] = englishFirst(out[f]);
    return out;
  });
}

const OPTION_KEYS = ['Option 1', 'Option 1 Value', 'Option 2', 'Option 2 Value', 'Option 3', 'Option 3 Value'];

/** `4.00` → 4. Undefined for anything that is not a plain number — no digit conversion. */
export function priceNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !/^\s*-?\d+(\.\d+)?\s*$/.test(v)) return undefined;
  return Number(v);
}

export const SIZE_OPTION = 'Size | الحجم';
export const SIZE_VALUES = ['Small | صغير', 'Large | كبير'] as const;

/**
 * Two SIMPLE rows with the same name and category, no options, and two
 * different prices are one product in two sizes: the cheaper is `Small`, the
 * dearer `Large` (`أصابع الوافل` 14 / 20 and `طبق كيلة` 65 / 150 in the
 * fixture — a menu that lists a price per size without naming the sizes).
 *
 * Only pairs. The contract shows pairs and nothing else, so a group of three
 * or more is left alone and counted, for the caller to report, rather than
 * given invented `Medium` labels. Equal prices, a missing price, or any option
 * already present also leave the rows alone — those are duplicates or real
 * variants, not sizes.
 */
export function inferSizeVariants(rows: readonly Row[]): { rows: Row[]; pairs: number; skipped: number } {
  const groups = new Map<string, number[]>();
  rows.forEach((row, i) => {
    if (isVariableRow(row)) return;
    if (OPTION_KEYS.some((k) => !isBlank(row[k]))) return;
    const name = text(row['Product Name']);
    if (!name) return;
    const key = `${name}\u0000${text(row['Category'])}`;
    const list = groups.get(key) ?? [];
    list.push(i);
    groups.set(key, list);
  });

  const out = rows.map((r) => ({ ...r }));
  let pairs = 0;
  let skipped = 0;
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const prices = idx.map((i) => priceNumber(rows[i]['Retail Price']));
    if (idx.length > 2) { skipped++; continue; }
    if (prices.some((p) => p === undefined) || prices[0] === prices[1]) continue;
    const order = prices[0]! < prices[1]! ? [0, 1] : [1, 0];
    order.forEach((pos, rank) => {
      const r = out[idx[pos]];
      r['Type'] = 'Variable';
      r['Option 1'] = SIZE_OPTION;
      r['Option 1 Value'] = SIZE_VALUES[rank];
      // A code the model read for the "simple" row is this size's code.
      if (!isBlank(r['Product SKU']) && isBlank(r['Variant SKU'])) r['Variant SKU'] = r['Product SKU'];
      r['Product SKU'] = '';
    });
    pairs++;
  }
  return { rows: out, pairs, skipped };
}

/**
 * `GEN-<n>` for every row with no SKU in the column its type uses. Unique
 * within `used`, which the caller shares across a whole run — Rewaa rejects a
 * duplicate SKU, and random numbers alone collide about once in sixty runs of
 * this size. Extracted SKUs are kept exactly as text (`00123` stays `00123`).
 */
export function fillRandomSkus(rows: readonly Row[], used: Set<string>, rand: () => number = Math.random): Row[] {
  for (const r of rows) {
    for (const k of ['Product SKU', 'Variant SKU']) if (!isBlank(r[k])) used.add(text(r[k]));
  }
  return rows.map((row) => {
    const key = isVariableRow(row) ? 'Variant SKU' : 'Product SKU';
    if (!isBlank(row[key])) return row;
    let sku: string;
    do sku = `GEN-${Math.floor(rand() * 1000000)}`; while (used.has(sku));
    used.add(sku);
    return { ...row, [key]: sku };
  });
}

/**
 * The same name in two categories gets a letter per category, in category
 * order (`Latte | لاتيه A` cold, `B` hot). Moved here unchanged from OcrTab so
 * the regression test covers it; the letters are part of the contract.
 */
export function resolveDuplicateNames(rows: readonly Row[]): { rows: Row[]; modified: number } {
  if (rows.length === 0) return { rows: [...rows], modified: 0 };
  const keys = Object.keys(rows[0]);
  const nameKey = keys.find((k) => ['product name', 'name', 'item', 'description'].includes(k.toLowerCase()));
  const catKey = keys.find((k) => ['category', 'group', 'section'].includes(k.toLowerCase()));
  if (!nameKey || !catKey) return { rows: [...rows], modified: 0 };

  const nameToCats = new Map<string, Set<string>>();
  for (const r of rows) {
    const name = String(r[nameKey] || '').trim();
    const cat = String(r[catKey] || '').trim();
    if (name && cat) {
      if (!nameToCats.has(name)) nameToCats.set(name, new Set());
      nameToCats.get(name)!.add(cat);
    }
  }
  const suffixes = new Map<string, Map<string, string>>();
  nameToCats.forEach((cats, name) => {
    if (cats.size < 2) return;
    const m = new Map<string, string>();
    Array.from(cats).sort().forEach((cat, counter) => {
      const letter = String.fromCharCode(65 + (counter % 26));
      m.set(cat, counter >= 26 ? ` ${letter}${Math.floor(counter / 26)}` : ` ${letter}`);
    });
    suffixes.set(name, m);
  });

  let modified = 0;
  const out = rows.map((r) => {
    const name = String(r[nameKey] || '').trim();
    const suffix = suffixes.get(name)?.get(String(r[catKey] || '').trim());
    if (!suffix) return r;
    modified++;
    return { ...r, [nameKey]: `${name}${suffix}` };
  });
  return { rows: out, modified };
}

export interface BatchResult {
  rows: Row[];
  ranges: number;
  mergedAway: number;
  sizePairs: number;
  sizeGroupsSkipped: number;
}

/**
 * One input's rows, from the model's answer to export-ready — the exact
 * sequence the OCR tab runs for an OCR → Rewaa extraction:
 *
 *   price ranges → English first → size pairs → `Source File` → random SKUs
 *
 * Ranges come first so a merged-away duplicate never gets a SKU; sizes before
 * SKUs so a new variant gets a VARIANT SKU. Duplicate names across categories
 * are resolved later, over the whole run (`resolveDuplicateNames`).
 */
export function prepareRewaaBatch(
  answer: readonly unknown[],
  opts: { sourceFile: string; usedSkus: Set<string>; randomSkus: boolean; rand?: () => number },
): BatchResult {
  const ranged = applyPriceRanges(answer.filter((r): r is Row => !!r && typeof r === 'object' && !Array.isArray(r)));
  const sized = inferSizeVariants(normalizeBilingual(ranged.rows));
  const tagged = sized.rows.map((r) => ({ ...r, 'Source File': opts.sourceFile }));
  return {
    rows: opts.randomSkus ? fillRandomSkus(tagged, opts.usedSkus, opts.rand) : tagged,
    ranges: ranged.ranges,
    mergedAway: ranged.mergedAway,
    sizePairs: sized.pairs,
    sizeGroupsSkipped: sized.skipped,
  };
}

// ---------------------------------------------------------------------------
// 2. The workbook
// ---------------------------------------------------------------------------

export const SHEETS = {
  all: 'Generic All Data',
  simple: 'Generic Simple',
  variable: 'Generic Variable',
  rewaaSimple: 'Rewaa Simple Products',
  rewaaVariable: 'Rewaa Variable Products',
  audit: 'Source Files & Audit',
} as const;

/** Rewaa's two import templates, column for column (`tests/fixtures/rewaa-*-template.csv`). */
export const REWAA_SIMPLE_HEADERS = [
  'Product Name', 'Product SKU', 'Barcode', 'Category', 'Supplier', 'Brand', 'Description',
  'Sellable', 'Purchasable', 'Enable stock management', 'Weighted', 'Tracked by batch', 'Tracked by serial',
  'Retail Price', 'Wholesale Price', 'Cost', 'Buy Price', 'Tax Code', 'DEF Quantity',
  ...[1, 2, 3].flatMap((n) => ['Label', 'Size', 'SKU', 'Barcode', 'DEF Retail Price', 'DEF Buy Price', 'Sellable', 'Purchasable']
    .map((f) => `Pack${n} ${f}`)),
] as const;

export const REWAA_VARIABLE_HEADERS = [
  'Product Name', 'Category', 'Supplier', 'Brand', 'Description',
  'Option 1', 'Option 1 Value', 'Option 2', 'Option 2 Value', 'Option 3', 'Option 3 Value',
  'Variant Name', 'Variant SKU', 'Variant BARCODE', 'Variant DESCRIPTION',
  'Sellable', 'Purchasable', 'Enable stock management', 'Weighted', 'Tracked by batch', 'Tracked by serial',
  'Retail Price', 'Wholesale Price', 'Cost', 'Buy Price', 'Tax Code', 'DEF Quantity',
] as const;

/**
 * Written when the extraction has nothing, per the contract. Pack columns and
 * Tax Code stay blank. `Retail Price` IS here, at 0 (product owner,
 * 2026-09-30): the Generic sheets keep the blank, and the row is marked
 * `Rewaa Data Identical = FALSE`, so a free product never passes unseen.
 */
const REWAA_DEFAULTS: Readonly<Record<string, string | number>> = {
  'sellable': 'yes', 'purchasable': 'yes',
  'weighted': 'no', 'tracked by batch': 'no', 'tracked by serial': 'no',
  'retail price': 0, 'wholesale price': 0, 'cost': 0, 'buy price': 0, 'def quantity': 0,
};

/** Approved Rewaa rule (2026-09-29, reaffirmed 2026-09-30): always `no`, whatever was extracted. */
const REWAA_FIXED: Readonly<Record<string, string>> = { 'enable stock management': 'no' };

const YES_NO = new Set(['sellable', 'purchasable', 'weighted', 'tracked by batch', 'tracked by serial',
  ...[1, 2, 3].flatMap((n) => [`pack${n} sellable`, `pack${n} purchasable`])]);
const NUMERIC = new Set(['retail price', 'wholesale price', 'cost', 'buy price', 'def quantity',
  ...[1, 2, 3].flatMap((n) => [`pack${n} def retail price`, `pack${n} def buy price`])]);

/** The extracted column feeding a Rewaa column — the mapping panel's own resolver, synonyms included. */
function sourceValue(row: Row, header: string): unknown {
  const key = resolveSourceKey(header, Object.keys(row));
  return key === undefined ? undefined : row[key];
}

/**
 * `Product Name | Option 1 Value | …`, blank without a name or any option
 * value — a variant with no option is not a variant, and a guessed name would
 * hide that.
 */
export function variantNameOf(row: Row): string {
  const name = text(row['Product Name']);
  const values = ['Option 1 Value', 'Option 2 Value', 'Option 3 Value'].map((k) => text(row[k])).filter(Boolean);
  return name && values.length > 0 ? [name, ...values].join(' | ') : '';
}

function rewaaRow(row: Row, headers: readonly string[], variable: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (n in REWAA_FIXED) { out[h] = REWAA_FIXED[n]; continue; }
    let v: unknown;
    if (n === 'variant name') v = variantNameOf(row);
    else if (n === 'product sku') v = variable ? undefined : row['Product SKU'];
    else if (n === 'variant sku') v = variable ? row['Variant SKU'] : undefined;
    // Exact key: a loose match for `Option 1` could land on `Option 1 Value`.
    else if (/^option [123]$/.test(n)) v = row[h];
    else if (n === 'variant description') v = row['Variant Description'];
    else v = sourceValue(row, h);

    if (YES_NO.has(n) && !isBlank(v)) v = toYesNo(v);
    if (NUMERIC.has(n) && !isBlank(v)) v = priceNumber(v) ?? text(v); // unreadable text is kept, not zeroed
    out[h] = isBlank(v) ? (REWAA_DEFAULTS[n] ?? '') : v;
  }
  return out;
}

const sameValue = (generic: unknown, rewaa: unknown, numeric: boolean): boolean => {
  if (numeric) {
    const a = priceNumber(generic);
    const b = priceNumber(rewaa);
    if (a !== undefined || b !== undefined) return a === b;
  }
  return text(generic) === text(rewaa);
};

/**
 * Did the row arrive in its Rewaa sheet unchanged? Compares what the Generic
 * sheet shows with what the Rewaa sheet will import. A blank price that the
 * Rewaa sheet had to write as 0 is NOT identical — that is the point: it is
 * the one change a reviewer must see.
 */
function identical(row: Row, rewaa: Record<string, unknown>, variable: boolean): boolean {
  const pairs: [unknown, unknown, boolean][] = [
    [row['Product Name'], rewaa['Product Name'], false],
    [row['Category'], rewaa['Category'], false],
    [row['Retail Price'], rewaa['Retail Price'], true],
    variable ? [row['Variant SKU'], rewaa['Variant SKU'], false] : [row['Product SKU'], rewaa['Product SKU'], false],
  ];
  if (variable) {
    for (const k of OPTION_KEYS) pairs.push([row[k], rewaa[k], false]);
    pairs.push([variantNameOf(row), rewaa['Variant Name'], false]);
  }
  return pairs.every(([a, b, num]) => sameValue(a, b, num));
}

export interface SourceInfo {
  name: string;
  type: string;
  size: number;
  status: 'Extracted' | 'Failed' | 'No data';
  /** A short, user-readable reason for a failure — never a raw provider response. */
  note?: string;
}

export interface Sheet { name: string; rows: unknown[][] }

export interface RewaaExport {
  sheets: Sheet[];
  counts: { total: number; simple: number; variable: number; notIdentical: number; missingPrice: number };
  /** 2-based row numbers on `Generic All Data`, for the summary. */
  notIdenticalRows: { row: number; productName: string; target: string }[];
}

const GENERIC_HEAD = ['Product SKU', 'Variant SKU', 'Product Name', 'Category', 'Type', 'Enable stock management',
  'Option 1 Name', 'Option 1 Value'];
const GENERIC_OPTIONAL = ['Option 2 Name', 'Option 2 Value', 'Option 3 Name', 'Option 3 Value', 'Description'];
const GENERIC_TAIL = ['Source File', 'Retail Price', 'Variant Name'];
const FLAGS = ['Same in Rewaa Simple', 'Same in Rewaa Variable', 'Rewaa Data Identical'];
const TARGET = 'Target Rewaa File';

/** Generic header → the key it is read from on an extracted row. */
const GENERIC_SOURCE: Readonly<Record<string, string>> = {
  'Option 1 Name': 'Option 1', 'Option 2 Name': 'Option 2', 'Option 3 Name': 'Option 3',
};

const KNOWN_KEYS = new Set([...GENERIC_HEAD, ...GENERIC_OPTIONAL, ...GENERIC_TAIL, ...FLAGS, TARGET,
  'Option 1', 'Option 2', 'Option 3', 'type']);

/**
 * A blank is written as an empty TEXT cell, as the contract has it — except
 * `Variant Name` on a simple row, which the contract leaves with no cell at
 * all (`null` below). Cell-level only; both read as blank everywhere.
 */
const cell = (v: unknown): unknown => (isBlank(v) ? '' : v);

export function buildRewaaExport(rows: readonly Row[], sources: readonly SourceInfo[], extractedAt: Date): RewaaExport {
  const routed = rows.map((row) => {
    const variable = isVariableRow(row);
    const rewaa = variable ? rewaaRow(row, REWAA_VARIABLE_HEADERS, true) : rewaaRow(row, REWAA_SIMPLE_HEADERS, false);
    const same = identical(row, rewaa, variable);
    return { row, variable, rewaa, same };
  });

  // Optional columns only when something is in them; any column the model
  // added that this export has no place for is kept, not dropped.
  const extras: string[] = [];
  for (const { row } of routed) {
    for (const k of Object.keys(row)) {
      if (!KNOWN_KEYS.has(k) && !extras.includes(k) && !isBlank(row[k])) extras.push(k);
    }
  }
  const present = (h: string) => routed.some(({ row }) => !isBlank(row[GENERIC_SOURCE[h] ?? h]));
  const allHeaders = [...GENERIC_HEAD, ...GENERIC_OPTIONAL.filter(present), ...extras, ...GENERIC_TAIL, ...FLAGS, TARGET];

  const genericValue = (r: (typeof routed)[number], h: string): unknown => {
    switch (h) {
      case 'Product SKU': return r.variable ? '' : cell(r.row['Product SKU']);
      case 'Variant SKU': return r.variable ? cell(r.row['Variant SKU']) : '';
      case 'Variant Name': return r.variable ? cell(variantNameOf(r.row)) : null; // no cell, as the contract
      case 'Same in Rewaa Simple': return !r.variable && r.same;
      case 'Same in Rewaa Variable': return r.variable && r.same;
      case 'Rewaa Data Identical': return r.same;
      case TARGET: return r.variable ? SHEETS.rewaaVariable : SHEETS.rewaaSimple;
      default: return cell(r.row[GENERIC_SOURCE[h] ?? h]);
    }
  };

  const optionOrVariant = (h: string) => /option|variant/i.test(h);
  const simpleHeaders = allHeaders.filter((h) => h !== TARGET && !optionOrVariant(h));
  const variableHeaders = allHeaders.filter((h) => h !== TARGET && h !== 'Product SKU');

  const simple = routed.filter((r) => !r.variable);
  const variable = routed.filter((r) => r.variable);
  const table = (headers: readonly string[], list: typeof routed) =>
    [headers.slice(), ...list.map((r) => headers.map((h) => genericValue(r, h)))];
  const rewaaTable = (headers: readonly string[], list: typeof routed) =>
    [headers.slice(), ...list.map((r) => headers.map((h) => r.rewaa[h]))];

  const perSource = new Map<string, { count: number; differ: number }>();
  for (const r of routed) {
    const name = text(r.row['Source File']);
    const s = perSource.get(name) ?? { count: 0, differ: 0 };
    s.count++;
    if (!r.same) s.differ++;
    perSource.set(name, s);
  }
  const stamp = new Date(Math.floor(extractedAt.getTime() / 1000) * 1000).toISOString();
  const audit: unknown[][] = [[
    'File Index', 'Source File Name', 'File Format / MIME', 'File Size', 'Extracted Products Count',
    'Extraction Timestamp', 'Processing Status', 'Verification Notes',
  ]];
  sources.forEach((s, i) => {
    const st = perSource.get(s.name) ?? { count: 0, differ: 0 };
    const note = s.status !== 'Extracted'
      ? (s.note ?? (s.status === 'Failed' ? 'Extraction failed' : 'No products found'))
      : st.differ === 0
        ? 'Extracted successfully with verified parity'
        : `Extracted successfully; ${st.differ} row(s) differ in the Rewaa sheets (see Rewaa Data Identical)`;
    audit.push([i + 1, s.name, s.type || 'unknown', `${(s.size / 1024).toFixed(1)} KB`, st.count, stamp, s.status, note]);
  });

  const sheets: Sheet[] = [{ name: SHEETS.all, rows: table(allHeaders, routed) }];
  if (simple.length) sheets.push({ name: SHEETS.simple, rows: table(simpleHeaders, simple) });
  if (variable.length) sheets.push({ name: SHEETS.variable, rows: table(variableHeaders, variable) });
  if (simple.length) sheets.push({ name: SHEETS.rewaaSimple, rows: rewaaTable(REWAA_SIMPLE_HEADERS, simple) });
  if (variable.length) sheets.push({ name: SHEETS.rewaaVariable, rows: rewaaTable(REWAA_VARIABLE_HEADERS, variable) });
  sheets.push({ name: SHEETS.audit, rows: audit });

  const notIdenticalRows = routed.flatMap((r, i) => r.same ? [] : [{
    row: i + 2, productName: text(r.row['Product Name']), target: r.variable ? SHEETS.rewaaVariable : SHEETS.rewaaSimple,
  }]);
  return {
    sheets,
    counts: {
      total: routed.length, simple: simple.length, variable: variable.length,
      notIdentical: notIdenticalRows.length,
      missingPrice: routed.filter((r) => isBlank(r.row['Retail Price'])).length,
    },
    notIdenticalRows,
  };
}

/** The sheets as a SheetJS workbook: `''` becomes an empty text cell, `null` no cell at all. */
export function sheetsToWorkbook(lib: typeof XLSXNS, sheets: readonly Sheet[]): XLSXNS.WorkBook {
  const wb = lib.utils.book_new();
  for (const s of sheets) lib.utils.book_append_sheet(wb, lib.utils.aoa_to_sheet(s.rows), s.name);
  return wb;
}

// ---------------------------------------------------------------------------
// 3. File names, the ZIP bundle, and when to download on its own
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|\u0000-\u001F\u007F]+/g;

/** A file name's stem, safe on every OS; Arabic kept. `../a:b.xlsx` → `a_b`. */
export function safeStem(name: string, fallback = 'ocr'): string {
  const base = String(name).split(/[\\/]/).pop() ?? '';
  const stem = base.replace(/\.[^.]*$/, '').replace(UNSAFE, '_').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '');
  return stem.slice(0, 60) || fallback;
}

/** A name for an entry INSIDE the zip: no directory part, no `..`, extension kept. */
export function safeEntryName(name: string, fallback = 'source'): string {
  const base = String(name).split(/[\\/]/).pop() ?? '';
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(base)?.[1];
  const stem = safeStem(base, fallback);
  return ext ? `${stem}.${ext.toLowerCase()}` : stem;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** `20260930-141503`, local time — what the user sees on their clock. */
export const fileStamp = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/** `OCR-Rewaa-<first source>[-and-N-more]-<stamp>`; `.xlsx` and `.zip` share it. */
export function exportBaseName(sourceNames: readonly string[], at: Date): string {
  const first = sourceNames.length ? safeStem(sourceNames[0]) : 'pasted-text';
  const more = sourceNames.length > 1 ? `-and-${sourceNames.length - 1}-more` : '';
  return `OCR-Rewaa-${first}${more}-${fileStamp(at)}`;
}

export interface BundleInput {
  baseName: string;
  workbook: Uint8Array;
  /** The ORIGINAL files, byte for byte (pasted text as a `.txt`). */
  sources: readonly { name: string; data: Blob | Uint8Array | string }[];
  exported: RewaaExport;
  sourceInfo: readonly SourceInfo[];
  extractedAt: Date;
}

/**
 * The ZIP's fixed layout (documented in MODULE_GUIDE):
 *
 *   <baseName>.xlsx        the Rewaa workbook, the same bytes as the download
 *   source/<file>          each original input, unchanged
 *   summary.json           counts, per-file status, the rows needing review
 *
 * Built only from the run's rows and file metadata. Nothing from storage — no
 * key, token or setting can reach it, because nothing here reads them.
 */
export async function buildBundle(JSZip: typeof JSZipNS, input: BundleInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const date = input.extractedAt;
  zip.file(`${input.baseName}.xlsx`, input.workbook, { date, binary: true });
  const taken = new Set<string>();
  for (const s of input.sources) {
    let entry = safeEntryName(s.name);
    for (let n = 2; taken.has(entry.toLowerCase()); n++) entry = entry.replace(/( \(\d+\))?(\.[^.]*)?$/, ` (${n})$2`);
    taken.add(entry.toLowerCase());
    zip.file(`source/${entry}`, s.data, { date, binary: typeof s.data !== 'string' });
  }
  const summary = {
    tool: 'OCR Extraction → Rewaa',
    generatedAt: new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString(),
    workbook: `${input.baseName}.xlsx`,
    sheets: input.exported.sheets.map((s) => ({ name: s.name, rows: s.rows.length - 1 })),
    sources: input.sourceInfo.map((s) => ({ name: s.name, type: s.type, sizeBytes: s.size, status: s.status })),
    counts: input.exported.counts,
    rowsNeedingReview: input.exported.notIdenticalRows,
    rules: [
      'Enable stock management is always "no" on the Rewaa sheets.',
      'A missing price is written as 0 on the Rewaa sheets, left blank on the Generic sheets, and marked Rewaa Data Identical = FALSE.',
      'Bilingual text is written English first: "English | Arabic".',
    ],
  };
  zip.file('summary.json', `${JSON.stringify(summary, null, 2)}\n`, { date });
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Whether a finished run downloads on its own. Only a clean run does: every
 * input extracted, rows produced, and the workbook built. A partial failure
 * is held for the user to look at first — the buttons stay available.
 */
export function autoExportDecision(run: { rows: number; failedInputs: number; built: boolean }): 'download' | 'hold' | 'none' {
  if (run.rows === 0 || !run.built) return 'none';
  return run.failedInputs > 0 ? 'hold' : 'download';
}
