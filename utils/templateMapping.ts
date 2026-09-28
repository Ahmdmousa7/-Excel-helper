/**
 * Mapping OCR output onto an uploaded import template (Rewaa Simple / Variable).
 *
 * One module, used by both the auto-mapper and the exporter, so the two can
 * never disagree about which extracted column feeds which template column.
 * They did disagree in an earlier implementation elsewhere: one side lowercased
 * header keys and the other did not, so `Regular price` was found by the mapper
 * and missed by the checker, and correct rows were reported as mismatches.
 * Normalising in exactly one place makes that class of bug unrepresentable.
 *
 * Pure functions, no React, and no RUNTIME SheetJS dependency (the one parser
 * takes the library as a parameter) — testable against the real templates.
 */

import type * as XLSXNS from 'xlsx';

export type TemplateRow = Record<string, unknown>;
export type Mapping = Record<string, string>;

/**
 * Own-property access only. The lookup tables below are plain objects, and a
 * template header is arbitrary user text: without these, a column named
 * `constructor` resolved to `Object` itself and crashed the mapper, and one
 * named `__proto__` was silently DROPPED from the output because assigning to
 * it sets the prototype instead of a key. Both measured before the fix.
 */
const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const getOwn = <T,>(obj: Readonly<Record<string, T>>, key: string): T | undefined =>
  hasOwn(obj, key) ? obj[key] : undefined;

const setOwn = (obj: Record<string, unknown>, key: string, value: unknown): void => {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
};

/**
 * Compare headers by meaning, not by spelling: case, surrounding whitespace,
 * runs of spaces, `_`/`-` separators and a leading UTF-8 BOM are all ignored.
 *
 * The BOM matters in practice: a CSV saved by Excel starts with U+FEFF, and
 * SheetJS can hand it through on the first header, so `Product Name` would
 * otherwise fail to match `\uFEFFProduct Name` and silently map to nothing.
 */
export const normalizeHeader = (header: unknown): string =>
  String(header ?? '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Other names the AI uses for a template column, keyed by the NORMALISED
 * template header. Tried only after an exact match fails, and in the order
 * listed, so a row that has both `Retail Price` and `Price` maps the former.
 *
 * Deliberately short. A synonym that is sometimes wrong is worse than a blank
 * the user can see and fix in the mapping panel. Note that `price` is listed
 * for Retail Price: right for menus, which is what this export is for, but on
 * an INVOICE extraction a bare `price` is usually the purchase cost — check the
 * mapping panel after extracting an invoice.
 */
export const HEADER_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  'product name': ['name', 'item name'],
  'retail price': ['regular price', 'selling price', 'price'],
  'product sku': ['sku', 'item code', 'product code'],
  'variant sku': ['sku', 'item code', 'product code'],
  'barcode': ['ean', 'upc', 'gtin'],
  'variant barcode': ['barcode', 'ean', 'upc', 'gtin'],
  'description': ['desc', 'details'],
  'variant description': ['description'],
};

/**
 * Values a Rewaa import expects when the extraction supplied nothing, read off
 * the data rows of the real templates (2026-09-28) rather than assumed.
 *
 * `Retail Price` is deliberately ABSENT. Every other price defaults to 0, but a
 * missing retail price exported as 0 imports as a free product, and it is the
 * one number the extraction exists to capture. Blank is visible; 0 is not.
 *
 * `Enable stock management` is `no` — and this one CONTRADICTS the template.
 * Both templates' own spec row says `list yes no Default yes`, meaning Rewaa's
 * importer treats a blank as `yes`. Every sample data row says `no`, and the
 * product owner explicitly asked for `no`. So `no` is written out on purpose,
 * overriding Rewaa's own default rather than leaving the cell blank. Do not
 * "fix" this to match the spec row without asking.
 */
const PACK_DEFAULTS: Record<string, string | number> = {};
for (const n of [1, 2, 3]) {
  PACK_DEFAULTS[`pack${n} def retail price`] = 0;
  PACK_DEFAULTS[`pack${n} def buy price`] = 0;
  PACK_DEFAULTS[`pack${n} sellable`] = 'yes';
  PACK_DEFAULTS[`pack${n} purchasable`] = 'yes';
}

export const TEMPLATE_DEFAULTS: Readonly<Record<string, string | number>> = {
  'sellable': 'yes',
  'purchasable': 'yes',
  'enable stock management': 'no',
  'weighted': 'no',
  'tracked by batch': 'no',
  'tracked by serial': 'no',
  'wholesale price': 0,
  'cost': 0,
  'buy price': 0,
  ...PACK_DEFAULTS,
};

export const defaultFor = (templateHeader: unknown): string | number | undefined =>
  getOwn(TEMPLATE_DEFAULTS, normalizeHeader(templateHeader));

/** The extracted column that feeds `templateHeader`, or undefined if none does. */
export function resolveSourceKey(
  templateHeader: unknown,
  available: readonly string[],
): string | undefined {
  const target = normalizeHeader(templateHeader);
  if (!target) return undefined;

  const byNorm = new Map<string, string>();
  for (const key of available) {
    const n = normalizeHeader(key);
    if (n && !byNorm.has(n)) byNorm.set(n, key); // first spelling wins
  }

  const exact = byNorm.get(target);
  if (exact !== undefined) return exact;

  for (const synonym of getOwn(HEADER_SYNONYMS, target) ?? []) {
    const hit = byNorm.get(synonym);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Fill in mapping entries that are still ABSENT. An entry that is present —
 * including `''`, which is what the panel's "-- Ignore --" stores — is the
 * user's decision and is never overwritten. Headers with no match stay absent,
 * so a later extraction can still fill them.
 */
export function autoMap(
  templateHeaders: readonly unknown[],
  available: readonly string[],
  existing: Mapping = {},
): Mapping {
  const out: Mapping = {};
  for (const k of Object.keys(existing)) setOwn(out, k, existing[k]);
  for (const h of templateHeaders) {
    const key = String(h);
    if (hasOwn(out, key)) continue;
    const src = resolveSourceKey(h, available);
    if (src !== undefined) setOwn(out, key, src);
  }
  return out;
}

/**
 * Re-map after a NEW extraction, keeping what is still valid.
 *
 * `autoMap` alone never overwrites, which protects the user's choices — but it
 * also froze auto-filled guesses. Extraction 1 names the column `Regular price`
 * and `Retail Price` maps to it; extraction 2 calls it `Price`; the stale entry
 * survived and the new prices exported BLANK, silently. Measured before the fix.
 *
 * So: an entry pointing at a column that does not exist in THIS extraction can
 * only ever export blank, and is dropped and re-resolved. Kept untouched:
 *   - an explicit `''` — the user's "-- Ignore --";
 *   - any entry whose column still exists, whoever chose it.
 */
export function refreshMapping(
  templateHeaders: readonly unknown[],
  available: readonly string[],
  existing: Mapping,
): Mapping {
  const present = new Set(available);
  const kept: Mapping = {};
  for (const k of Object.keys(existing)) {
    const v = existing[k];
    if (v === '' || present.has(v)) setOwn(kept, k, v);
  }
  return autoMap(templateHeaders, available, kept);
}

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Rows reshaped to exactly the template's columns, in the template's order.
 *
 * Uses the mapping AS GIVEN — no hidden resolution here — so the file matches
 * what the mapping panel shows. A column with no source, or whose source is
 * blank for this row, gets the template default when there is one and `''`
 * otherwise. A default never overrides a value the extraction produced: an
 * extracted `Sellable: no` stays `no`.
 */
export function mapRowsToTemplate(
  rows: readonly TemplateRow[],
  mapping: Mapping,
  templateHeaders: readonly unknown[],
): TemplateRow[] {
  // Defaults are Rewaa's, so they apply to Rewaa templates only. The mapping
  // panel accepts ANY template — a Salla, Zid or custom sheet with a column
  // called `Sellable` or `Cost` must not silently receive `yes` / `0` it was
  // never designed for. Other templates keep the old behaviour: blank.
  const applyDefaults = isRewaaTemplate(templateHeaders);
  return rows.map((row) => {
    const out: TemplateRow = {};
    for (const h of templateHeaders) {
      const key = String(h);
      const src = getOwn(mapping, key);
      const value = src ? getOwn(row, src) : undefined;
      const fallback = applyDefaults ? (defaultFor(key) ?? '') : '';
      setOwn(out, key, isBlank(value) ? fallback : value);
    }
    return out;
  });
}

/**
 * Columns only a Rewaa import template has together. Both templates — Simple
 * and Variable — carry all three; generic product sheets rarely carry any.
 */
const REWAA_SIGNATURE = ['enable stock management', 'tracked by batch', 'tracked by serial'] as const;

/**
 * Is this a Rewaa import template? True when every signature column is present
 * AND there is a Rewaa SKU column (`Product SKU` for Simple, `Variant SKU` for
 * Variable). Deliberately strict: a false negative costs blanks the user can
 * see; a false positive silently fills another platform's columns.
 */
export function isRewaaTemplate(templateHeaders: readonly unknown[]): boolean {
  const have = new Set(templateHeaders.map(normalizeHeader));
  return REWAA_SIGNATURE.every((c) => have.has(c)) && (have.has('product sku') || have.has('variant sku'));
}

/** Is this upload a CSV? By extension first, MIME type as a fallback. */
export const isCsvFile = (name: string, mimeType = ''): boolean =>
  /\.csv$/i.test(name) || mimeType === 'text/csv';

/**
 * Rows of a CSV template from its DECODED TEXT — pass `await file.text()`.
 *
 * Why not `readExcelFile`: it hands SheetJS the raw bytes, and a UTF-8 CSV
 * without a BOM (every Google Sheets export) is then decoded as Latin-1, so an
 * Arabic header comes out as mojibake, matches nothing, and is written back to
 * the export as garbage. That is TD-050. `File.text()` decodes as UTF-8 and
 * drops a BOM, so parsing the text sidesteps it. Scoped to template upload on
 * purpose — the app-wide fix belongs to TD-050 and touches `.xls` too.
 *
 * The SheetJS instance is passed in, as `lookupEngine` does, so this module
 * carries no runtime dependency on the library.
 */
export function parseCsvTemplate(lib: typeof XLSXNS, text: string): unknown[][] {
  const wb = lib.read(text, { type: 'string' });
  return lib.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1, defval: '', raw: false,
  }) as unknown[][];
}

/** Template headers as loaded, with a CSV's leading BOM removed from the first. */
export const cleanTemplateHeaders = (headers: readonly unknown[]): string[] =>
  headers.map((h, i) => (i === 0 ? String(h ?? '').replace(/^\uFEFF/, '') : String(h ?? '')));
